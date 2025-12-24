//! Profile Repository Implementation

use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::Profile;
use crate::domain::repositories::{ProfileRepository, RepoResult, RepositoryError};
use crate::domain::value_objects::{FaceEmbedding, ProfileTag};
use crate::infrastructure::database::models::ProfileRow;

/// PostgreSQL profile repository.
pub struct PgProfileRepository {
    pool: PgPool,
}

impl PgProfileRepository {
    /// Creates a new profile repository.
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    fn row_to_profile(&self, r: ProfileRow) -> Option<Profile> {
        let embedding = FaceEmbedding::from_bytes(&r.embedding)?;

        let tags: Vec<ProfileTag> = r
            .tags
            .0
            .iter()
            .filter_map(|v| v.as_str().map(|s| ProfileTag::new(s.to_string())))
            .collect();

        Some(Profile::from_db(
            r.id,
            r.name,
            r.classification,
            embedding,
            r.thumbnail_path,
            tags,
            r.notes,
            r.first_seen_at,
            r.last_seen_at,
            r.sighting_count,
            r.is_active,
            r.created_at,
            r.updated_at,
        ))
    }
}

#[async_trait]
impl ProfileRepository for PgProfileRepository {
    async fn find_by_id(&self, id: Uuid) -> RepoResult<Option<Profile>> {
        let row: Option<ProfileRow> = sqlx::query_as(
            r#"
            SELECT 
                id, name, classification, embedding, thumbnail_path, 
                tags, notes, first_seen_at, last_seen_at, sighting_count,
                is_active, created_at, updated_at
            FROM profiles
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(r) => Ok(self.row_to_profile(r)),
            None => Ok(None),
        }
    }

    async fn find_all_active(&self) -> RepoResult<Vec<Profile>> {
        let rows: Vec<ProfileRow> = sqlx::query_as(
            r#"
            SELECT 
                id, name, classification, embedding, thumbnail_path, 
                tags, notes, first_seen_at, last_seen_at, sighting_count,
                is_active, created_at, updated_at
            FROM profiles
            WHERE is_active = TRUE
            ORDER BY last_seen_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let profiles: Vec<Profile> = rows
            .into_iter()
            .filter_map(|r| self.row_to_profile(r))
            .collect();

        Ok(profiles)
    }

    async fn find_by_embedding(
        &self,
        _embedding: &FaceEmbedding,
        _threshold: f32,
    ) -> RepoResult<Vec<(Profile, f32)>> {
        // Note: In-memory matching is used via FaceMatcher for performance.
        // This method exists for potential future DB-level vector search (pgvector).
        Ok(vec![])
    }

    async fn save(&self, profile: &Profile) -> RepoResult<()> {
        let tags_json =
            serde_json::to_value(profile.tags().iter().map(|t| t.value()).collect::<Vec<_>>())
                .unwrap_or_default();

        sqlx::query(
            r#"
            INSERT INTO profiles (
                id, name, classification, embedding, thumbnail_path,
                tags, notes, first_seen_at, last_seen_at, sighting_count,
                is_active, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            "#,
        )
        .bind(profile.id())
        .bind(profile.name())
        .bind(profile.classification())
        .bind(profile.embedding().to_bytes())
        .bind(profile.thumbnail_path())
        .bind(tags_json)
        .bind(profile.notes())
        .bind(profile.first_seen_at())
        .bind(profile.last_seen_at())
        .bind(profile.sighting_count())
        .bind(profile.is_active())
        .bind(profile.created_at())
        .bind(profile.updated_at())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update(&self, profile: &Profile) -> RepoResult<()> {
        let tags_json =
            serde_json::to_value(profile.tags().iter().map(|t| t.value()).collect::<Vec<_>>())
                .unwrap_or_default();

        let result = sqlx::query(
            r#"
            UPDATE profiles SET
                name = $2,
                classification = $3,
                embedding = $4,
                thumbnail_path = $5,
                tags = $6,
                notes = $7,
                last_seen_at = $8,
                sighting_count = $9,
                is_active = $10,
                updated_at = $11
            WHERE id = $1
            "#,
        )
        .bind(profile.id())
        .bind(profile.name())
        .bind(profile.classification())
        .bind(profile.embedding().to_bytes())
        .bind(profile.thumbnail_path())
        .bind(tags_json)
        .bind(profile.notes())
        .bind(profile.last_seen_at())
        .bind(profile.sighting_count())
        .bind(profile.is_active())
        .bind(profile.updated_at())
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(RepositoryError::NotFound(format!(
                "Profile {}",
                profile.id()
            )));
        }

        Ok(())
    }

    async fn delete(&self, id: Uuid) -> RepoResult<()> {
        let result = sqlx::query(r#"UPDATE profiles SET is_active = FALSE WHERE id = $1"#)
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(RepositoryError::NotFound(format!("Profile {}", id)));
        }

        Ok(())
    }

    async fn count(&self) -> RepoResult<i64> {
        let result: (i64,) =
            sqlx::query_as(r#"SELECT COUNT(*) FROM profiles WHERE is_active = TRUE"#)
                .fetch_one(&self.pool)
                .await?;

        Ok(result.0)
    }
}
