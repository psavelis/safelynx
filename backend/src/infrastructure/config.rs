//! Application Configuration
//!
//! Loads configuration from environment variables and config files.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Application configuration.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    /// Server host.
    pub host: String,
    /// Server port.
    pub port: u16,
    /// Database URL.
    pub database_url: String,
    /// Data directory for recordings and snapshots.
    pub data_dir: PathBuf,
    /// Enable CORS for frontend.
    pub cors_origin: String,
    /// Log level.
    pub log_level: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        let data_dir = dirs::document_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Safelynx");

        Self {
            host: "127.0.0.1".to_string(),
            port: 7889,
            database_url: "postgres://safelynx:safelynx@localhost:7888/safelynx".to_string(),
            data_dir,
            cors_origin: "http://localhost:7900".to_string(),
            log_level: "info".to_string(),
        }
    }
}

impl AppConfig {
    /// Loads configuration from environment variables.
    pub fn load() -> Result<Self> {
        dotenvy::dotenv().ok();

        let mut config = Self::default();

        if let Ok(host) = std::env::var("HOST") {
            config.host = host;
        }

        if let Ok(port) = std::env::var("PORT") {
            config.port = port.parse().unwrap_or(7889);
        }

        if let Ok(database_url) = std::env::var("DATABASE_URL") {
            config.database_url = database_url;
        }

        if let Ok(data_dir) = std::env::var("DATA_DIR") {
            config.data_dir = PathBuf::from(data_dir);
        }

        if let Ok(cors_origin) = std::env::var("CORS_ORIGIN") {
            config.cors_origin = cors_origin;
        }

        if let Ok(log_level) = std::env::var("RUST_LOG") {
            config.log_level = log_level;
        }

        Ok(config)
    }

    /// Returns the recordings directory path.
    pub fn recordings_dir(&self) -> PathBuf {
        self.data_dir.join("recordings")
    }

    /// Returns the snapshots directory path.
    pub fn snapshots_dir(&self) -> PathBuf {
        self.data_dir.join("snapshots")
    }

    /// Returns the logs directory path.
    pub fn logs_dir(&self) -> PathBuf {
        self.data_dir.join("logs")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_has_correct_port() {
        let config = AppConfig::default();
        assert_eq!(config.port, 7889);
    }

    #[test]
    fn default_config_points_to_documents() {
        let config = AppConfig::default();
        assert!(config.data_dir.to_string_lossy().contains("Safelynx"));
    }
}
