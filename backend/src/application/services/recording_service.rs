//! Recording Service
//!
//! Manages video recording with motion/detection triggering.

use std::path::PathBuf;
use std::sync::Arc;
use chrono::Utc;
use tokio::sync::RwLock;
use tracing::info;
use uuid::Uuid;

use crate::application::services::EventBus;
use crate::domain::entities::Recording;
use crate::domain::events::{DomainEvent, RecordingEndedEvent, RecordingStartedEvent};
use crate::domain::repositories::{RecordingRepository, RepoResult};

/// Configuration for recording behavior.
#[derive(Debug, Clone)]
pub struct RecordingConfig {
    /// Only record when faces are detected.
    pub detection_triggered: bool,
    /// Seconds to record before detection trigger.
    pub pre_trigger_buffer_secs: i32,
    /// Seconds to continue recording after last detection.
    pub post_trigger_buffer_secs: i32,
    /// Maximum recording segment duration (seconds).
    pub max_segment_duration_secs: i32,
    /// Base directory for recordings.
    pub recordings_dir: PathBuf,
}

impl Default for RecordingConfig {
    fn default() -> Self {
        let recordings_dir = dirs::document_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Safelynx")
            .join("recordings");
        
        Self {
            detection_triggered: true,
            pre_trigger_buffer_secs: 5,
            post_trigger_buffer_secs: 10,
            max_segment_duration_secs: 300,
            recordings_dir,
        }
    }
}

/// State of a recording session.
#[derive(Debug)]
struct RecordingSession {
    recording: Recording,
    last_detection_at: Option<chrono::DateTime<Utc>>,
    frame_count: i64,
    bytes_written: i64,
}

/// Service for managing video recordings.
pub struct RecordingService {
    recording_repo: Arc<dyn RecordingRepository>,
    event_bus: Arc<EventBus>,
    config: RwLock<RecordingConfig>,
    active_sessions: RwLock<std::collections::HashMap<Uuid, RecordingSession>>,
}

impl RecordingService {
    /// Creates a new recording service.
    pub fn new(
        recording_repo: Arc<dyn RecordingRepository>,
        event_bus: Arc<EventBus>,
        config: RecordingConfig,
    ) -> Self {
        Self {
            recording_repo,
            event_bus,
            config: RwLock::new(config),
            active_sessions: RwLock::new(std::collections::HashMap::new()),
        }
    }

    /// Updates the recording configuration.
    pub async fn update_config(&self, config: RecordingConfig) {
        *self.config.write().await = config;
    }

    /// Gets the current config.
    pub async fn config(&self) -> RecordingConfig {
        self.config.read().await.clone()
    }

    /// Starts a new recording for a camera.
    pub async fn start_recording(&self, camera_id: Uuid) -> RepoResult<Uuid> {
        let config = self.config.read().await;
        let timestamp = Utc::now().format("%Y%m%d_%H%M%S");
        let filename = format!("{}_{}.mp4", camera_id, timestamp);
        let file_path = config.recordings_dir.join(&filename);
        
        std::fs::create_dir_all(&config.recordings_dir).ok();
        
        let recording = Recording::new(camera_id, file_path.to_string_lossy().to_string());
        let recording_id = recording.id();
        
        self.recording_repo.save(&recording).await?;
        
        let session = RecordingSession {
            recording,
            last_detection_at: None,
            frame_count: 0,
            bytes_written: 0,
        };
        
        self.active_sessions.write().await.insert(camera_id, session);
        
        self.event_bus.publish(DomainEvent::RecordingStarted(RecordingStartedEvent {
            recording_id,
            camera_id,
            timestamp: Utc::now(),
        }));
        
        info!("Started recording {} for camera {}", recording_id, camera_id);
        
        Ok(recording_id)
    }

    /// Stops a recording for a camera.
    pub async fn stop_recording(&self, camera_id: Uuid) -> RepoResult<Option<Recording>> {
        let mut sessions = self.active_sessions.write().await;
        
        let session = match sessions.remove(&camera_id) {
            Some(s) => s,
            None => return Ok(None),
        };
        
        let mut recording = session.recording;
        let duration_ms = (Utc::now() - recording.started_at()).num_milliseconds();
        
        recording.complete(session.bytes_written, duration_ms, session.frame_count);
        self.recording_repo.update(&recording).await?;
        
        self.event_bus.publish(DomainEvent::RecordingEnded(RecordingEndedEvent {
            recording_id: recording.id(),
            camera_id,
            duration_ms,
            file_size_bytes: session.bytes_written,
            has_detections: recording.has_detections(),
            timestamp: Utc::now(),
        }));
        
        info!("Stopped recording {} for camera {}", recording.id(), camera_id);
        
        Ok(Some(recording))
    }

    /// Records a detection event (triggers recording if configured).
    pub async fn on_detection(&self, camera_id: Uuid) -> RepoResult<()> {
        let config = self.config.read().await.clone();
        let mut sessions = self.active_sessions.write().await;
        
        if let Some(session) = sessions.get_mut(&camera_id) {
            session.last_detection_at = Some(Utc::now());
            
            let mut recording = session.recording.clone();
            recording.mark_has_detections();
            session.recording = recording;
        } else if config.detection_triggered {
            drop(sessions);
            self.start_recording(camera_id).await?;
        }
        
        Ok(())
    }

    /// Updates recording stats for a frame.
    pub async fn update_stats(&self, camera_id: Uuid, bytes: i64) {
        let mut sessions = self.active_sessions.write().await;
        
        if let Some(session) = sessions.get_mut(&camera_id) {
            session.frame_count += 1;
            session.bytes_written += bytes;
        }
    }

    /// Checks if a recording should be stopped based on timeout.
    pub async fn check_timeout(&self, camera_id: Uuid) -> RepoResult<bool> {
        let config = self.config.read().await.clone();
        let sessions = self.active_sessions.read().await;
        
        let should_stop = if let Some(session) = sessions.get(&camera_id) {
            if !config.detection_triggered {
                let duration = (Utc::now() - session.recording.started_at()).num_seconds();
                duration > config.max_segment_duration_secs as i64
            } else if let Some(last_detection) = session.last_detection_at {
                let since_detection = (Utc::now() - last_detection).num_seconds();
                since_detection > config.post_trigger_buffer_secs as i64
            } else {
                false
            }
        } else {
            false
        };
        
        drop(sessions);
        
        if should_stop {
            self.stop_recording(camera_id).await?;
            return Ok(true);
        }
        
        Ok(false)
    }

    /// Returns active recording for a camera if any.
    pub async fn active_recording(&self, camera_id: Uuid) -> Option<Recording> {
        let sessions = self.active_sessions.read().await;
        sessions.get(&camera_id).map(|s| s.recording.clone())
    }

    /// Returns all active recordings.
    pub async fn all_active_recordings(&self) -> Vec<Recording> {
        let sessions = self.active_sessions.read().await;
        sessions.values().map(|s| s.recording.clone()).collect()
    }

    /// Checks if a camera is currently recording.
    pub async fn is_recording(&self, camera_id: Uuid) -> bool {
        self.active_sessions.read().await.contains_key(&camera_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_uses_documents_dir() {
        let config = RecordingConfig::default();
        assert!(config.recordings_dir.to_string_lossy().contains("Safelynx"));
    }

    #[test]
    fn default_config_has_detection_triggering_enabled() {
        let config = RecordingConfig::default();
        assert!(config.detection_triggered);
    }

    #[test]
    fn default_config_has_reasonable_timeouts() {
        let config = RecordingConfig::default();
        assert!(config.pre_trigger_buffer_secs > 0);
        assert!(config.post_trigger_buffer_secs > 0);
        assert!(config.max_segment_duration_secs > 60);
    }
}
