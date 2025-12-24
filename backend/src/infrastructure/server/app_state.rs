//! Application State
//!
//! Shared state for the HTTP server.

use std::sync::Arc;
use anyhow::Result;
use sqlx::PgPool;
use tracing::info;

use crate::application::services::{
    DetectionConfig, DetectionService, EventBus, FaceMatcher,
    RecordingConfig, RecordingService, StorageConfig, StorageManager,
};
use crate::application::use_cases::{
    ManageCamerasUseCase, ManageProfilesUseCase, ProcessFrameUseCase, QueryAnalyticsUseCase,
};
use crate::domain::repositories::{
    CameraRepository, ProfileRepository, RecordingRepository, SettingsRepository, SightingRepository,
};
use crate::infrastructure::camera::{CameraService, FaceDetector};
use crate::infrastructure::config::AppConfig;
use crate::infrastructure::database::{
    create_pool, run_migrations, PgCameraRepository, PgProfileRepository,
    PgRecordingRepository, PgSettingsRepository, PgSightingRepository,
};
use super::websocket::WsBroadcaster;

/// Application state shared across handlers.
pub struct AppState {
    pub config: AppConfig,
    pub pool: PgPool,
    pub event_bus: Arc<EventBus>,
    pub face_matcher: Arc<FaceMatcher>,
    pub detection_service: Arc<DetectionService>,
    pub recording_service: Arc<RecordingService>,
    pub storage_manager: Arc<StorageManager>,
    pub face_detector: Arc<FaceDetector>,
    pub ws_broadcaster: Arc<WsBroadcaster>,
    pub camera_service: Arc<CameraService>,
    
    // Repositories
    pub profile_repo: Arc<dyn ProfileRepository>,
    pub sighting_repo: Arc<dyn SightingRepository>,
    pub camera_repo: Arc<dyn CameraRepository>,
    pub recording_repo: Arc<dyn RecordingRepository>,
    pub settings_repo: Arc<dyn SettingsRepository>,
    
    // Use cases
    pub process_frame: Arc<ProcessFrameUseCase>,
    pub manage_profiles: Arc<ManageProfilesUseCase>,
    pub manage_cameras: Arc<ManageCamerasUseCase>,
    pub query_analytics: Arc<QueryAnalyticsUseCase>,
}

impl AppState {
    /// Creates new application state.
    pub async fn new(config: &AppConfig) -> Result<Self> {
        // Database
        let pool = create_pool(&config.database_url).await?;
        run_migrations(&pool).await?;
        
        // Repositories
        let profile_repo: Arc<dyn ProfileRepository> = Arc::new(PgProfileRepository::new(pool.clone()));
        let sighting_repo: Arc<dyn SightingRepository> = Arc::new(PgSightingRepository::new(pool.clone()));
        let camera_repo: Arc<dyn CameraRepository> = Arc::new(PgCameraRepository::new(pool.clone()));
        let recording_repo: Arc<dyn RecordingRepository> = Arc::new(PgRecordingRepository::new(pool.clone()));
        let settings_repo: Arc<dyn SettingsRepository> = Arc::new(PgSettingsRepository::new(pool.clone()));
        
        // Event bus
        let event_bus = Arc::new(EventBus::new());
        
        // Face matcher
        let face_matcher = Arc::new(FaceMatcher::new(profile_repo.clone(), 0.6));
        face_matcher.load_cache().await?;
        
        // Services
        let detection_service = Arc::new(DetectionService::new(
            profile_repo.clone(),
            sighting_repo.clone(),
            face_matcher.clone(),
            event_bus.clone(),
            DetectionConfig::default(),
        ));
        
        let recording_service = Arc::new(RecordingService::new(
            recording_repo.clone(),
            event_bus.clone(),
            RecordingConfig {
                recordings_dir: config.recordings_dir(),
                ..Default::default()
            },
        ));
        
        let storage_manager = Arc::new(StorageManager::new(
            recording_repo.clone(),
            StorageConfig {
                base_dir: config.data_dir.clone(),
                ..Default::default()
            },
        ));
        storage_manager.ensure_directories().await?;
        
        // Face detector
        let face_detector = Arc::new(FaceDetector::new(Default::default())?);
        
        // WebSocket broadcaster
        let ws_broadcaster = Arc::new(WsBroadcaster::new(1024));
        
        // Use cases
        let process_frame = Arc::new(ProcessFrameUseCase::new(
            detection_service.clone(),
            recording_service.clone(),
            storage_manager.clone(),
        ));
        
        let manage_profiles = Arc::new(ManageProfilesUseCase::new(
            profile_repo.clone(),
            sighting_repo.clone(),
            face_matcher.clone(),
        ));
        
        let manage_cameras = Arc::new(ManageCamerasUseCase::new(camera_repo.clone()));
        
        let query_analytics = Arc::new(QueryAnalyticsUseCase::new(
            profile_repo.clone(),
            sighting_repo.clone(),
            recording_repo.clone(),
        ));

        // Camera service - manages capture and processing
        let camera_service = Arc::new(CameraService::new(
            face_detector.clone(),
            process_frame.clone(),
        ));
        
        // Start built-in camera capture automatically
        info!("Starting built-in camera capture...");
        match camera_service.start_builtin_camera().await {
            Ok(camera_id) => {
                info!("Built-in camera started with ID: {}", camera_id);
            }
            Err(e) => {
                // Log but don't fail - camera might not be available
                tracing::warn!("Failed to start built-in camera: {}. Camera features will be limited.", e);
            }
        }
        
        Ok(Self {
            config: config.clone(),
            pool,
            event_bus,
            face_matcher,
            detection_service,
            recording_service,
            storage_manager,
            face_detector,
            ws_broadcaster,
            camera_service,
            profile_repo,
            sighting_repo,
            camera_repo,
            recording_repo,
            settings_repo,
            process_frame,
            manage_profiles,
            manage_cameras,
            query_analytics,
        })
    }
}
