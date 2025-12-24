//! Camera Entity
//!
//! Represents a camera source for face detection.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::value_objects::GeoLocation;

/// Type of camera source.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "camera_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum CameraType {
    /// Built-in MacBook camera (FaceTime HD)
    Builtin,
    /// External USB camera
    Usb,
    /// IP camera with RTSP stream
    Rtsp,
    /// Browser-based camera (WebRTC)
    Browser,
}

/// Camera status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "camera_status", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum CameraStatus {
    /// Camera is online and active
    Active,
    /// Camera is configured but not currently streaming
    Inactive,
    /// Camera encountered an error
    Error,
    /// Camera is disconnected
    Disconnected,
}

/// A camera entity representing a video source.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Camera {
    id: Uuid,
    name: String,
    camera_type: CameraType,
    device_id: String,
    rtsp_url: Option<String>,
    location: Option<GeoLocation>,
    status: CameraStatus,
    resolution_width: i32,
    resolution_height: i32,
    fps: i32,
    is_enabled: bool,
    last_frame_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl Camera {
    /// Creates a new camera configuration.
    pub fn new(
        name: String,
        camera_type: CameraType,
        device_id: String,
        rtsp_url: Option<String>,
    ) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name,
            camera_type,
            device_id,
            rtsp_url,
            location: None,
            status: CameraStatus::Inactive,
            resolution_width: 1280,
            resolution_height: 720,
            fps: 30,
            is_enabled: true,
            last_frame_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    /// Creates a camera for the built-in MacBook camera.
    pub fn builtin() -> Self {
        Self::new(
            "Built-in Camera".to_string(),
            CameraType::Builtin,
            "0".to_string(),
            None,
        )
    }

    /// Reconstructs a camera from database fields.
    #[allow(clippy::too_many_arguments)]
    pub fn from_db(
        id: Uuid,
        name: String,
        camera_type: CameraType,
        device_id: String,
        rtsp_url: Option<String>,
        location: Option<GeoLocation>,
        status: CameraStatus,
        resolution_width: i32,
        resolution_height: i32,
        fps: i32,
        is_enabled: bool,
        last_frame_at: Option<DateTime<Utc>>,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    ) -> Self {
        Self {
            id,
            name,
            camera_type,
            device_id,
            rtsp_url,
            location,
            status,
            resolution_width,
            resolution_height,
            fps,
            is_enabled,
            last_frame_at,
            created_at,
            updated_at,
        }
    }

    pub fn id(&self) -> Uuid {
        self.id
    }

    pub fn name(&self) -> &str {
        &self.name
    }

    pub fn camera_type(&self) -> CameraType {
        self.camera_type
    }

    pub fn device_id(&self) -> &str {
        &self.device_id
    }

    pub fn rtsp_url(&self) -> Option<&str> {
        self.rtsp_url.as_deref()
    }

    pub fn location(&self) -> Option<&GeoLocation> {
        self.location.as_ref()
    }

    pub fn status(&self) -> CameraStatus {
        self.status
    }

    pub fn resolution(&self) -> (i32, i32) {
        (self.resolution_width, self.resolution_height)
    }

    pub fn fps(&self) -> i32 {
        self.fps
    }

    pub fn is_enabled(&self) -> bool {
        self.is_enabled
    }

    pub fn last_frame_at(&self) -> Option<DateTime<Utc>> {
        self.last_frame_at
    }

    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    pub fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }

    /// Updates camera status.
    pub fn set_status(&mut self, status: CameraStatus) {
        self.status = status;
        self.updated_at = Utc::now();
    }

    /// Updates the last frame timestamp.
    pub fn update_last_frame(&mut self) {
        self.last_frame_at = Some(Utc::now());
        if self.status != CameraStatus::Active {
            self.status = CameraStatus::Active;
        }
    }

    /// Enables or disables the camera.
    pub fn set_enabled(&mut self, enabled: bool) {
        self.is_enabled = enabled;
        if !enabled {
            self.status = CameraStatus::Inactive;
        }
        self.updated_at = Utc::now();
    }

    /// Sets the camera location.
    pub fn set_location(&mut self, location: GeoLocation) {
        self.location = Some(location);
        self.updated_at = Utc::now();
    }

    /// Updates camera name.
    pub fn set_name(&mut self, name: String) {
        self.name = name;
        self.updated_at = Utc::now();
    }

    /// Updates resolution.
    pub fn set_resolution(&mut self, width: i32, height: i32) {
        self.resolution_width = width;
        self.resolution_height = height;
        self.updated_at = Utc::now();
    }

    /// Updates FPS.
    pub fn set_fps(&mut self, fps: i32) {
        self.fps = fps;
        self.updated_at = Utc::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_camera_has_correct_type() {
        let camera = Camera::builtin();
        assert_eq!(camera.camera_type(), CameraType::Builtin);
        assert_eq!(camera.name(), "Built-in Camera");
    }

    #[test]
    fn new_camera_is_inactive() {
        let camera = Camera::builtin();
        assert_eq!(camera.status(), CameraStatus::Inactive);
    }

    #[test]
    fn update_last_frame_sets_active() {
        let mut camera = Camera::builtin();
        camera.update_last_frame();
        assert_eq!(camera.status(), CameraStatus::Active);
        assert!(camera.last_frame_at().is_some());
    }

    #[test]
    fn disable_camera_sets_inactive() {
        let mut camera = Camera::builtin();
        camera.update_last_frame();
        camera.set_enabled(false);
        assert_eq!(camera.status(), CameraStatus::Inactive);
        assert!(!camera.is_enabled());
    }
}
