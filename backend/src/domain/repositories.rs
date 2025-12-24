//! Repository Traits
//!
//! Abstractions for data persistence (Dependency Inversion Principle).

use async_trait::async_trait;
use uuid::Uuid;

use crate::domain::entities::{Camera, Profile, Recording, Settings, Sighting};
use crate::domain::value_objects::FaceEmbedding;

/// Result type for repository operations.
pub type RepoResult<T> = Result<T, RepositoryError>;

/// Repository error types.
#[derive(Debug, thiserror::Error)]
pub enum RepositoryError {
    #[error("Entity not found: {0}")]
    NotFound(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("Serialization error: {0}")]
    Serialization(String),

    #[error("Constraint violation: {0}")]
    Constraint(String),
}

/// Profile repository interface.
#[async_trait]
pub trait ProfileRepository: Send + Sync {
    /// Finds a profile by ID.
    async fn find_by_id(&self, id: Uuid) -> RepoResult<Option<Profile>>;

    /// Finds all active profiles.
    async fn find_all_active(&self) -> RepoResult<Vec<Profile>>;

    /// Finds profiles matching an embedding within the threshold.
    async fn find_by_embedding(&self, embedding: &FaceEmbedding, threshold: f32) -> RepoResult<Vec<(Profile, f32)>>;

    /// Saves a new profile.
    async fn save(&self, profile: &Profile) -> RepoResult<()>;

    /// Updates an existing profile.
    async fn update(&self, profile: &Profile) -> RepoResult<()>;

    /// Deletes a profile (soft delete).
    async fn delete(&self, id: Uuid) -> RepoResult<()>;

    /// Counts total profiles.
    async fn count(&self) -> RepoResult<i64>;
}

/// Sighting repository interface.
#[async_trait]
pub trait SightingRepository: Send + Sync {
    /// Finds a sighting by ID.
    async fn find_by_id(&self, id: Uuid) -> RepoResult<Option<Sighting>>;

    /// Finds sightings for a profile.
    async fn find_by_profile(&self, profile_id: Uuid, limit: i64) -> RepoResult<Vec<Sighting>>;

    /// Finds sightings within a time range.
    async fn find_in_range(
        &self,
        start: chrono::DateTime<chrono::Utc>,
        end: chrono::DateTime<chrono::Utc>,
        limit: i64,
    ) -> RepoResult<Vec<Sighting>>;

    /// Saves a new sighting.
    async fn save(&self, sighting: &Sighting) -> RepoResult<()>;

    /// Gets sighting counts by location for heatmap.
    async fn get_location_heatmap(&self) -> RepoResult<Vec<(f64, f64, i64)>>;

    /// Counts total sightings.
    async fn count(&self) -> RepoResult<i64>;

    /// Counts sightings for a profile.
    async fn count_by_profile(&self, profile_id: Uuid) -> RepoResult<i64>;
}

/// Camera repository interface.
#[async_trait]
pub trait CameraRepository: Send + Sync {
    /// Finds a camera by ID.
    async fn find_by_id(&self, id: Uuid) -> RepoResult<Option<Camera>>;

    /// Finds all cameras.
    async fn find_all(&self) -> RepoResult<Vec<Camera>>;

    /// Finds enabled cameras.
    async fn find_enabled(&self) -> RepoResult<Vec<Camera>>;

    /// Saves a new camera.
    async fn save(&self, camera: &Camera) -> RepoResult<()>;

    /// Updates an existing camera.
    async fn update(&self, camera: &Camera) -> RepoResult<()>;

    /// Deletes a camera.
    async fn delete(&self, id: Uuid) -> RepoResult<()>;
}

/// Recording repository interface.
#[async_trait]
pub trait RecordingRepository: Send + Sync {
    /// Finds a recording by ID.
    async fn find_by_id(&self, id: Uuid) -> RepoResult<Option<Recording>>;

    /// Finds all recordings with optional limit.
    async fn find_all(&self, limit: i64) -> RepoResult<Vec<Recording>>;

    /// Finds recordings for a camera.
    async fn find_by_camera(&self, camera_id: Uuid, limit: i64) -> RepoResult<Vec<Recording>>;

    /// Finds recordings with detections.
    async fn find_with_detections(&self, limit: i64) -> RepoResult<Vec<Recording>>;

    /// Saves a new recording.
    async fn save(&self, recording: &Recording) -> RepoResult<()>;

    /// Updates an existing recording.
    async fn update(&self, recording: &Recording) -> RepoResult<()>;

    /// Deletes a recording.
    async fn delete(&self, id: Uuid) -> RepoResult<()>;

    /// Gets total storage used in bytes.
    async fn total_storage_bytes(&self) -> RepoResult<i64>;

    /// Finds oldest recordings for cleanup.
    async fn find_oldest(&self, limit: i64) -> RepoResult<Vec<Recording>>;
}

/// Settings repository interface.
#[async_trait]
pub trait SettingsRepository: Send + Sync {
    /// Gets current settings.
    async fn get(&self) -> RepoResult<Settings>;

    /// Saves settings.
    async fn save(&self, settings: &Settings) -> RepoResult<()>;
}
