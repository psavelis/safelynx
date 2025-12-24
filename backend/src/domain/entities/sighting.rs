//! Sighting Entity
//!
//! Represents a single observation of a profile at a specific time and location.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::value_objects::{BoundingBox, GeoLocation};

/// A sighting records when and where a profile was detected.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Sighting {
    id: Uuid,
    profile_id: Uuid,
    camera_id: Uuid,
    snapshot_path: String,
    bounding_box: BoundingBox,
    confidence: f32,
    location: Option<GeoLocation>,
    recording_id: Option<Uuid>,
    recording_timestamp_ms: Option<i64>,
    detected_at: DateTime<Utc>,
}

impl Sighting {
    /// Creates a new sighting record.
    pub fn new(
        profile_id: Uuid,
        camera_id: Uuid,
        snapshot_path: String,
        bounding_box: BoundingBox,
        confidence: f32,
        location: Option<GeoLocation>,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            profile_id,
            camera_id,
            snapshot_path,
            bounding_box,
            confidence,
            location,
            recording_id: None,
            recording_timestamp_ms: None,
            detected_at: Utc::now(),
        }
    }

    /// Reconstructs a sighting from database fields.
    #[allow(clippy::too_many_arguments)]
    pub fn from_db(
        id: Uuid,
        profile_id: Uuid,
        camera_id: Uuid,
        snapshot_path: String,
        bounding_box: BoundingBox,
        confidence: f32,
        location: Option<GeoLocation>,
        recording_id: Option<Uuid>,
        recording_timestamp_ms: Option<i64>,
        detected_at: DateTime<Utc>,
    ) -> Self {
        Self {
            id,
            profile_id,
            camera_id,
            snapshot_path,
            bounding_box,
            confidence,
            location,
            recording_id,
            recording_timestamp_ms,
            detected_at,
        }
    }

    pub fn id(&self) -> Uuid {
        self.id
    }

    pub fn profile_id(&self) -> Uuid {
        self.profile_id
    }

    pub fn camera_id(&self) -> Uuid {
        self.camera_id
    }

    pub fn snapshot_path(&self) -> &str {
        &self.snapshot_path
    }

    pub fn bounding_box(&self) -> &BoundingBox {
        &self.bounding_box
    }

    pub fn confidence(&self) -> f32 {
        self.confidence
    }

    pub fn location(&self) -> Option<&GeoLocation> {
        self.location.as_ref()
    }

    pub fn recording_id(&self) -> Option<Uuid> {
        self.recording_id
    }

    pub fn recording_timestamp_ms(&self) -> Option<i64> {
        self.recording_timestamp_ms
    }

    pub fn detected_at(&self) -> DateTime<Utc> {
        self.detected_at
    }

    /// Links this sighting to a recording.
    pub fn link_to_recording(&mut self, recording_id: Uuid, timestamp_ms: i64) {
        self.recording_id = Some(recording_id);
        self.recording_timestamp_ms = Some(timestamp_ms);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_sighting_generates_unique_id() {
        let bbox = BoundingBox::new(10, 20, 100, 100);
        let s1 = Sighting::new(Uuid::new_v4(), Uuid::new_v4(), "path".into(), bbox.clone(), 0.9, None);
        let s2 = Sighting::new(Uuid::new_v4(), Uuid::new_v4(), "path".into(), bbox, 0.9, None);
        assert_ne!(s1.id(), s2.id());
    }

    #[test]
    fn link_to_recording_sets_fields() {
        let bbox = BoundingBox::new(10, 20, 100, 100);
        let mut sighting = Sighting::new(Uuid::new_v4(), Uuid::new_v4(), "path".into(), bbox, 0.9, None);
        let recording_id = Uuid::new_v4();
        
        sighting.link_to_recording(recording_id, 5000);
        
        assert_eq!(sighting.recording_id(), Some(recording_id));
        assert_eq!(sighting.recording_timestamp_ms(), Some(5000));
    }
}
