//! Recordings API Endpoints

use std::sync::Arc;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::entities::{Recording, RecordingStatus};
use crate::infrastructure::server::AppState;

#[derive(Debug, Serialize)]
pub struct RecordingResponse {
    pub id: Uuid,
    pub camera_id: Uuid,
    pub file_url: String,
    pub file_size_bytes: i64,
    pub file_size_human: String,
    pub duration_ms: i64,
    pub duration_human: String,
    pub frame_count: i64,
    pub status: RecordingStatus,
    pub has_detections: bool,
    pub started_at: String,
    pub ended_at: Option<String>,
}

impl From<Recording> for RecordingResponse {
    fn from(r: Recording) -> Self {
        Self {
            id: r.id(),
            camera_id: r.camera_id(),
            file_url: format!("/files/recordings/{}", r.file_path().split('/').last().unwrap_or("")),
            file_size_bytes: r.file_size_bytes(),
            file_size_human: format_bytes(r.file_size_bytes()),
            duration_ms: r.duration_ms(),
            duration_human: format_duration(r.duration_ms()),
            frame_count: r.frame_count(),
            status: r.status(),
            has_detections: r.has_detections(),
            started_at: r.started_at().to_rfc3339(),
            ended_at: r.ended_at().map(|t| t.to_rfc3339()),
        }
    }
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
        format!("{} bytes", bytes)
    }
}

fn format_duration(ms: i64) -> String {
    let seconds = ms / 1000;
    let minutes = seconds / 60;
    let hours = minutes / 60;

    if hours > 0 {
        format!("{}h {}m {}s", hours, minutes % 60, seconds % 60)
    } else if minutes > 0 {
        format!("{}m {}s", minutes, seconds % 60)
    } else {
        format!("{}s", seconds)
    }
}

#[derive(Debug, Deserialize)]
pub struct RecordingsQuery {
    pub camera_id: Option<Uuid>,
    pub has_detections: Option<bool>,
    pub limit: Option<i64>,
}

/// GET /api/v1/recordings
pub async fn list_recordings(
    State(state): State<Arc<AppState>>,
    Query(query): Query<RecordingsQuery>,
) -> Result<Json<Vec<RecordingResponse>>, StatusCode> {
    let limit = query.limit.unwrap_or(50);
    
    let recordings = if let Some(camera_id) = query.camera_id {
        state
            .recording_repo
            .find_by_camera(camera_id, limit)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else if query.has_detections == Some(true) {
        state
            .recording_repo
            .find_with_detections(limit)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        // Return recent recordings
        state
            .recording_repo
            .find_with_detections(limit)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let responses: Vec<RecordingResponse> = recordings.into_iter().map(Into::into).collect();

    Ok(Json(responses))
}

/// GET /api/v1/recordings/:id
pub async fn get_recording(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<RecordingResponse>, StatusCode> {
    let recording = state
        .recording_repo
        .find_by_id(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(recording.into()))
}

/// DELETE /api/v1/recordings/:id
pub async fn delete_recording(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    state
        .recording_repo
        .delete(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::NO_CONTENT)
}

/// GET /api/v1/recordings/:id/play
pub async fn play_recording(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<PlaybackResponse>, StatusCode> {
    let recording = state
        .recording_repo
        .find_by_id(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    let filename = recording.file_path().split('/').last().unwrap_or("");
    
    Ok(Json(PlaybackResponse {
        id: recording.id(),
        url: format!("/files/recordings/{}", filename),
        duration_ms: recording.duration_ms(),
    }))
}

#[derive(Debug, Serialize)]
pub struct PlaybackResponse {
    pub id: Uuid,
    pub url: String,
    pub duration_ms: i64,
}
