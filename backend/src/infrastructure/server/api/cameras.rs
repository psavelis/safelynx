//! Camera API Endpoints

use std::sync::Arc;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::application::use_cases::{CreateCameraRequest, UpdateCameraRequest};
use crate::domain::entities::{Camera, CameraStatus, CameraType};
use crate::domain::value_objects::GeoLocation;
use crate::infrastructure::camera::list_cameras as list_system_cameras;
use crate::infrastructure::server::AppState;

#[derive(Debug, Serialize)]
pub struct CameraResponse {
    pub id: Uuid,
    pub name: String,
    pub camera_type: CameraType,
    pub device_id: String,
    pub rtsp_url: Option<String>,
    pub location: Option<LocationResponse>,
    pub status: CameraStatus,
    pub resolution: ResolutionResponse,
    pub fps: i32,
    pub is_enabled: bool,
    pub last_frame_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct LocationResponse {
    pub latitude: f64,
    pub longitude: f64,
    pub name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ResolutionResponse {
    pub width: i32,
    pub height: i32,
}

impl From<Camera> for CameraResponse {
    fn from(c: Camera) -> Self {
        Self {
            id: c.id(),
            name: c.name().to_string(),
            camera_type: c.camera_type(),
            device_id: c.device_id().to_string(),
            rtsp_url: c.rtsp_url().map(String::from),
            location: c.location().map(|l| LocationResponse {
                latitude: l.latitude(),
                longitude: l.longitude(),
                name: l.name().map(String::from),
            }),
            status: c.status(),
            resolution: {
                let (w, h) = c.resolution();
                ResolutionResponse { width: w, height: h }
            },
            fps: c.fps(),
            is_enabled: c.is_enabled(),
            last_frame_at: c.last_frame_at().map(|t| t.to_rfc3339()),
            created_at: c.created_at().to_rfc3339(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CreateCameraBody {
    pub name: String,
    pub camera_type: CameraType,
    pub device_id: String,
    pub rtsp_url: Option<String>,
    pub location: Option<CreateLocationBody>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLocationBody {
    pub latitude: f64,
    pub longitude: f64,
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCameraBody {
    pub name: Option<String>,
    pub location: Option<CreateLocationBody>,
    pub resolution: Option<ResolutionBody>,
    pub fps: Option<i32>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ResolutionBody {
    pub width: i32,
    pub height: i32,
}

#[derive(Debug, Serialize)]
pub struct AvailableCameraResponse {
    pub index: u32,
    pub name: String,
    pub description: String,
}

/// GET /api/v1/cameras
pub async fn list_cameras(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<CameraResponse>>, StatusCode> {
    let cameras = state
        .manage_cameras
        .list_cameras()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let responses: Vec<CameraResponse> = cameras.into_iter().map(Into::into).collect();

    Ok(Json(responses))
}

/// POST /api/v1/cameras
pub async fn create_camera(
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateCameraBody>,
) -> Result<(StatusCode, Json<CameraResponse>), StatusCode> {
    let request = CreateCameraRequest {
        name: body.name,
        camera_type: body.camera_type,
        device_id: body.device_id,
        rtsp_url: body.rtsp_url,
        location: body.location.map(|l| {
            GeoLocation::with_metadata(l.latitude, l.longitude, None, None, l.name)
        }),
    };

    let camera = state
        .manage_cameras
        .create_camera(request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok((StatusCode::CREATED, Json(camera.into())))
}

/// GET /api/v1/cameras/:id
pub async fn get_camera(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<CameraResponse>, StatusCode> {
    let camera = state
        .manage_cameras
        .get_camera(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(camera.into()))
}

/// PUT /api/v1/cameras/:id
pub async fn update_camera(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCameraBody>,
) -> Result<Json<CameraResponse>, StatusCode> {
    let request = UpdateCameraRequest {
        name: body.name,
        location: body.location.map(|l| {
            GeoLocation::with_metadata(l.latitude, l.longitude, None, None, l.name)
        }),
        resolution: body.resolution.map(|r| (r.width, r.height)),
        fps: body.fps,
        enabled: body.enabled,
    };

    let camera = state
        .manage_cameras
        .update_camera(id, request)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(camera.into()))
}

/// DELETE /api/v1/cameras/:id
pub async fn delete_camera(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    let deleted = state
        .manage_cameras
        .delete_camera(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

/// POST /api/v1/cameras/:id/stream/start
pub async fn start_stream(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    state
        .manage_cameras
        .set_camera_enabled(id, true)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

/// POST /api/v1/cameras/:id/stream/stop
pub async fn stop_stream(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, StatusCode> {
    state
        .manage_cameras
        .set_camera_enabled(id, false)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(StatusCode::OK)
}

/// GET /api/v1/cameras/available
pub async fn list_available_cameras() -> Json<Vec<AvailableCameraResponse>> {
    let cameras = list_system_cameras();
    
    let responses: Vec<AvailableCameraResponse> = cameras
        .into_iter()
        .map(|c| AvailableCameraResponse {
            index: c.index,
            name: c.name,
            description: c.description,
        })
        .collect();

    Json(responses)
}
