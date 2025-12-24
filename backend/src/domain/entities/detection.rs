//! Detection Entity
//!
//! Represents a face detection result from a single frame.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::value_objects::{BoundingBox, FaceEmbedding};

/// A face detection from a video frame.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Detection {
    bounding_box: BoundingBox,
    confidence: f32,
    embedding: Option<FaceEmbedding>,
    matched_profile_id: Option<Uuid>,
    match_distance: Option<f32>,
}

impl Detection {
    /// Creates a new detection result.
    pub fn new(bounding_box: BoundingBox, confidence: f32) -> Self {
        Self {
            bounding_box,
            confidence,
            embedding: None,
            matched_profile_id: None,
            match_distance: None,
        }
    }

    pub fn bounding_box(&self) -> &BoundingBox {
        &self.bounding_box
    }

    pub fn confidence(&self) -> f32 {
        self.confidence
    }

    pub fn embedding(&self) -> Option<&FaceEmbedding> {
        self.embedding.as_ref()
    }

    pub fn matched_profile_id(&self) -> Option<Uuid> {
        self.matched_profile_id
    }

    pub fn match_distance(&self) -> Option<f32> {
        self.match_distance
    }

    /// Sets the face embedding for this detection.
    pub fn set_embedding(&mut self, embedding: FaceEmbedding) {
        self.embedding = Some(embedding);
    }

    /// Records a profile match.
    pub fn set_match(&mut self, profile_id: Uuid, distance: f32) {
        self.matched_profile_id = Some(profile_id);
        self.match_distance = Some(distance);
    }

    /// Returns whether this detection matches a known profile.
    pub fn is_matched(&self) -> bool {
        self.matched_profile_id.is_some()
    }
}

/// A frame with its detections.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrameDetections {
    camera_id: Uuid,
    frame_number: u64,
    timestamp_ms: i64,
    detections: Vec<Detection>,
    frame_data: Option<Vec<u8>>,
}

impl FrameDetections {
    /// Creates a new frame detection result.
    pub fn new(camera_id: Uuid, frame_number: u64, timestamp_ms: i64) -> Self {
        Self {
            camera_id,
            frame_number,
            timestamp_ms,
            detections: Vec::new(),
            frame_data: None,
        }
    }

    pub fn camera_id(&self) -> Uuid {
        self.camera_id
    }

    pub fn frame_number(&self) -> u64 {
        self.frame_number
    }

    pub fn timestamp_ms(&self) -> i64 {
        self.timestamp_ms
    }

    pub fn detections(&self) -> &[Detection] {
        &self.detections
    }

    pub fn detections_mut(&mut self) -> &mut Vec<Detection> {
        &mut self.detections
    }

    pub fn frame_data(&self) -> Option<&[u8]> {
        self.frame_data.as_deref()
    }

    /// Adds a detection to this frame.
    pub fn add_detection(&mut self, detection: Detection) {
        self.detections.push(detection);
    }

    /// Sets the frame image data (JPEG encoded).
    pub fn set_frame_data(&mut self, data: Vec<u8>) {
        self.frame_data = Some(data);
    }

    /// Returns the number of faces detected.
    pub fn face_count(&self) -> usize {
        self.detections.len()
    }

    /// Returns true if any faces were detected.
    pub fn has_faces(&self) -> bool {
        !self.detections.is_empty()
    }

    /// Returns true if any detection matches a known profile.
    pub fn has_known_faces(&self) -> bool {
        self.detections.iter().any(Detection::is_matched)
    }

    /// Returns true if any detection is an unknown face.
    pub fn has_unknown_faces(&self) -> bool {
        self.detections.iter().any(|d| !d.is_matched())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_detection_has_no_match() {
        let bbox = BoundingBox::new(10, 20, 100, 100);
        let detection = Detection::new(bbox, 0.9);
        assert!(!detection.is_matched());
        assert!(detection.matched_profile_id().is_none());
    }

    #[test]
    fn set_match_marks_detection_as_matched() {
        let bbox = BoundingBox::new(10, 20, 100, 100);
        let mut detection = Detection::new(bbox, 0.9);
        detection.set_match(Uuid::new_v4(), 0.3);
        assert!(detection.is_matched());
    }

    #[test]
    fn empty_frame_has_no_faces() {
        let frame = FrameDetections::new(Uuid::new_v4(), 0, 0);
        assert!(!frame.has_faces());
        assert_eq!(frame.face_count(), 0);
    }

    #[test]
    fn frame_with_detection_has_faces() {
        let mut frame = FrameDetections::new(Uuid::new_v4(), 0, 0);
        let bbox = BoundingBox::new(10, 20, 100, 100);
        frame.add_detection(Detection::new(bbox, 0.9));
        assert!(frame.has_faces());
        assert_eq!(frame.face_count(), 1);
    }
}
