//! Profile API Endpoints

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

use crate::application::use_cases::{ProfileStats, UpdateProfileRequest};
use crate::domain::entities::{Profile, ProfileClassification, Sighting};
use crate::infrastructure::server::AppState;

#[derive(Debug, Serialize)]
pub struct ProfileResponse {
    pub id: Uuid,
    pub name: Option<String>,
    pub display_name: String,
    pub classification: ProfileClassification,
    pub thumbnail_url: Option<String>,
    pub tags: Vec<String>,
    pub notes: Option<String>,
    pub first_seen_at: String,
    pub last_seen_at: String,
    pub sighting_count: i64,
    pub is_active: bool,
}

impl From<Profile> for ProfileResponse {
    fn from(p: Profile) -> Self {
        Self {
            id: p.id(),
            name: p.name().map(String::from),
            display_name: p.display_name(),
            classification: p.classification(),
            thumbnail_url: p
                .thumbnail_path()
                .map(|p| format!("/files/snapshots/{}", p)),
            tags: p.tags().iter().map(|t| t.value().to_string()).collect(),
            notes: p.notes().map(String::from),
            first_seen_at: p.first_seen_at().to_rfc3339(),
            last_seen_at: p.last_seen_at().to_rfc3339(),
            sighting_count: p.sighting_count(),
            is_active: p.is_active(),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ProfileListResponse {
    pub profiles: Vec<ProfileResponse>,
    pub total: usize,
    pub stats: ProfileStatsResponse,
}

#[derive(Debug, Serialize)]
pub struct ProfileStatsResponse {
    pub total: i64,
    pub trusted: i64,
    pub known: i64,
    pub unknown: i64,
    pub flagged: i64,
    pub total_sightings: i64,
}

impl From<ProfileStats> for ProfileStatsResponse {
    fn from(s: ProfileStats) -> Self {
        Self {
            total: s.total,
            trusted: s.trusted,
            known: s.known,
            unknown: s.unknown,
            flagged: s.flagged,
            total_sightings: s.total_sightings,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileBody {
    pub name: Option<String>,
    pub classification: Option<ProfileClassification>,
    pub notes: Option<String>,
    pub tags_to_add: Option<Vec<String>>,
    pub tags_to_remove: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct SightingsQuery {
    pub limit: Option<i64>,
}

/// GET /api/v1/profiles
pub async fn list_profiles(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ProfileListResponse>, StatusCode> {
    let profiles = state
        .manage_profiles
        .list_profiles()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let stats = state
        .manage_profiles
        .get_stats()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let total = profiles.len();
    let profiles: Vec<ProfileResponse> = profiles.into_iter().map(Into::into).collect();

    Ok(Json(ProfileListResponse {
        profiles,
        total,
        stats: stats.into(),
    }))
}

/// GET /api/v1/profiles/:id
pub async fn get_profile(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<ProfileResponse>, StatusCode> {
    let profile = state
        .manage_profiles
        .get_profile(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(profile.into()))
}

/// PUT /api/v1/profiles/:id
pub async fn update_profile(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateProfileBody>,
) -> Result<Json<ProfileResponse>, StatusCode> {
    let request = UpdateProfileRequest {
        name: body.name,
        classification: body.classification,
        notes: body.notes,
        tags_to_add: body.tags_to_add.unwrap_or_default(),
        tags_to_remove: body.tags_to_remove.unwrap_or_default(),
    };

    let profile = state
        .manage_profiles
        .update_profile(id, request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(profile.into()))
}

/// DELETE /api/v1/profiles/:id
pub async fn delete_profile(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let deleted = state
        .manage_profiles
        .deactivate_profile(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// GET /api/v1/profiles/:id/sightings
pub async fn get_profile_sightings(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Query(query): Query<SightingsQuery>,
) -> Result<Json<Vec<SightingResponse>>, StatusCode> {
    let limit = query.limit.unwrap_or(100);

    let sightings = state
        .sighting_repo
        .find_by_profile(id, limit)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let responses: Vec<SightingResponse> = sightings.into_iter().map(Into::into).collect();

    Ok(Json(responses))
}

#[derive(Debug, Serialize)]
pub struct SightingResponse {
    pub id: Uuid,
    pub profile_id: Uuid,
    pub camera_id: Uuid,
    pub snapshot_url: String,
    pub confidence: f32,
    pub location: Option<LocationResponse>,
    pub detected_at: String,
}

#[derive(Debug, Serialize)]
pub struct LocationResponse {
    pub latitude: f64,
    pub longitude: f64,
}

impl From<Sighting> for SightingResponse {
    fn from(s: Sighting) -> Self {
        Self {
            id: s.id(),
            profile_id: s.profile_id(),
            camera_id: s.camera_id(),
            snapshot_url: format!("/files/snapshots/{}", s.snapshot_path()),
            confidence: s.confidence(),
            location: s.location().map(|l| LocationResponse {
                latitude: l.latitude(),
                longitude: l.longitude(),
            }),
            detected_at: s.detected_at().to_rfc3339(),
        }
    }
}
