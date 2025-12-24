//! Recording Entity
//!
//! Represents a video recording segment.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Recording status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "recording_status", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum RecordingStatus {
    /// Recording is in progress
    Recording,
    /// Recording completed successfully
    Completed,
    /// Recording was interrupted
    Interrupted,
    /// Recording is being deleted
    Deleting,
}

/// A video recording segment.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recording {
    id: Uuid,
    camera_id: Uuid,
    file_path: String,
    file_size_bytes: i64,
    duration_ms: i64,
    frame_count: i64,
    status: RecordingStatus,
    has_detections: bool,
    started_at: DateTime<Utc>,
    ended_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
}

impl Recording {
    /// Creates a new recording.
    pub fn new(camera_id: Uuid, file_path: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            camera_id,
            file_path,
            file_size_bytes: 0,
            duration_ms: 0,
            frame_count: 0,
            status: RecordingStatus::Recording,
            has_detections: false,
            started_at: now,
            ended_at: None,
            created_at: now,
        }
    }

    /// Reconstructs a recording from database fields.
    #[allow(clippy::too_many_arguments)]
    pub fn from_db(
        id: Uuid,
        camera_id: Uuid,
        file_path: String,
        file_size_bytes: i64,
        duration_ms: i64,
        frame_count: i64,
        status: RecordingStatus,
        has_detections: bool,
        started_at: DateTime<Utc>,
        ended_at: Option<DateTime<Utc>>,
        created_at: DateTime<Utc>,
    ) -> Self {
        Self {
            id,
            camera_id,
            file_path,
            file_size_bytes,
            duration_ms,
            frame_count,
            status,
            has_detections,
            started_at,
            ended_at,
            created_at,
        }
    }

    pub fn id(&self) -> Uuid {
        self.id
    }

    pub fn camera_id(&self) -> Uuid {
        self.camera_id
    }

    pub fn file_path(&self) -> &str {
        &self.file_path
    }

    pub fn file_size_bytes(&self) -> i64 {
        self.file_size_bytes
    }

    pub fn duration_ms(&self) -> i64 {
        self.duration_ms
    }

    pub fn frame_count(&self) -> i64 {
        self.frame_count
    }

    pub fn status(&self) -> RecordingStatus {
        self.status
    }

    pub fn has_detections(&self) -> bool {
        self.has_detections
    }

    pub fn started_at(&self) -> DateTime<Utc> {
        self.started_at
    }

    pub fn ended_at(&self) -> Option<DateTime<Utc>> {
        self.ended_at
    }

    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    /// Updates recording stats during recording.
    pub fn update_stats(&mut self, file_size_bytes: i64, duration_ms: i64, frame_count: i64) {
        self.file_size_bytes = file_size_bytes;
        self.duration_ms = duration_ms;
        self.frame_count = frame_count;
    }

    /// Marks that this recording contains face detections.
    pub fn mark_has_detections(&mut self) {
        self.has_detections = true;
    }

    /// Completes the recording.
    pub fn complete(&mut self, file_size_bytes: i64, duration_ms: i64, frame_count: i64) {
        self.file_size_bytes = file_size_bytes;
        self.duration_ms = duration_ms;
        self.frame_count = frame_count;
        self.status = RecordingStatus::Completed;
        self.ended_at = Some(Utc::now());
    }

    /// Marks the recording as interrupted.
    pub fn interrupt(&mut self) {
        self.status = RecordingStatus::Interrupted;
        self.ended_at = Some(Utc::now());
    }

    /// Marks the recording for deletion.
    pub fn mark_for_deletion(&mut self) {
        self.status = RecordingStatus::Deleting;
    }

    /// Returns true if the recording is still in progress.
    pub fn is_active(&self) -> bool {
        self.status == RecordingStatus::Recording
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_recording_is_recording_status() {
        let recording = Recording::new(Uuid::new_v4(), "/path/to/file.mp4".to_string());
        assert_eq!(recording.status(), RecordingStatus::Recording);
        assert!(recording.is_active());
    }

    #[test]
    fn complete_sets_status_and_end_time() {
        let mut recording = Recording::new(Uuid::new_v4(), "/path/to/file.mp4".to_string());
        recording.complete(1000, 5000, 150);
        
        assert_eq!(recording.status(), RecordingStatus::Completed);
        assert!(!recording.is_active());
        assert!(recording.ended_at().is_some());
        assert_eq!(recording.file_size_bytes(), 1000);
        assert_eq!(recording.duration_ms(), 5000);
        assert_eq!(recording.frame_count(), 150);
    }

    #[test]
    fn mark_has_detections_sets_flag() {
        let mut recording = Recording::new(Uuid::new_v4(), "/path/to/file.mp4".to_string());
        assert!(!recording.has_detections());
        recording.mark_has_detections();
        assert!(recording.has_detections());
    }
}
