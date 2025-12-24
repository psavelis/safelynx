//! Settings Entity
//!
//! Application configuration stored in database.

use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Detection settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectionSettings {
    /// Minimum confidence threshold for face detection (0.0-1.0).
    pub min_confidence: f32,
    /// Maximum distance for face embedding match (lower = stricter).
    pub match_threshold: f32,
    /// Minimum time between sightings of same profile (seconds).
    pub sighting_cooldown_secs: i32,
    /// Enable motion detection trigger.
    pub motion_detection_enabled: bool,
    /// Motion sensitivity threshold (0.0-1.0).
    pub motion_sensitivity: f32,
}

impl Default for DetectionSettings {
    fn default() -> Self {
        Self {
            min_confidence: 0.7,
            match_threshold: 0.6,
            sighting_cooldown_secs: 30,
            motion_detection_enabled: true,
            motion_sensitivity: 0.3,
        }
    }
}

/// Recording settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingSettings {
    /// Only record when faces are detected.
    pub detection_triggered: bool,
    /// Seconds to record before detection trigger.
    pub pre_trigger_buffer_secs: i32,
    /// Seconds to continue recording after last detection.
    pub post_trigger_buffer_secs: i32,
    /// Maximum recording segment duration (seconds).
    pub max_segment_duration_secs: i32,
    /// Maximum total storage in bytes.
    pub max_storage_bytes: i64,
    /// Enable automatic cleanup when storage is full.
    pub auto_cleanup_enabled: bool,
}

impl Default for RecordingSettings {
    fn default() -> Self {
        Self {
            detection_triggered: true,
            pre_trigger_buffer_secs: 5,
            post_trigger_buffer_secs: 10,
            max_segment_duration_secs: 300,
            max_storage_bytes: 100 * 1024 * 1024 * 1024, // 100GB
            auto_cleanup_enabled: true,
        }
    }
}

/// Notification settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationSettings {
    /// Enable desktop notifications.
    pub desktop_notifications: bool,
    /// Notify on new profile creation.
    pub notify_new_profile: bool,
    /// Notify when flagged profile is seen.
    pub notify_flagged: bool,
    /// Notify when unknown face is detected.
    pub notify_unknown: bool,
}

impl Default for NotificationSettings {
    fn default() -> Self {
        Self {
            desktop_notifications: true,
            notify_new_profile: true,
            notify_flagged: true,
            notify_unknown: false,
        }
    }
}

/// UI display settings.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplaySettings {
    /// Show bounding boxes on live feed.
    pub show_bounding_boxes: bool,
    /// Show confidence scores.
    pub show_confidence: bool,
    /// Show profile names on detection.
    pub show_names: bool,
    /// Dark mode enabled.
    pub dark_mode: bool,
}

impl Default for DisplaySettings {
    fn default() -> Self {
        Self {
            show_bounding_boxes: true,
            show_confidence: true,
            show_names: true,
            dark_mode: true,
        }
    }
}

/// Instance settings for multi-device sync.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceSettings {
    /// Unique instance identifier.
    pub instance_id: Uuid,
    /// Human-readable instance name.
    pub instance_name: String,
    /// Remote database URLs for sync.
    pub sync_databases: Vec<String>,
}

impl Default for InstanceSettings {
    fn default() -> Self {
        Self {
            instance_id: Uuid::new_v4(),
            instance_name: hostname::get()
                .map(|h| h.to_string_lossy().to_string())
                .unwrap_or_else(|_| "Unknown".to_string()),
            sync_databases: Vec::new(),
        }
    }
}

/// Complete application settings.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Settings {
    pub detection: DetectionSettings,
    pub recording: RecordingSettings,
    pub notification: NotificationSettings,
    pub display: DisplaySettings,
    pub instance: InstanceSettings,
}

impl Settings {
    /// Creates settings with defaults.
    pub fn new() -> Self {
        Self::default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_detection_confidence_is_reasonable() {
        let settings = DetectionSettings::default();
        assert!(settings.min_confidence >= 0.5);
        assert!(settings.min_confidence <= 1.0);
    }

    #[test]
    fn default_storage_is_100gb() {
        let settings = RecordingSettings::default();
        assert_eq!(settings.max_storage_bytes, 100 * 1024 * 1024 * 1024);
    }

    #[test]
    fn default_display_is_dark_mode() {
        let settings = DisplaySettings::default();
        assert!(settings.dark_mode);
    }
}
