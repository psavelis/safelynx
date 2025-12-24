//! Recording Repository Implementation

use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::Recording;
use crate::domain::repositories::{RecordingRepository, RepoResult, RepositoryError};
use crate::infrastructure::database::models::RecordingRow;

/// PostgreSQL recording repository.
pub struct PgRecordingRepository {
    pool: PgPool,
}

impl PgRecordingRepository {
    /// Creates a new recording repository.
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    fn row_to_recording(&self, r: RecordingRow) -> Recording {
        Recording::from_db(
            r.id,
            r.camera_id,
            r.file_path,
            r.file_size_bytes,
            r.duration_ms,
            r.frame_count,
            r.status,
            r.has_detections,
            r.started_at,
            r.ended_at,
            r.created_at,
        )
    }
}

#[async_trait]
impl RecordingRepository for PgRecordingRepository {
    async fn find_by_id(&self, id: Uuid) -> RepoResult<Option<Recording>> {
        let row: Option<RecordingRow> = sqlx::query_as(
            r#"
            SELECT 
                id, camera_id, file_path, file_size_bytes,
                duration_ms, frame_count, status,
                has_detections, started_at, ended_at, created_at
            FROM recordings
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| self.row_to_recording(r)))
    }

    async fn find_all(&self, limit: i64) -> RepoResult<Vec<Recording>> {
        let rows: Vec<RecordingRow> = sqlx::query_as(
            r#"
            SELECT 
                id, camera_id, file_path, file_size_bytes,
                duration_ms, frame_count, status,
                has_detections, started_at, ended_at, created_at
            FROM recordings
            ORDER BY started_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| self.row_to_recording(r)).collect())
    }

    async fn find_by_camera(&self, camera_id: Uuid, limit: i64) -> RepoResult<Vec<Recording>> {
        let rows: Vec<RecordingRow> = sqlx::query_as(
            r#"
            SELECT 
                id, camera_id, file_path, file_size_bytes,
                duration_ms, frame_count, status,
                has_detections, started_at, ended_at, created_at
            FROM recordings
            WHERE camera_id = $1
            ORDER BY started_at DESC
            LIMIT $2
            "#,
        )
        .bind(camera_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| self.row_to_recording(r)).collect())
    }

    async fn find_with_detections(&self, limit: i64) -> RepoResult<Vec<Recording>> {
        let rows: Vec<RecordingRow> = sqlx::query_as(
            r#"
            SELECT 
                id, camera_id, file_path, file_size_bytes,
                duration_ms, frame_count, status,
                has_detections, started_at, ended_at, created_at
            FROM recordings
            WHERE has_detections = TRUE AND status = 'completed'
            ORDER BY started_at DESC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| self.row_to_recording(r)).collect())
    }

    async fn save(&self, recording: &Recording) -> RepoResult<()> {
        sqlx::query(
            r#"
            INSERT INTO recordings (
                id, camera_id, file_path, file_size_bytes,
                duration_ms, frame_count, status, has_detections,
                started_at, ended_at, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            "#,
        )
        .bind(recording.id())
        .bind(recording.camera_id())
        .bind(recording.file_path())
        .bind(recording.file_size_bytes())
        .bind(recording.duration_ms())
        .bind(recording.frame_count())
        .bind(recording.status())
        .bind(recording.has_detections())
        .bind(recording.started_at())
        .bind(recording.ended_at())
        .bind(recording.created_at())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update(&self, recording: &Recording) -> RepoResult<()> {
        let result = sqlx::query(
            r#"
            UPDATE recordings SET
                file_size_bytes = $2,
                duration_ms = $3,
                frame_count = $4,
                status = $5,
                has_detections = $6,
                ended_at = $7
            WHERE id = $1
            "#,
        )
        .bind(recording.id())
        .bind(recording.file_size_bytes())
        .bind(recording.duration_ms())
        .bind(recording.frame_count())
        .bind(recording.status())
        .bind(recording.has_detections())
        .bind(recording.ended_at())
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(RepositoryError::NotFound(format!(
                "Recording {}",
                recording.id()
            )));
        }

        Ok(())
    }

    async fn delete(&self, id: Uuid) -> RepoResult<()> {
        let result = sqlx::query(r#"DELETE FROM recordings WHERE id = $1"#)
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(RepositoryError::NotFound(format!("Recording {}", id)));
        }

        Ok(())
    }

    async fn total_storage_bytes(&self) -> RepoResult<i64> {
        let result: (i64,) = sqlx::query_as(
            r#"SELECT COALESCE(SUM(file_size_bytes)::BIGINT, 0) FROM recordings WHERE status != 'deleting'"#
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(result.0)
    }

    async fn find_oldest(&self, limit: i64) -> RepoResult<Vec<Recording>> {
        let rows: Vec<RecordingRow> = sqlx::query_as(
            r#"
            SELECT 
                id, camera_id, file_path, file_size_bytes,
                duration_ms, frame_count, status,
                has_detections, started_at, ended_at, created_at
            FROM recordings
            WHERE status = 'completed'
            ORDER BY started_at ASC
            LIMIT $1
            "#,
        )
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| self.row_to_recording(r)).collect())
    }
}
