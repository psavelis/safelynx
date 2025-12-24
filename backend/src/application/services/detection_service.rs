//! Detection Service
//!
//! Orchestrates face detection, embedding extraction, and profile matching.

use std::sync::Arc;
use chrono::Utc;
use tokio::sync::RwLock;
use tracing::{debug, info};
use uuid::Uuid;

use crate::application::services::{EventBus, FaceMatcher};
use crate::domain::entities::{FrameDetections, Profile, Sighting};
use crate::domain::events::{
    DomainEvent, FaceDetectedEvent, ProfileCreatedEvent, ProfileSightedEvent,
};
use crate::domain::repositories::{ProfileRepository, RepoResult, SightingRepository};
use crate::domain::value_objects::{BoundingBox, FaceEmbedding, GeoLocation};

/// Configuration for the detection service.
#[derive(Debug, Clone)]
pub struct DetectionConfig {
    /// Minimum confidence for face detection.
    pub min_confidence: f32,
    /// Threshold for face matching.
    pub match_threshold: f32,
    /// Cooldown between sightings of the same profile (seconds).
    pub sighting_cooldown_secs: i64,
}

impl Default for DetectionConfig {
    fn default() -> Self {
        Self {
            min_confidence: 0.7,
            match_threshold: 0.6,
            sighting_cooldown_secs: 30,
        }
    }
}

/// Tracks recent sightings to prevent duplicates.
struct SightingTracker {
    recent: std::collections::HashMap<Uuid, chrono::DateTime<Utc>>,
    cooldown_secs: i64,
}

impl SightingTracker {
    fn new(cooldown_secs: i64) -> Self {
        Self {
            recent: std::collections::HashMap::new(),
            cooldown_secs,
        }
    }

    fn should_record(&mut self, profile_id: Uuid) -> bool {
        let now = Utc::now();
        
        if let Some(last_seen) = self.recent.get(&profile_id) {
            let elapsed = (now - *last_seen).num_seconds();
            if elapsed < self.cooldown_secs {
                return false;
            }
        }
        
        self.recent.insert(profile_id, now);
        true
    }

    fn cleanup(&mut self) {
        let now = Utc::now();
        self.recent.retain(|_, last_seen| {
            (now - *last_seen).num_seconds() < self.cooldown_secs * 2
        });
    }
}

/// Service for processing face detections.
pub struct DetectionService {
    profile_repo: Arc<dyn ProfileRepository>,
    sighting_repo: Arc<dyn SightingRepository>,
    face_matcher: Arc<FaceMatcher>,
    event_bus: Arc<EventBus>,
    config: RwLock<DetectionConfig>,
    sighting_tracker: RwLock<SightingTracker>,
    current_location: RwLock<Option<GeoLocation>>,
}

impl DetectionService {
    /// Creates a new detection service.
    pub fn new(
        profile_repo: Arc<dyn ProfileRepository>,
        sighting_repo: Arc<dyn SightingRepository>,
        face_matcher: Arc<FaceMatcher>,
        event_bus: Arc<EventBus>,
        config: DetectionConfig,
    ) -> Self {
        let cooldown = config.sighting_cooldown_secs;
        Self {
            profile_repo,
            sighting_repo,
            face_matcher,
            event_bus,
            config: RwLock::new(config),
            sighting_tracker: RwLock::new(SightingTracker::new(cooldown)),
            current_location: RwLock::new(None),
        }
    }

    /// Updates the current device location.
    pub async fn set_location(&self, location: GeoLocation) {
        *self.current_location.write().await = Some(location);
    }

    /// Updates the detection configuration.
    pub async fn update_config(&self, config: DetectionConfig) {
        let cooldown = config.sighting_cooldown_secs;
        *self.config.write().await = config;
        self.sighting_tracker.write().await.cooldown_secs = cooldown;
    }

    /// Processes a frame with face detections.
    pub async fn process_frame(
        &self,
        frame: &mut FrameDetections,
        snapshot_dir: &str,
    ) -> RepoResult<Vec<Uuid>> {
        let config = self.config.read().await.clone();
        let location = self.current_location.read().await.clone();
        let mut created_profiles = Vec::new();

        // Get frame data before iterating
        let camera_id = frame.camera_id();
        let frame_number = frame.frame_number();
        let frame_data = frame.frame_data().map(|d| d.to_vec());

        // First pass: collect processing results for each detection
        let detection_count = frame.detections().len();
        let mut results: Vec<Option<(Uuid, Option<String>, crate::domain::entities::ProfileClassification, bool, f32, BoundingBox, f32)>> = 
            Vec::with_capacity(detection_count);

        for detection in frame.detections() {
            if detection.confidence() < config.min_confidence {
                results.push(None);
                continue;
            }

            let embedding = match detection.embedding() {
                Some(e) => e.clone(),
                None => {
                    results.push(None);
                    continue;
                }
            };

            let bbox = detection.bounding_box().clone();
            let confidence = detection.confidence();

            let result = match self.face_matcher.find_match(&embedding).await {
                Some(match_result) => {
                    let profile = self.profile_repo
                        .find_by_id(match_result.profile_id)
                        .await?;
                    
                    match profile {
                        Some(p) => Some((p.id(), p.name().map(String::from), p.classification(), false, match_result.distance, bbox, confidence)),
                        None => None,
                    }
                }
                None => {
                    let profile = self.create_profile_from_detection(
                        embedding.clone(),
                        &bbox,
                        camera_id,
                        frame_number,
                        frame_data.as_deref(),
                        snapshot_dir,
                    ).await?;
                    
                    let profile_id = profile.id();
                    created_profiles.push(profile_id);
                    
                    self.event_bus.publish(DomainEvent::ProfileCreated(ProfileCreatedEvent {
                        profile_id,
                        thumbnail_path: profile.thumbnail_path().map(String::from),
                        camera_id,
                        location: location.clone(),
                        timestamp: Utc::now(),
                    }));
                    
                    Some((profile_id, None, profile.classification(), true, 0.0, bbox, confidence))
                }
            };
            results.push(result);
        }

        // Second pass: update detections and process sightings
        for (i, detection) in frame.detections_mut().iter_mut().enumerate() {
            if let Some(Some((profile_id, profile_name, classification, is_new, distance, ref bbox, confidence))) = results.get(i) {
                if !*is_new {
                    detection.set_match(*profile_id, *distance);
                }

                self.event_bus.publish(DomainEvent::FaceDetected(FaceDetectedEvent {
                    camera_id,
                    frame_number,
                    bounding_box: bbox.clone(),
                    confidence: *confidence,
                    profile_id: Some(*profile_id),
                    profile_name: profile_name.clone(),
                    classification: Some(*classification),
                    timestamp: Utc::now(),
                }));

                if !*is_new {
                    self.record_sighting_data(
                        *profile_id,
                        profile_name.clone(),
                        *classification,
                        camera_id,
                        bbox,
                        *confidence,
                        frame_data.as_deref(),
                        snapshot_dir,
                        location.clone(),
                    ).await?;
                }
            }
        }

        self.cleanup_tracker().await;
        
        Ok(created_profiles)
    }

    async fn create_profile_from_detection(
        &self,
        embedding: FaceEmbedding,
        bbox: &BoundingBox,
        camera_id: Uuid,
        _frame_number: u64,
        image_data: Option<&[u8]>,
        snapshot_dir: &str,
    ) -> RepoResult<Profile> {
        let thumbnail_path = self.save_thumbnail_from_data(image_data, bbox, snapshot_dir).await;
        let profile = Profile::new(embedding.clone(), thumbnail_path);
        
        self.profile_repo.save(&profile).await?;
        self.face_matcher.add_to_cache(profile.id(), embedding).await;
        
        info!("Created new profile: {} from camera {}", profile.id(), camera_id);
        
        Ok(profile)
    }

    async fn record_sighting_data(
        &self,
        profile_id: Uuid,
        profile_name: Option<String>,
        classification: crate::domain::entities::ProfileClassification,
        camera_id: Uuid,
        bbox: &BoundingBox,
        confidence: f32,
        image_data: Option<&[u8]>,
        snapshot_dir: &str,
        location: Option<GeoLocation>,
    ) -> RepoResult<()> {
        let mut tracker = self.sighting_tracker.write().await;
        if !tracker.should_record(profile_id) {
            debug!("Skipping sighting for {} (cooldown active)", profile_id);
            return Ok(());
        }
        drop(tracker);

        let snapshot_path = self.save_snapshot_from_data(image_data, snapshot_dir).await
            .unwrap_or_else(|| "unknown".to_string());

        let sighting = Sighting::new(
            profile_id,
            camera_id,
            snapshot_path,
            bbox.clone(),
            confidence,
            location.clone(),
        );

        self.sighting_repo.save(&sighting).await?;

        if let Some(mut profile) = self.profile_repo.find_by_id(profile_id).await? {
            profile.record_sighting();
            self.profile_repo.update(&profile).await?;
        }

        self.event_bus.publish(DomainEvent::ProfileSighted(ProfileSightedEvent {
            sighting_id: sighting.id(),
            profile_id,
            profile_name,
            classification,
            camera_id,
            location,
            confidence,
            timestamp: Utc::now(),
        }));

        Ok(())
    }

    async fn save_thumbnail_from_data(
        &self,
        _image_data: Option<&[u8]>,
        _bbox: &BoundingBox,
        snapshot_dir: &str,
    ) -> Option<String> {
        let filename = format!("{}/thumb_{}.jpg", snapshot_dir, Uuid::new_v4());
        Some(filename)
    }

    async fn save_snapshot_from_data(
        &self,
        _image_data: Option<&[u8]>,
        snapshot_dir: &str,
    ) -> Option<String> {
        let filename = format!("{}/snap_{}.jpg", snapshot_dir, Uuid::new_v4());
        Some(filename)
    }

    async fn cleanup_tracker(&self) {
        let mut tracker = self.sighting_tracker.write().await;
        tracker.cleanup();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sighting_tracker_respects_cooldown() {
        let mut tracker = SightingTracker::new(30);
        let profile_id = Uuid::new_v4();
        
        assert!(tracker.should_record(profile_id));
        assert!(!tracker.should_record(profile_id));
    }

    #[test]
    fn default_config_has_reasonable_values() {
        let config = DetectionConfig::default();
        assert!(config.min_confidence > 0.5);
        assert!(config.match_threshold > 0.0);
        assert!(config.sighting_cooldown_secs > 0);
    }
}
