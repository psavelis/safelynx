//! Domain Events
//!
//! Events that represent significant occurrences in the domain.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::entities::ProfileClassification;
use crate::domain::value_objects::{BoundingBox, GeoLocation};

/// A domain event that can be broadcast to subscribers.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DomainEvent {
    /// A new profile was created from an unknown face.
    ProfileCreated(ProfileCreatedEvent),
    /// A face was detected in a frame.
    FaceDetected(FaceDetectedEvent),
    /// A known profile was spotted.
    ProfileSighted(ProfileSightedEvent),
    /// A recording started.
    RecordingStarted(RecordingStartedEvent),
    /// A recording ended.
    RecordingEnded(RecordingEndedEvent),
    /// A camera status changed.
    CameraStatusChanged(CameraStatusChangedEvent),
    /// Detection settings changed.
    SettingsChanged(SettingsChangedEvent),
}

/// Event emitted when a new profile is created.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileCreatedEvent {
    pub profile_id: Uuid,
    pub thumbnail_path: Option<String>,
    pub camera_id: Uuid,
    pub location: Option<GeoLocation>,
    pub timestamp: DateTime<Utc>,
}

/// Event emitted for each face detection in a frame.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceDetectedEvent {
    pub camera_id: Uuid,
    pub frame_number: u64,
    pub bounding_box: BoundingBox,
    pub confidence: f32,
    pub profile_id: Option<Uuid>,
    pub profile_name: Option<String>,
    pub classification: Option<ProfileClassification>,
    pub timestamp: DateTime<Utc>,
}

/// Event emitted when a known profile is sighted.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileSightedEvent {
    pub sighting_id: Uuid,
    pub profile_id: Uuid,
    pub profile_name: Option<String>,
    pub classification: ProfileClassification,
    pub camera_id: Uuid,
    pub location: Option<GeoLocation>,
    pub confidence: f32,
    pub timestamp: DateTime<Utc>,
}

/// Event emitted when recording starts.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingStartedEvent {
    pub recording_id: Uuid,
    pub camera_id: Uuid,
    pub timestamp: DateTime<Utc>,
}

/// Event emitted when recording ends.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingEndedEvent {
    pub recording_id: Uuid,
    pub camera_id: Uuid,
    pub duration_ms: i64,
    pub file_size_bytes: i64,
    pub has_detections: bool,
    pub timestamp: DateTime<Utc>,
}

/// Event emitted when camera status changes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraStatusChangedEvent {
    pub camera_id: Uuid,
    pub camera_name: String,
    pub status: String,
    pub timestamp: DateTime<Utc>,
}

/// Event emitted when settings change.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SettingsChangedEvent {
    pub category: String,
    pub timestamp: DateTime<Utc>,
}

impl DomainEvent {
    /// Returns the event timestamp.
    pub fn timestamp(&self) -> DateTime<Utc> {
        match self {
            DomainEvent::ProfileCreated(e) => e.timestamp,
            DomainEvent::FaceDetected(e) => e.timestamp,
            DomainEvent::ProfileSighted(e) => e.timestamp,
            DomainEvent::RecordingStarted(e) => e.timestamp,
            DomainEvent::RecordingEnded(e) => e.timestamp,
            DomainEvent::CameraStatusChanged(e) => e.timestamp,
            DomainEvent::SettingsChanged(e) => e.timestamp,
        }
    }

    /// Returns the event type name.
    pub fn event_type(&self) -> &'static str {
        match self {
            DomainEvent::ProfileCreated(_) => "profile_created",
            DomainEvent::FaceDetected(_) => "face_detected",
            DomainEvent::ProfileSighted(_) => "profile_sighted",
            DomainEvent::RecordingStarted(_) => "recording_started",
            DomainEvent::RecordingEnded(_) => "recording_ended",
            DomainEvent::CameraStatusChanged(_) => "camera_status_changed",
            DomainEvent::SettingsChanged(_) => "settings_changed",
        }
    }
}
