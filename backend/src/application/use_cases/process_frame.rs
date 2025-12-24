//! Process Frame Use Case
//!
//! Handles the complete pipeline for processing a video frame.

use std::sync::Arc;
use uuid::Uuid;

use crate::application::services::{DetectionService, RecordingService, StorageManager};
use crate::domain::entities::FrameDetections;
use crate::domain::repositories::RepoResult;

/// Use case for processing a video frame through the detection pipeline.
pub struct ProcessFrameUseCase {
    detection_service: Arc<DetectionService>,
    recording_service: Arc<RecordingService>,
    storage_manager: Arc<StorageManager>,
}

impl ProcessFrameUseCase {
    /// Creates a new process frame use case.
    pub fn new(
        detection_service: Arc<DetectionService>,
        recording_service: Arc<RecordingService>,
        storage_manager: Arc<StorageManager>,
    ) -> Self {
        Self {
            detection_service,
            recording_service,
            storage_manager,
        }
    }

    /// Processes a frame with detections.
    ///
    /// This orchestrates:
    /// 1. Face matching and profile creation
    /// 2. Recording management
    /// 3. Storage cleanup if needed
    pub async fn execute(&self, frame: &mut FrameDetections) -> RepoResult<ProcessFrameResult> {
        let snapshot_dir = self.storage_manager.snapshots_dir().await;
        let snapshot_dir_str = snapshot_dir.to_string_lossy().to_string();

        let created_profiles = self
            .detection_service
            .process_frame(frame, &snapshot_dir_str)
            .await?;

        let camera_id = frame.camera_id();

        if frame.has_faces() {
            self.recording_service.on_detection(camera_id).await?;
        }

        let recording_stopped = self.recording_service.check_timeout(camera_id).await?;

        let cleanup_performed = self.storage_manager.check_and_cleanup().await?;

        Ok(ProcessFrameResult {
            created_profiles,
            face_count: frame.face_count(),
            recording_stopped,
            cleanup_performed,
        })
    }
}

/// Result of processing a frame.
#[derive(Debug, Default)]
pub struct ProcessFrameResult {
    /// IDs of newly created profiles.
    pub created_profiles: Vec<Uuid>,
    /// Number of faces detected.
    pub face_count: usize,
    /// Whether a recording was stopped due to timeout.
    pub recording_stopped: bool,
    /// Whether storage cleanup was performed.
    pub cleanup_performed: bool,
}
