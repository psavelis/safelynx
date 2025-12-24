//! Sightings API Endpoints

use std::sync::Arc;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::application::use_cases::TimeRange;
use crate::domain::entities::Sighting;
use crate::infrastructure::server::AppState;

#[derive(Debug, Serialize)]
pub struct SightingResponse {
    pub id: Uuid,
    pub profile_id: Uuid,
    pub camera_id: Uuid,
    pub snapshot_url: String,
    pub bounding_box: BoundingBoxResponse,
    pub confidence: f32,
    pub location: Option<LocationResponse>,
    pub recording_id: Option<Uuid>,
    pub recording_timestamp_ms: Option<i64>,
    pub detected_at: String,
}

#[derive(Debug, Serialize)]
pub struct BoundingBoxResponse {
    pub x: i32,
    pub y: i32,
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Serialize)]
pub struct LocationResponse {
    pub latitude: f64,
    pub longitude: f64,
}

impl From<Sighting> for SightingResponse {
    fn from(s: Sighting) -> Self {
        let bbox = s.bounding_box();
        Self {
            id: s.id(),
            profile_id: s.profile_id(),
            camera_id: s.camera_id(),
            snapshot_url: format!("/files/snapshots/{}", s.snapshot_path()),
            bounding_box: BoundingBoxResponse {
                x: bbox.x(),
                y: bbox.y(),
                width: bbox.width(),
                height: bbox.height(),
            },
            confidence: s.confidence(),
            location: s.location().map(|l| LocationResponse {
                latitude: l.latitude(),
                longitude: l.longitude(),
            }),
            recording_id: s.recording_id(),
            recording_timestamp_ms: s.recording_timestamp_ms(),
            detected_at: s.detected_at().to_rfc3339(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct SightingsQuery {
    pub start: Option<DateTime<Utc>>,
    pub end: Option<DateTime<Utc>>,
    pub profile_id: Option<Uuid>,
    pub camera_id: Option<Uuid>,
    pub limit: Option<i64>,
}

/// GET /api/v1/sightings
pub async fn list_sightings(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SightingsQuery>,
) -> Result<Json<Vec<SightingResponse>>, StatusCode> {
    let limit = query.limit.unwrap_or(100);
    
    let sightings = if let Some(profile_id) = query.profile_id {
        state
            .sighting_repo
            .find_by_profile(profile_id, limit)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    } else {
        let range = TimeRange {
            start: query.start.unwrap_or_else(|| Utc::now() - chrono::Duration::days(1)),
            end: query.end.unwrap_or_else(Utc::now),
        };
        
        state
            .query_analytics
            .get_sightings_in_range(range, limit)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
    };

    let responses: Vec<SightingResponse> = sightings.into_iter().map(Into::into).collect();

    Ok(Json(responses))
}

/// GET /api/v1/sightings/:id
pub async fn get_sighting(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<SightingResponse>, StatusCode> {
    let sighting = state
        .sighting_repo
        .find_by_id(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(sighting.into()))
}
