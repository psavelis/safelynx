//! API Routes
//!
//! REST API endpoint definitions.

pub mod health;
pub mod profiles;
pub mod cameras;
pub mod sightings;
pub mod recordings;
pub mod settings;
pub mod analytics;

use std::sync::Arc;
use axum::{Router, routing::{get, post, put, delete}};

use crate::infrastructure::server::AppState;

/// Creates all API routes.
pub fn routes(_state: Arc<AppState>) -> Router<Arc<AppState>> {
    Router::new()
        // Profiles
        .route("/profiles", get(profiles::list_profiles))
        .route("/profiles/:id", get(profiles::get_profile))
        .route("/profiles/:id", put(profiles::update_profile))
        .route("/profiles/:id", delete(profiles::delete_profile))
        .route("/profiles/:id/sightings", get(profiles::get_profile_sightings))
        
        // Cameras
        .route("/cameras", get(cameras::list_cameras))
        .route("/cameras", post(cameras::create_camera))
        .route("/cameras/:id", get(cameras::get_camera))
        .route("/cameras/:id", put(cameras::update_camera))
        .route("/cameras/:id", delete(cameras::delete_camera))
        .route("/cameras/:id/stream/start", post(cameras::start_stream))
        .route("/cameras/:id/stream/stop", post(cameras::stop_stream))
        .route("/cameras/available", get(cameras::list_available_cameras))
        
        // Sightings
        .route("/sightings", get(sightings::list_sightings))
        .route("/sightings/:id", get(sightings::get_sighting))
        
        // Recordings
        .route("/recordings", get(recordings::list_recordings))
        .route("/recordings/:id", get(recordings::get_recording))
        .route("/recordings/:id", delete(recordings::delete_recording))
        .route("/recordings/:id/play", get(recordings::play_recording))
        
        // Settings
        .route("/settings", get(settings::get_settings))
        .route("/settings", put(settings::update_settings))
        
        // Analytics
        .route("/analytics/dashboard", get(analytics::get_dashboard_stats))
        .route("/analytics/heatmap", get(analytics::get_heatmap_data))
        .route("/analytics/timeline", get(analytics::get_timeline))
        .route("/analytics/storage", get(analytics::get_storage_stats))
        .route("/analytics/activity-chart", get(analytics::get_activity_chart))
}
