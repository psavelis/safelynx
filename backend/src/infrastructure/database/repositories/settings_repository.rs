//! Settings Repository Implementation

use async_trait::async_trait;
use sqlx::PgPool;

use crate::domain::entities::Settings;
use crate::domain::repositories::{RepoResult, RepositoryError, SettingsRepository};

/// PostgreSQL settings repository.
pub struct PgSettingsRepository {
    pool: PgPool,
}

impl PgSettingsRepository {
    /// Creates a new settings repository.
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl SettingsRepository for PgSettingsRepository {
    async fn get(&self) -> RepoResult<Settings> {
        let row: Option<(serde_json::Value,)> =
            sqlx::query_as(r#"SELECT config FROM settings WHERE id = 1"#)
                .fetch_optional(&self.pool)
                .await?;

        match row {
            Some((config,)) => {
                let settings: Settings = serde_json::from_value(config).unwrap_or_default();
                Ok(settings)
            }
            None => Ok(Settings::default()),
        }
    }

    async fn save(&self, settings: &Settings) -> RepoResult<()> {
        let config = serde_json::to_value(settings)
            .map_err(|e| RepositoryError::Serialization(e.to_string()))?;

        sqlx::query(
            r#"
            INSERT INTO settings (id, config) 
            VALUES (1, $1)
            ON CONFLICT (id) DO UPDATE SET config = $1
            "#,
        )
        .bind(config)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
