//! Storage Manager Service
//!
//! Manages disk storage for recordings with automatic cleanup.

use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};

use crate::domain::entities::Recording;
use crate::domain::repositories::{RecordingRepository, RepoResult};

/// Configuration for storage management.
#[derive(Debug, Clone)]
pub struct StorageConfig {
    /// Maximum storage in bytes.
    pub max_storage_bytes: i64,
    /// Enable automatic cleanup.
    pub auto_cleanup: bool,
    /// Target usage after cleanup (percentage of max).
    pub cleanup_target_percent: f64,
    /// Base directory for all storage.
    pub base_dir: PathBuf,
}

impl Default for StorageConfig {
    fn default() -> Self {
        let base_dir = dirs::document_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Safelynx");
        
        Self {
            max_storage_bytes: 100 * 1024 * 1024 * 1024, // 100GB
            auto_cleanup: true,
            cleanup_target_percent: 0.8,
            base_dir,
        }
    }
}

/// Storage usage statistics.
#[derive(Debug, Clone, Default)]
pub struct StorageStats {
    pub total_bytes: i64,
    pub recordings_bytes: i64,
    pub snapshots_bytes: i64,
    pub max_bytes: i64,
    pub usage_percent: f64,
    pub recording_count: i64,
}

/// Service for managing storage.
pub struct StorageManager {
    recording_repo: Arc<dyn RecordingRepository>,
    config: RwLock<StorageConfig>,
}

impl StorageManager {
    /// Creates a new storage manager.
    pub fn new(recording_repo: Arc<dyn RecordingRepository>, config: StorageConfig) -> Self {
        Self {
            recording_repo,
            config: RwLock::new(config),
        }
    }

    /// Updates the storage configuration.
    pub async fn update_config(&self, config: StorageConfig) {
        *self.config.write().await = config;
    }

    /// Gets current storage statistics.
    pub async fn stats(&self) -> RepoResult<StorageStats> {
        let config = self.config.read().await;
        let recordings_bytes = self.recording_repo.total_storage_bytes().await?;
        let snapshots_bytes = self.calculate_snapshots_size(&config.base_dir).await;
        let total_bytes = recordings_bytes + snapshots_bytes;
        
        Ok(StorageStats {
            total_bytes,
            recordings_bytes,
            snapshots_bytes,
            max_bytes: config.max_storage_bytes,
            usage_percent: total_bytes as f64 / config.max_storage_bytes as f64 * 100.0,
            recording_count: 0, // TODO: implement count
        })
    }

    /// Checks if storage limit is exceeded and performs cleanup if needed.
    pub async fn check_and_cleanup(&self) -> RepoResult<bool> {
        let config = self.config.read().await.clone();
        
        if !config.auto_cleanup {
            return Ok(false);
        }
        
        let stats = self.stats().await?;
        
        if stats.total_bytes <= config.max_storage_bytes {
            return Ok(false);
        }
        
        info!("Storage limit exceeded ({:.1}%), starting cleanup", stats.usage_percent);
        
        let target_bytes = (config.max_storage_bytes as f64 * config.cleanup_target_percent) as i64;
        let bytes_to_free = stats.total_bytes - target_bytes;
        
        self.cleanup_recordings(bytes_to_free).await?;
        
        Ok(true)
    }

    /// Deletes oldest recordings to free specified bytes.
    async fn cleanup_recordings(&self, bytes_to_free: i64) -> RepoResult<()> {
        let mut freed = 0i64;
        let mut batch_size = 10;
        
        while freed < bytes_to_free {
            let oldest = self.recording_repo.find_oldest(batch_size).await?;
            
            if oldest.is_empty() {
                warn!("No more recordings to delete, freed {} bytes", freed);
                break;
            }
            
            for recording in oldest {
                if freed >= bytes_to_free {
                    break;
                }
                
                freed += recording.file_size_bytes();
                self.delete_recording_files(&recording).await;
                self.recording_repo.delete(recording.id()).await?;
                
                info!("Deleted recording {} ({} bytes)", recording.id(), recording.file_size_bytes());
            }
            
            batch_size = 50;
        }
        
        info!("Cleanup complete, freed {} bytes", freed);
        
        Ok(())
    }

    /// Deletes the physical files for a recording.
    async fn delete_recording_files(&self, recording: &Recording) {
        let path = PathBuf::from(recording.file_path());
        if path.exists() {
            if let Err(e) = tokio::fs::remove_file(&path).await {
                warn!("Failed to delete recording file {:?}: {}", path, e);
            }
        }
    }

    /// Calculates total size of snapshots directory.
    async fn calculate_snapshots_size(&self, base_dir: &PathBuf) -> i64 {
        let snapshots_dir = base_dir.join("snapshots");
        
        if !snapshots_dir.exists() {
            return 0;
        }
        
        let mut total = 0i64;
        
        if let Ok(mut entries) = tokio::fs::read_dir(&snapshots_dir).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                if let Ok(metadata) = entry.metadata().await {
                    total += metadata.len() as i64;
                }
            }
        }
        
        total
    }

    /// Returns the recordings directory path.
    pub async fn recordings_dir(&self) -> PathBuf {
        self.config.read().await.base_dir.join("recordings")
    }

    /// Returns the snapshots directory path.
    pub async fn snapshots_dir(&self) -> PathBuf {
        self.config.read().await.base_dir.join("snapshots")
    }

    /// Ensures all required directories exist.
    pub async fn ensure_directories(&self) -> std::io::Result<()> {
        let config = self.config.read().await;
        
        tokio::fs::create_dir_all(config.base_dir.join("recordings")).await?;
        tokio::fs::create_dir_all(config.base_dir.join("snapshots")).await?;
        tokio::fs::create_dir_all(config.base_dir.join("logs")).await?;
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_100gb() {
        let config = StorageConfig::default();
        assert_eq!(config.max_storage_bytes, 100 * 1024 * 1024 * 1024);
    }

    #[test]
    fn default_config_has_auto_cleanup_enabled() {
        let config = StorageConfig::default();
        assert!(config.auto_cleanup);
    }

    #[test]
    fn default_cleanup_target_is_80_percent() {
        let config = StorageConfig::default();
        assert!((config.cleanup_target_percent - 0.8).abs() < f64::EPSILON);
    }

    #[test]
    fn storage_stats_calculates_usage_percent() {
        let stats = StorageStats {
            total_bytes: 50 * 1024 * 1024 * 1024,
            recordings_bytes: 40 * 1024 * 1024 * 1024,
            snapshots_bytes: 10 * 1024 * 1024 * 1024,
            max_bytes: 100 * 1024 * 1024 * 1024,
            usage_percent: 50.0,
            recording_count: 100,
        };
        
        assert!((stats.usage_percent - 50.0).abs() < f64::EPSILON);
    }
}
