//! Settings API Endpoints

use axum::{extract::State, http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::domain::entities::{DetectionSettings, DisplaySettings, NotificationSettings, Settings};
use crate::infrastructure::server::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct SettingsResponse {
    pub detection: DetectionSettingsResponse,
    pub recording: RecordingSettingsResponse,
    pub notification: NotificationSettingsResponse,
    pub display: DisplaySettingsResponse,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DetectionSettingsResponse {
    pub min_confidence: f32,
    pub match_threshold: f32,
    pub sighting_cooldown_secs: i32,
    pub motion_detection_enabled: bool,
    pub motion_sensitivity: f32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecordingSettingsResponse {
    pub detection_triggered: bool,
    pub pre_trigger_buffer_secs: i32,
    pub post_trigger_buffer_secs: i32,
    pub max_segment_duration_secs: i32,
    pub max_storage_bytes: i64,
    pub max_storage_human: String,
    pub auto_cleanup_enabled: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NotificationSettingsResponse {
    pub desktop_notifications: bool,
    pub notify_new_profile: bool,
    pub notify_flagged: bool,
    pub notify_unknown: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DisplaySettingsResponse {
    pub show_bounding_boxes: bool,
    pub show_confidence: bool,
    pub show_names: bool,
    pub dark_mode: bool,
}

impl From<Settings> for SettingsResponse {
    fn from(s: Settings) -> Self {
        Self {
            detection: DetectionSettingsResponse {
                min_confidence: s.detection.min_confidence,
                match_threshold: s.detection.match_threshold,
                sighting_cooldown_secs: s.detection.sighting_cooldown_secs,
                motion_detection_enabled: s.detection.motion_detection_enabled,
                motion_sensitivity: s.detection.motion_sensitivity,
            },
            recording: RecordingSettingsResponse {
                detection_triggered: s.recording.detection_triggered,
                pre_trigger_buffer_secs: s.recording.pre_trigger_buffer_secs,
                post_trigger_buffer_secs: s.recording.post_trigger_buffer_secs,
                max_segment_duration_secs: s.recording.max_segment_duration_secs,
                max_storage_bytes: s.recording.max_storage_bytes,
                max_storage_human: format_bytes(s.recording.max_storage_bytes),
                auto_cleanup_enabled: s.recording.auto_cleanup_enabled,
            },
            notification: NotificationSettingsResponse {
                desktop_notifications: s.notification.desktop_notifications,
                notify_new_profile: s.notification.notify_new_profile,
                notify_flagged: s.notification.notify_flagged,
                notify_unknown: s.notification.notify_unknown,
            },
            display: DisplaySettingsResponse {
                show_bounding_boxes: s.display.show_bounding_boxes,
                show_confidence: s.display.show_confidence,
                show_names: s.display.show_names,
                dark_mode: s.display.dark_mode,
            },
        }
    }
}

fn format_bytes(bytes: i64) -> String {
    const GB: i64 = 1024 * 1024 * 1024;
    format!("{} GB", bytes / GB)
}

#[derive(Debug, Deserialize)]
pub struct UpdateSettingsBody {
    pub detection: Option<DetectionSettingsResponse>,
    pub recording: Option<UpdateRecordingSettings>,
    pub notification: Option<NotificationSettingsResponse>,
    pub display: Option<DisplaySettingsResponse>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRecordingSettings {
    pub detection_triggered: Option<bool>,
    pub pre_trigger_buffer_secs: Option<i32>,
    pub post_trigger_buffer_secs: Option<i32>,
    pub max_segment_duration_secs: Option<i32>,
    pub max_storage_gb: Option<i64>,
    pub auto_cleanup_enabled: Option<bool>,
}

/// GET /api/v1/settings
pub async fn get_settings(
    State(state): State<Arc<AppState>>,
) -> Result<Json<SettingsResponse>, StatusCode> {
    let settings = state
        .settings_repo
        .get()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(settings.into()))
}

/// PUT /api/v1/settings
pub async fn update_settings(
    State(state): State<Arc<AppState>>,
    Json(body): Json<UpdateSettingsBody>,
) -> Result<Json<SettingsResponse>, StatusCode> {
    let mut settings = state
        .settings_repo
        .get()
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    if let Some(detection) = body.detection {
        settings.detection = DetectionSettings {
            min_confidence: detection.min_confidence,
            match_threshold: detection.match_threshold,
            sighting_cooldown_secs: detection.sighting_cooldown_secs,
            motion_detection_enabled: detection.motion_detection_enabled,
            motion_sensitivity: detection.motion_sensitivity,
        };
    }

    if let Some(recording) = body.recording {
        if let Some(v) = recording.detection_triggered {
            settings.recording.detection_triggered = v;
        }
        if let Some(v) = recording.pre_trigger_buffer_secs {
            settings.recording.pre_trigger_buffer_secs = v;
        }
        if let Some(v) = recording.post_trigger_buffer_secs {
            settings.recording.post_trigger_buffer_secs = v;
        }
        if let Some(v) = recording.max_segment_duration_secs {
            settings.recording.max_segment_duration_secs = v;
        }
        if let Some(gb) = recording.max_storage_gb {
            settings.recording.max_storage_bytes = gb * 1024 * 1024 * 1024;
        }
        if let Some(v) = recording.auto_cleanup_enabled {
            settings.recording.auto_cleanup_enabled = v;
        }
    }

    if let Some(notification) = body.notification {
        settings.notification = NotificationSettings {
            desktop_notifications: notification.desktop_notifications,
            notify_new_profile: notification.notify_new_profile,
            notify_flagged: notification.notify_flagged,
            notify_unknown: notification.notify_unknown,
        };
    }

    if let Some(display) = body.display {
        settings.display = DisplaySettings {
            show_bounding_boxes: display.show_bounding_boxes,
            show_confidence: display.show_confidence,
            show_names: display.show_names,
            dark_mode: display.dark_mode,
        };
    }

    state
        .settings_repo
        .save(&settings)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    Ok(Json(settings.into()))
}
