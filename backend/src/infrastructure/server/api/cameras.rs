//! Camera API Endpoints

use axum::{
    body::Body,
    extract::{Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;
use futures_util::stream::StreamExt;
use tokio_stream::wrappers::BroadcastStream;

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
                ResolutionResponse {
                    width: w,
                    height: h,
                }
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
        location: body
            .location
            .map(|l| GeoLocation::with_metadata(l.latitude, l.longitude, None, None, l.name)),
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
        location: body
            .location
            .map(|l| GeoLocation::with_metadata(l.latitude, l.longitude, None, None, l.name)),
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

/// GET /api/v1/cameras/:id/mjpeg - MJPEG video stream
pub async fn mjpeg_stream(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Response, StatusCode> {
    tracing::info!("MJPEG stream requested for camera: {}", id);

    // Get the frame receiver from camera service
    let receiver = state
        .camera_service
        .subscribe_frames(id)
        .await
        .ok_or_else(|| {
            tracing::error!("Camera {} not found or no frame subscription available", id);
            StatusCode::NOT_FOUND
        })?;

    tracing::info!("Successfully subscribed to camera {} frame stream", id);

    // Create MJPEG boundary
    let boundary = "frame";

    // Convert frames to MJPEG stream
    let stream = BroadcastStream::new(receiver).filter_map(move |result| {
        async move {
            match result {
                Ok(frame) => {
                    tracing::debug!(
                        "Received frame: {}x{}, {} bytes",
                        frame.width,
                        frame.height,
                        frame.data.len()
                    );
                    // Encode frame as JPEG
                    match encode_jpeg(&frame.data, frame.width, frame.height) {
                        Ok(jpeg_data) => {
                            tracing::debug!("Encoded JPEG: {} bytes", jpeg_data.len());
                            let header = format!(
                                "--{}\r\nContent-Type: image/jpeg\r\nContent-Length: {}\r\n\r\n",
                                boundary,
                                jpeg_data.len()
                            );
                            let mut data = header.into_bytes();
                            data.extend(jpeg_data);
                            data.extend(b"\r\n");
                            Some(Ok::<_, std::io::Error>(data))
                        }
                        Err(e) => {
                            tracing::error!("JPEG encoding failed: {}", e);
                            None
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Frame receive error: {:?}", e);
                    None
                }
            }
        }
    });

    let body = Body::from_stream(stream);

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(
            "Content-Type",
            format!("multipart/x-mixed-replace; boundary={}", boundary),
        )
        .header("Cache-Control", "no-cache")
        .header("Connection", "keep-alive")
        .body(body)
        .unwrap())
}

/// Encode frame data to JPEG
/// nokhwa returns data in various formats depending on the camera, so we need to handle this
fn encode_jpeg(frame_data: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    use image::{DynamicImage, ImageBuffer, Rgb, Rgba};
    use std::io::Cursor;

    let expected_rgb = (width * height * 3) as usize;
    let expected_rgba = (width * height * 4) as usize;

    tracing::debug!(
        "encode_jpeg: data_len={}, width={}, height={}, expected_rgb={}, expected_rgba={}",
        frame_data.len(),
        width,
        height,
        expected_rgb,
        expected_rgba
    );

    let img: DynamicImage = if frame_data.len() == expected_rgb {
        // Standard RGB format
        let img_buf: ImageBuffer<Rgb<u8>, _> =
            ImageBuffer::from_raw(width, height, frame_data.to_vec())
                .ok_or("Failed to create RGB image buffer")?;
        DynamicImage::ImageRgb8(img_buf)
    } else if frame_data.len() == expected_rgba {
        // RGBA format (common on macOS AVFoundation)
        let img_buf: ImageBuffer<Rgba<u8>, _> =
            ImageBuffer::from_raw(width, height, frame_data.to_vec())
                .ok_or("Failed to create RGBA image buffer")?;
        DynamicImage::ImageRgba8(img_buf)
    } else {
        // Try to decode as raw format - nokhwa sometimes returns unusual buffer sizes
        // Fall back to trying RGB with clipping
        let actual_pixels = frame_data.len() / 3;
        tracing::warn!(
            "Unexpected frame size: {} bytes for {}x{} (expected {} RGB or {} RGBA). Actual pixels: {}",
            frame_data.len(),
            width,
            height,
            expected_rgb,
            expected_rgba,
            actual_pixels
        );

        // Try to infer dimensions if buffer is smaller
        if frame_data.len() >= expected_rgb {
            // Just use what we need
            let img_buf: ImageBuffer<Rgb<u8>, _> =
                ImageBuffer::from_raw(width, height, frame_data[..expected_rgb].to_vec())
                    .ok_or("Failed to create truncated RGB buffer")?;
            DynamicImage::ImageRgb8(img_buf)
        } else {
            return Err(format!(
                "Frame buffer too small: {} bytes for {}x{} image",
                frame_data.len(),
                width,
                height
            ));
        }
    };

    let mut buffer = Cursor::new(Vec::new());
    img.write_to(&mut buffer, image::ImageFormat::Jpeg)
        .map_err(|e| format!("JPEG encoding failed: {}", e))?;

    Ok(buffer.into_inner())
}
