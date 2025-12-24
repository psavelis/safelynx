//! Detection Service
//!
//! Orchestrates face detection, embedding extraction, and profile matching.

use chrono::Utc;
use std::sync::Arc;
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
        self.recent
            .retain(|_, last_seen| (now - *last_seen).num_seconds() < self.cooldown_secs * 2);
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
        let mut results: Vec<
            Option<(
                Uuid,
                Option<String>,
                crate::domain::entities::ProfileClassification,
                bool,
                f32,
                BoundingBox,
                f32,
            )>,
        > = Vec::with_capacity(detection_count);

        for detection in frame.detections() {
            if detection.confidence() < config.min_confidence {
                results.push(None);
                continue;
            }

            let bbox = detection.bounding_box().clone();
            let confidence = detection.confidence();

            // Check if we have an embedding for face matching
            let embedding = detection.embedding().cloned();

            let result = if let Some(ref emb) = embedding {
                // Try to match with existing profiles
                match self.face_matcher.find_match(emb).await {
                    Some(match_result) => {
                        let profile = self
                            .profile_repo
                            .find_by_id(match_result.profile_id)
                            .await?;

                        match profile {
                            Some(p) => Some((
                                p.id(),
                                p.name().map(String::from),
                                p.classification(),
                                false,
                                match_result.distance,
                                bbox,
                                confidence,
                            )),
                            None => None,
                        }
                    }
                    None => {
                        // No match found, create new profile
                        let profile = self
                            .create_profile_from_detection(
                                emb.clone(),
                                &bbox,
                                camera_id,
                                frame_number,
                                frame_data.as_deref(),
                                snapshot_dir,
                            )
                            .await?;

                        let profile_id = profile.id();
                        created_profiles.push(profile_id);

                        self.event_bus
                            .publish(DomainEvent::ProfileCreated(ProfileCreatedEvent {
                                profile_id,
                                thumbnail_path: profile.thumbnail_path().map(String::from),
                                camera_id,
                                location: location.clone(),
                                timestamp: Utc::now(),
                            }));

                        Some((
                            profile_id,
                            None,
                            profile.classification(),
                            true,
                            0.0,
                            bbox,
                            confidence,
                        ))
                    }
                }
            } else {
                // No embedding - for MVP, create profile without embedding
                // This allows the system to at least record detections
                let profile = self
                    .create_profile_without_embedding(
                        &bbox,
                        camera_id,
                        frame_number,
                        frame_data.as_deref(),
                        snapshot_dir,
                    )
                    .await?;

                let profile_id = profile.id();
                created_profiles.push(profile_id);

                self.event_bus
                    .publish(DomainEvent::ProfileCreated(ProfileCreatedEvent {
                        profile_id,
                        thumbnail_path: profile.thumbnail_path().map(String::from),
                        camera_id,
                        location: location.clone(),
                        timestamp: Utc::now(),
                    }));

                Some((
                    profile_id,
                    None,
                    profile.classification(),
                    true,
                    0.0,
                    bbox,
                    confidence,
                ))
            };
            results.push(result);
        }

        // Second pass: update detections and process sightings
        for (i, detection) in frame.detections_mut().iter_mut().enumerate() {
            if let Some(Some((
                profile_id,
                profile_name,
                classification,
                is_new,
                distance,
                ref bbox,
                confidence,
            ))) = results.get(i)
            {
                if !*is_new {
                    detection.set_match(*profile_id, *distance);
                }

                self.event_bus
                    .publish(DomainEvent::FaceDetected(FaceDetectedEvent {
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
                    )
                    .await?;
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
        let thumbnail_path = self
            .save_thumbnail_from_data(image_data, bbox, snapshot_dir)
            .await;
        let profile = Profile::new(embedding.clone(), thumbnail_path);

        self.profile_repo.save(&profile).await?;
        self.face_matcher
            .add_to_cache(profile.id(), embedding)
            .await;

        info!(
            "Created new profile: {} from camera {}",
            profile.id(),
            camera_id
        );

        Ok(profile)
    }

    /// Creates a profile without an embedding (for MVP - no face matching capability).
    async fn create_profile_without_embedding(
        &self,
        bbox: &BoundingBox,
        camera_id: Uuid,
        _frame_number: u64,
        image_data: Option<&[u8]>,
        snapshot_dir: &str,
    ) -> RepoResult<Profile> {
        let thumbnail_path = self
            .save_thumbnail_from_data(image_data, bbox, snapshot_dir)
            .await;

        // Create a dummy embedding (all zeros) - won't be used for matching
        let dummy_embedding = FaceEmbedding::zeros(128);
        let profile = Profile::new(dummy_embedding, thumbnail_path);

        self.profile_repo.save(&profile).await?;

        info!(
            "Created new profile (no embedding): {} from camera {}",
            profile.id(),
            camera_id
        );

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

        let snapshot_path = self
            .save_snapshot_from_data(image_data, snapshot_dir)
            .await
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

        self.event_bus
            .publish(DomainEvent::ProfileSighted(ProfileSightedEvent {
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
        image_data: Option<&[u8]>,
        bbox: &BoundingBox,
        snapshot_dir: &str,
    ) -> Option<String> {
        // Store only the filename, not the full path
        let filename = format!("thumb_{}.jpg", Uuid::new_v4());
        let full_path = format!("{}/{}", snapshot_dir, filename);

        // Ensure directory exists
        if let Err(e) = tokio::fs::create_dir_all(snapshot_dir).await {
            tracing::warn!("Failed to create snapshot directory: {}", e);
            return Some(filename); // Still return filename for DB
        }

        // If we have image data, save it
        if let Some(data) = image_data {
            // Try to extract face region from full frame
            if let Some(cropped) = Self::crop_face_region(data, bbox) {
                if let Err(e) = tokio::fs::write(&full_path, &cropped).await {
                    tracing::warn!("Failed to write thumbnail {}: {}", full_path, e);
                }
            } else {
                // If cropping fails, try to save the raw data as-is (it might be JPEG already)
                if let Err(e) = tokio::fs::write(&full_path, data).await {
                    tracing::warn!("Failed to write thumbnail {}: {}", full_path, e);
                }
            }
        }

        Some(filename)
    }

    /// Crop face region from full frame and encode as JPEG
    /// The frame_data can be either:
    /// 1. Raw RGB data (width * height * 3 bytes)
    /// 2. Already encoded JPEG
    fn crop_face_region(frame_data: &[u8], bbox: &BoundingBox) -> Option<Vec<u8>> {
        use image::{DynamicImage, ImageFormat, ImageBuffer, Rgb};
        use std::io::Cursor;

        // First, try to decode as JPEG (if it's already encoded)
        let img: DynamicImage = if let Ok(img) = image::load_from_memory_with_format(frame_data, ImageFormat::Jpeg) {
            img
        } else {
            // Try to interpret as raw RGB data
            // Common resolutions to try
            let common_resolutions = [
                (1920, 1080),
                (1280, 720),
                (640, 480),
                (800, 600),
            ];

            let expected_bytes: Vec<(u32, u32, usize)> = common_resolutions
                .iter()
                .map(|(w, h)| (*w, *h, (w * h * 3) as usize))
                .collect();

            if let Some(&(width, height, _)) = expected_bytes.iter().find(|(_, _, size)| *size == frame_data.len()) {
                // Create RGB image buffer from raw data
                let rgb_buf: ImageBuffer<Rgb<u8>, _> = ImageBuffer::from_raw(width, height, frame_data.to_vec())?;
                DynamicImage::ImageRgb8(rgb_buf)
            } else {
                // Unknown format
                tracing::debug!("Unknown frame format: {} bytes", frame_data.len());
                return None;
            }
        };

        // Crop and resize face region
        let x = bbox.x().max(0) as u32;
        let y = bbox.y().max(0) as u32;
        let width = (bbox.width() as u32).min(img.width().saturating_sub(x));
        let height = (bbox.height() as u32).min(img.height().saturating_sub(y));

        if width == 0 || height == 0 {
            return None;
        }

        let cropped = img.crop_imm(x, y, width, height);
        // Resize to thumbnail size
        let thumbnail = cropped.thumbnail(128, 128);

        let mut buffer = Cursor::new(Vec::new());
        if thumbnail.write_to(&mut buffer, ImageFormat::Jpeg).is_ok() {
            return Some(buffer.into_inner());
        }

        None
    }

    async fn save_snapshot_from_data(
        &self,
        _image_data: Option<&[u8]>,
        snapshot_dir: &str,
    ) -> Option<String> {
        // Store only the filename, not the full path
        let filename = format!("snap_{}.jpg", Uuid::new_v4());
        let _full_path = format!("{}/{}", snapshot_dir, filename);
        // TODO: Actually save the image data to _full_path
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
