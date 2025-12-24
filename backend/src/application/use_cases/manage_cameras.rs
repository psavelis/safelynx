//! Manage Cameras Use Case
//!
//! Handles camera configuration and management.

use std::sync::Arc;
use uuid::Uuid;

use crate::domain::entities::{Camera, CameraStatus, CameraType};
use crate::domain::repositories::{CameraRepository, RepoResult};
use crate::domain::value_objects::GeoLocation;

/// Request to create a new camera.
#[derive(Debug, Clone)]
pub struct CreateCameraRequest {
    pub name: String,
    pub camera_type: CameraType,
    pub device_id: String,
    pub rtsp_url: Option<String>,
    pub location: Option<GeoLocation>,
}

/// Request to update a camera.
#[derive(Debug, Clone)]
pub struct UpdateCameraRequest {
    pub name: Option<String>,
    pub location: Option<GeoLocation>,
    pub resolution: Option<(i32, i32)>,
    pub fps: Option<i32>,
    pub enabled: Option<bool>,
}

/// Use case for managing cameras.
pub struct ManageCamerasUseCase {
    camera_repo: Arc<dyn CameraRepository>,
}

impl ManageCamerasUseCase {
    /// Creates a new manage cameras use case.
    pub fn new(camera_repo: Arc<dyn CameraRepository>) -> Self {
        Self { camera_repo }
    }

    /// Gets a camera by ID.
    pub async fn get_camera(&self, id: Uuid) -> RepoResult<Option<Camera>> {
        self.camera_repo.find_by_id(id).await
    }

    /// Lists all cameras.
    pub async fn list_cameras(&self) -> RepoResult<Vec<Camera>> {
        self.camera_repo.find_all().await
    }

    /// Lists enabled cameras only.
    pub async fn list_enabled_cameras(&self) -> RepoResult<Vec<Camera>> {
        self.camera_repo.find_enabled().await
    }

    /// Creates a new camera.
    pub async fn create_camera(&self, request: CreateCameraRequest) -> RepoResult<Camera> {
        let mut camera = Camera::new(
            request.name,
            request.camera_type,
            request.device_id,
            request.rtsp_url,
        );

        if let Some(location) = request.location {
            camera.set_location(location);
        }

        self.camera_repo.save(&camera).await?;

        Ok(camera)
    }

    /// Updates a camera.
    pub async fn update_camera(
        &self,
        id: Uuid,
        request: UpdateCameraRequest,
    ) -> RepoResult<Option<Camera>> {
        let camera = match self.camera_repo.find_by_id(id).await? {
            Some(c) => c,
            None => return Ok(None),
        };

        let mut camera = camera;

        if let Some(name) = request.name {
            camera.set_name(name);
        }

        if let Some(location) = request.location {
            camera.set_location(location);
        }

        if let Some((width, height)) = request.resolution {
            camera.set_resolution(width, height);
        }

        if let Some(fps) = request.fps {
            camera.set_fps(fps);
        }

        if let Some(enabled) = request.enabled {
            camera.set_enabled(enabled);
        }

        self.camera_repo.update(&camera).await?;

        Ok(Some(camera))
    }

    /// Deletes a camera.
    pub async fn delete_camera(&self, id: Uuid) -> RepoResult<bool> {
        let camera = self.camera_repo.find_by_id(id).await?;

        if camera.is_none() {
            return Ok(false);
        }

        self.camera_repo.delete(id).await?;
        Ok(true)
    }

    /// Updates camera status.
    pub async fn set_camera_status(&self, id: Uuid, status: CameraStatus) -> RepoResult<bool> {
        let camera = match self.camera_repo.find_by_id(id).await? {
            Some(c) => c,
            None => return Ok(false),
        };

        let mut camera = camera;
        camera.set_status(status);
        self.camera_repo.update(&camera).await?;

        Ok(true)
    }

    /// Enables or disables a camera.
    pub async fn set_camera_enabled(&self, id: Uuid, enabled: bool) -> RepoResult<bool> {
        let camera = match self.camera_repo.find_by_id(id).await? {
            Some(c) => c,
            None => return Ok(false),
        };

        let mut camera = camera;
        camera.set_enabled(enabled);
        self.camera_repo.update(&camera).await?;

        Ok(true)
    }

    /// Creates or ensures the built-in camera exists.
    pub async fn ensure_builtin_camera(&self) -> RepoResult<Camera> {
        let cameras = self.camera_repo.find_all().await?;

        let builtin = cameras
            .into_iter()
            .find(|c| c.camera_type() == CameraType::Builtin);

        match builtin {
            Some(camera) => Ok(camera),
            None => {
                let camera = Camera::builtin();
                self.camera_repo.save(&camera).await?;
                Ok(camera)
            }
        }
    }
}
