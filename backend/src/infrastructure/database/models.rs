//! Database Row Models
//!
//! SQLx-compatible structs for database row mapping.

use chrono::{DateTime, Utc};
use sqlx::FromRow;
use uuid::Uuid;

use crate::domain::entities::{CameraStatus, CameraType, ProfileClassification, RecordingStatus};

/// Profile database row.
#[derive(Debug, FromRow)]
pub struct ProfileRow {
    pub id: Uuid,
    pub name: Option<String>,
    pub classification: ProfileClassification,
    pub embedding: Vec<u8>,
    pub thumbnail_path: Option<String>,
    pub tags: sqlx::types::Json<Vec<serde_json::Value>>,
    pub notes: Option<String>,
    pub first_seen_at: DateTime<Utc>,
    pub last_seen_at: DateTime<Utc>,
    pub sighting_count: i64,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Camera database row.
#[derive(Debug, FromRow)]
pub struct CameraRow {
    pub id: Uuid,
    pub name: String,
    pub camera_type: CameraType,
    pub device_id: String,
    pub rtsp_url: Option<String>,
    pub location_lat: Option<f64>,
    pub location_lon: Option<f64>,
    pub location_alt: Option<f64>,
    pub location_name: Option<String>,
    pub status: CameraStatus,
    pub resolution_width: i32,
    pub resolution_height: i32,
    pub fps: i32,
    pub is_enabled: bool,
    pub last_frame_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Sighting database row.
#[derive(Debug, FromRow)]
pub struct SightingRow {
    pub id: Uuid,
    pub profile_id: Uuid,
    pub camera_id: Uuid,
    pub snapshot_path: String,
    pub bbox_x: i32,
    pub bbox_y: i32,
    pub bbox_width: i32,
    pub bbox_height: i32,
    pub confidence: f32,
    pub location_lat: Option<f64>,
    pub location_lon: Option<f64>,
    pub recording_id: Option<Uuid>,
    pub recording_timestamp_ms: Option<i64>,
    pub detected_at: DateTime<Utc>,
}

/// Recording database row.
#[derive(Debug, FromRow)]
pub struct RecordingRow {
    pub id: Uuid,
    pub camera_id: Uuid,
    pub file_path: String,
    pub file_size_bytes: i64,
    pub duration_ms: i64,
    pub frame_count: i64,
    pub status: RecordingStatus,
    pub has_detections: bool,
    pub started_at: DateTime<Utc>,
    pub ended_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

/// Settings database row.
#[derive(Debug, FromRow)]
pub struct SettingsRow {
    pub id: i32,
    pub config: sqlx::types::Json<serde_json::Value>,
    pub updated_at: DateTime<Utc>,
}
