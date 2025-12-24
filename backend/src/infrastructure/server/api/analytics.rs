//! Analytics API Endpoints

use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::domain::entities::ProfileClassification;
use crate::infrastructure::server::AppState;

#[derive(Debug, Serialize)]
pub struct DashboardStats {
    pub total_profiles: i64,
    pub known_profiles: i64,
    pub unknown_profiles: i64,
    pub flagged_profiles: i64,
    pub total_sightings_today: i64,
    pub total_sightings_week: i64,
    pub active_cameras: i64,
    pub recording_active: bool,
    pub storage_used_bytes: i64,
    pub storage_used_human: String,
    pub storage_total_bytes: i64,
    pub storage_percent_used: f32,
}

#[derive(Debug, Serialize)]
pub struct HeatmapData {
    pub points: Vec<HeatmapPoint>,
    pub camera_positions: Vec<CameraPosition>,
}

#[derive(Debug, Serialize)]
pub struct HeatmapPoint {
    pub x: f32,
    pub y: f32,
    pub intensity: f32,
    pub camera_id: Uuid,
}

#[derive(Debug, Serialize)]
pub struct CameraPosition {
    pub camera_id: Uuid,
    pub name: String,
    pub x: f32,
    pub y: f32,
}

#[derive(Debug, Serialize)]
pub struct TimelineEntry {
    pub timestamp: DateTime<Utc>,
    pub event_type: String,
    pub profile_id: Option<Uuid>,
    pub profile_name: Option<String>,
    pub camera_id: Uuid,
    pub camera_name: String,
    pub thumbnail_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TimelineQuery {
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,
    pub limit: Option<i32>,
    pub camera_id: Option<Uuid>,
    pub profile_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct StorageStats {
    pub total_bytes: i64,
    pub used_bytes: i64,
    pub available_bytes: i64,
    pub recordings_count: i64,
    pub recordings_bytes: i64,
    pub snapshots_count: i64,
    pub snapshots_bytes: i64,
    pub breakdown_by_camera: Vec<CameraStorage>,
}

#[derive(Debug, Serialize)]
pub struct CameraStorage {
    pub camera_id: Uuid,
    pub camera_name: String,
    pub bytes_used: i64,
    pub recordings_count: i64,
}

#[derive(Debug, Serialize)]
pub struct ActivityChart {
    pub labels: Vec<String>,
    pub datasets: Vec<ActivityDataset>,
}

#[derive(Debug, Serialize)]
pub struct ActivityDataset {
    pub label: String,
    pub data: Vec<i64>,
    pub color: String,
}

#[derive(Debug, Deserialize)]
pub struct ActivityChartQuery {
    pub period: Option<String>,
    pub group_by: Option<String>,
}

/// GET /api/v1/analytics/dashboard
pub async fn get_dashboard_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<DashboardStats>, StatusCode> {
    let profiles = state
        .profile_repo
        .find_all_active()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let known_count = profiles
        .iter()
        .filter(|p| p.classification() == ProfileClassification::Known)
        .count() as i64;

    let unknown_count = profiles
        .iter()
        .filter(|p| p.classification() == ProfileClassification::Unknown)
        .count() as i64;

    let flagged_count = profiles
        .iter()
        .filter(|p| p.classification() == ProfileClassification::Flagged)
        .count() as i64;

    let today_start = Utc::now().date_naive().and_hms_opt(0, 0, 0).unwrap();
    let today_start = DateTime::from_naive_utc_and_offset(today_start, Utc);

    let week_start = Utc::now() - chrono::Duration::days(7);

    let sightings_today = state
        .sighting_repo
        .find_in_range(today_start, Utc::now(), 10000)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .len() as i64;

    let sightings_week = state
        .sighting_repo
        .find_in_range(week_start, Utc::now(), 10000)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .len() as i64;

    let cameras = state
        .camera_repo
        .find_enabled()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let settings = state
        .settings_repo
        .get()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let storage_path = &state.config.data_dir;
    let storage_used = calculate_directory_size(storage_path).unwrap_or(0);
    let storage_total = settings.recording.max_storage_bytes;
    let storage_percent = (storage_used as f32 / storage_total as f32) * 100.0;

    Ok(Json(DashboardStats {
        total_profiles: profiles.len() as i64,
        known_profiles: known_count,
        unknown_profiles: unknown_count,
        flagged_profiles: flagged_count,
        total_sightings_today: sightings_today,
        total_sightings_week: sightings_week,
        active_cameras: cameras.len() as i64,
        recording_active: settings.recording.detection_triggered,
        storage_used_bytes: storage_used,
        storage_used_human: format_bytes(storage_used),
        storage_total_bytes: storage_total,
        storage_percent_used: storage_percent,
    }))
}

/// GET /api/v1/analytics/heatmap
pub async fn get_heatmap_data(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HeatmapData>, StatusCode> {
    let sightings = state
        .sighting_repo
        .find_in_range(Utc::now() - chrono::Duration::hours(24), Utc::now(), 10000)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let cameras = state
        .camera_repo
        .find_all()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut points = Vec::new();
    for sighting in &sightings {
        points.push(HeatmapPoint {
            x: sighting.bounding_box().x() as f32,
            y: sighting.bounding_box().y() as f32,
            intensity: sighting.confidence(),
            camera_id: sighting.camera_id(),
        });
    }

    let camera_positions: Vec<CameraPosition> = cameras
        .iter()
        .enumerate()
        .map(|(i, cam)| CameraPosition {
            camera_id: cam.id(),
            name: cam.name().to_string(),
            x: (i as f32 * 0.25) % 1.0,
            y: ((i / 4) as f32 * 0.25) % 1.0,
        })
        .collect();

    Ok(Json(HeatmapData {
        points,
        camera_positions,
    }))
}

/// GET /api/v1/analytics/timeline
pub async fn get_timeline(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TimelineQuery>,
) -> Result<Json<Vec<TimelineEntry>>, StatusCode> {
    let start = query
        .start
        .unwrap_or_else(|| Utc::now() - chrono::Duration::hours(24));
    let end = query.end.unwrap_or_else(Utc::now);
    let limit = query.limit.unwrap_or(50);

    let sightings = state
        .sighting_repo
        .find_in_range(start, end, limit as i64)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let cameras = state
        .camera_repo
        .find_all()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let camera_map: std::collections::HashMap<Uuid, String> = cameras
        .into_iter()
        .map(|c| (c.id(), c.name().to_string()))
        .collect();

    let mut entries: Vec<TimelineEntry> = Vec::new();

    for sighting in sightings.into_iter().take(limit as usize) {
        if let Some(camera_id) = query.camera_id {
            if sighting.camera_id() != camera_id {
                continue;
            }
        }
        if let Some(profile_id) = query.profile_id {
            if sighting.profile_id() != profile_id {
                continue;
            }
        }

        let profile = state
            .profile_repo
            .find_by_id(sighting.profile_id())
            .await
            .ok()
            .flatten();

        entries.push(TimelineEntry {
            timestamp: sighting.detected_at(),
            event_type: "sighting".to_string(),
            profile_id: Some(sighting.profile_id()),
            profile_name: profile.and_then(|p| p.name().map(|s| s.to_string())),
            camera_id: sighting.camera_id(),
            camera_name: camera_map
                .get(&sighting.camera_id())
                .cloned()
                .unwrap_or_default(),
            thumbnail_url: Some(sighting.snapshot_path().to_string()),
        });
    }

    Ok(Json(entries))
}

/// GET /api/v1/analytics/storage
pub async fn get_storage_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<StorageStats>, StatusCode> {
    let settings = state
        .settings_repo
        .get()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let storage_path = &state.config.data_dir;
    let recordings_path = storage_path.join("recordings");
    let snapshots_path = storage_path.join("snapshots");

    let recordings_bytes = calculate_directory_size(&recordings_path).unwrap_or(0);
    let snapshots_bytes = calculate_directory_size(&snapshots_path).unwrap_or(0);
    let total_used = recordings_bytes + snapshots_bytes;

    let recordings = state
        .recording_repo
        .find_all(10000)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let cameras = state
        .camera_repo
        .find_all()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut camera_storage: Vec<CameraStorage> = Vec::new();
    for camera in &cameras {
        let cam_recordings: Vec<_> = recordings
            .iter()
            .filter(|r| r.camera_id() == camera.id())
            .collect();

        let bytes_used: i64 = cam_recordings.iter().map(|r| r.file_size_bytes()).sum();

        camera_storage.push(CameraStorage {
            camera_id: camera.id(),
            camera_name: camera.name().to_string(),
            bytes_used,
            recordings_count: cam_recordings.len() as i64,
        });
    }

    let snapshots_count = count_files_in_directory(&snapshots_path).unwrap_or(0);

    Ok(Json(StorageStats {
        total_bytes: settings.recording.max_storage_bytes,
        used_bytes: total_used,
        available_bytes: settings.recording.max_storage_bytes - total_used,
        recordings_count: recordings.len() as i64,
        recordings_bytes,
        snapshots_count,
        snapshots_bytes,
        breakdown_by_camera: camera_storage,
    }))
}

/// GET /api/v1/analytics/activity-chart
pub async fn get_activity_chart(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ActivityChartQuery>,
) -> Result<Json<ActivityChart>, StatusCode> {
    let period = query.period.as_deref().unwrap_or("week");
    let group_by = query.group_by.as_deref().unwrap_or("day");

    let (start, labels) = match (period, group_by) {
        ("day", "hour") => {
            let start = Utc::now() - chrono::Duration::hours(24);
            let labels: Vec<String> = (0..24).map(|h| format!("{:02}:00", h)).collect();
            (start, labels)
        }
        ("week", "day") => {
            let start = Utc::now() - chrono::Duration::days(7);
            let labels: Vec<String> = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                .iter()
                .map(|s| s.to_string())
                .collect();
            (start, labels)
        }
        ("month", "day") => {
            let start = Utc::now() - chrono::Duration::days(30);
            let labels: Vec<String> = (1..=30).map(|d| format!("Day {}", d)).collect();
            (start, labels)
        }
        _ => {
            let start = Utc::now() - chrono::Duration::days(7);
            let labels: Vec<String> = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                .iter()
                .map(|s| s.to_string())
                .collect();
            (start, labels)
        }
    };

    let sightings = state
        .sighting_repo
        .find_in_range(start, Utc::now(), 10000)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let profiles = state
        .profile_repo
        .find_all_active()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut known_data = vec![0i64; labels.len()];
    let mut unknown_data = vec![0i64; labels.len()];
    let mut flagged_data = vec![0i64; labels.len()];

    for sighting in &sightings {
        let profile = profiles.iter().find(|p| p.id() == sighting.profile_id());
        let bucket = calculate_bucket(&sighting.detected_at(), &start, group_by, labels.len());

        if bucket < labels.len() {
            match profile.map(|p| p.classification()) {
                Some(ProfileClassification::Known) => known_data[bucket] += 1,
                Some(ProfileClassification::Flagged) => flagged_data[bucket] += 1,
                _ => unknown_data[bucket] += 1,
            }
        }
    }

    Ok(Json(ActivityChart {
        labels,
        datasets: vec![
            ActivityDataset {
                label: "Known".to_string(),
                data: known_data,
                color: "#10b981".to_string(),
            },
            ActivityDataset {
                label: "Unknown".to_string(),
                data: unknown_data,
                color: "#6b7280".to_string(),
            },
            ActivityDataset {
                label: "Flagged".to_string(),
                data: flagged_data,
                color: "#ef4444".to_string(),
            },
        ],
    }))
}

fn calculate_bucket(
    timestamp: &DateTime<Utc>,
    start: &DateTime<Utc>,
    group_by: &str,
    num_buckets: usize,
) -> usize {
    let duration = *timestamp - *start;

    match group_by {
        "hour" => duration.num_hours() as usize % num_buckets,
        "day" => duration.num_days() as usize % num_buckets,
        _ => 0,
    }
}

fn calculate_directory_size(path: &std::path::Path) -> std::io::Result<i64> {
    let mut total = 0i64;

    if !path.exists() {
        return Ok(0);
    }

    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let metadata = entry.metadata()?;

        if metadata.is_dir() {
            total += calculate_directory_size(&entry.path())?;
        } else {
            total += metadata.len() as i64;
        }
    }

    Ok(total)
}

fn count_files_in_directory(path: &std::path::Path) -> std::io::Result<i64> {
    let mut count = 0i64;

    if !path.exists() {
        return Ok(0);
    }

    for entry in std::fs::read_dir(path)? {
        let entry = entry?;
        let metadata = entry.metadata()?;

        if metadata.is_dir() {
            count += count_files_in_directory(&entry.path())?;
        } else {
            count += 1;
        }
    }

    Ok(count)
}

fn format_bytes(bytes: i64) -> String {
    const KB: i64 = 1024;
    const MB: i64 = KB * 1024;
    const GB: i64 = MB * 1024;

    if bytes >= GB {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    } else if bytes >= MB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else if bytes >= KB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else {
        format!("{} B", bytes)
    }
}
