//! Sighting Repository Implementation

use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::Sighting;
use crate::domain::repositories::{RepoResult, SightingRepository};
use crate::domain::value_objects::{BoundingBox, GeoLocation};
use crate::infrastructure::database::models::SightingRow;

/// PostgreSQL sighting repository.
pub struct PgSightingRepository {
    pool: PgPool,
}

impl PgSightingRepository {
    /// Creates a new sighting repository.
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    fn row_to_sighting(&self, r: SightingRow) -> Sighting {
        let bbox = BoundingBox::new(r.bbox_x, r.bbox_y, r.bbox_width, r.bbox_height);
        let location = match (r.location_lat, r.location_lon) {
            (Some(lat), Some(lon)) => Some(GeoLocation::new(lat, lon)),
            _ => None,
        };

        Sighting::from_db(
            r.id,
            r.profile_id,
            r.camera_id,
            r.snapshot_path,
            bbox,
            r.confidence,
            location,
            r.recording_id,
            r.recording_timestamp_ms,
            r.detected_at,
        )
    }
}

#[async_trait]
impl SightingRepository for PgSightingRepository {
    async fn find_by_id(&self, id: Uuid) -> RepoResult<Option<Sighting>> {
        let row: Option<SightingRow> = sqlx::query_as(
            r#"
            SELECT 
                id, profile_id, camera_id, snapshot_path,
                bbox_x, bbox_y, bbox_width, bbox_height,
                confidence, location_lat, location_lon,
                recording_id, recording_timestamp_ms, detected_at
            FROM sightings
            WHERE id = $1
            "#
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| self.row_to_sighting(r)))
    }

    async fn find_by_profile(&self, profile_id: Uuid, limit: i64) -> RepoResult<Vec<Sighting>> {
        let rows: Vec<SightingRow> = sqlx::query_as(
            r#"
            SELECT 
                id, profile_id, camera_id, snapshot_path,
                bbox_x, bbox_y, bbox_width, bbox_height,
                confidence, location_lat, location_lon,
                recording_id, recording_timestamp_ms, detected_at
            FROM sightings
            WHERE profile_id = $1
            ORDER BY detected_at DESC
            LIMIT $2
            "#
        )
        .bind(profile_id)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| self.row_to_sighting(r)).collect())
    }

    async fn find_in_range(
        &self,
        start: DateTime<Utc>,
        end: DateTime<Utc>,
        limit: i64,
    ) -> RepoResult<Vec<Sighting>> {
        let rows: Vec<SightingRow> = sqlx::query_as(
            r#"
            SELECT 
                id, profile_id, camera_id, snapshot_path,
                bbox_x, bbox_y, bbox_width, bbox_height,
                confidence, location_lat, location_lon,
                recording_id, recording_timestamp_ms, detected_at
            FROM sightings
            WHERE detected_at BETWEEN $1 AND $2
            ORDER BY detected_at DESC
            LIMIT $3
            "#
        )
        .bind(start)
        .bind(end)
        .bind(limit)
        .fetch_all(&self.pool)
        .await?;

        Ok(rows.into_iter().map(|r| self.row_to_sighting(r)).collect())
    }

    async fn save(&self, sighting: &Sighting) -> RepoResult<()> {
        let bbox = sighting.bounding_box();
        let (lat, lon) = sighting
            .location()
            .map(|l| (Some(l.latitude()), Some(l.longitude())))
            .unwrap_or((None, None));

        sqlx::query(
            r#"
            INSERT INTO sightings (
                id, profile_id, camera_id, snapshot_path,
                bbox_x, bbox_y, bbox_width, bbox_height,
                confidence, location_lat, location_lon,
                recording_id, recording_timestamp_ms, detected_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            "#
        )
        .bind(sighting.id())
        .bind(sighting.profile_id())
        .bind(sighting.camera_id())
        .bind(sighting.snapshot_path())
        .bind(bbox.x())
        .bind(bbox.y())
        .bind(bbox.width())
        .bind(bbox.height())
        .bind(sighting.confidence())
        .bind(lat)
        .bind(lon)
        .bind(sighting.recording_id())
        .bind(sighting.recording_timestamp_ms())
        .bind(sighting.detected_at())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn get_location_heatmap(&self) -> RepoResult<Vec<(f64, f64, i64)>> {
        let rows: Vec<(f64, f64, i64)> = sqlx::query_as(
            r#"
            SELECT 
                ROUND(location_lat::numeric, 4)::float8,
                ROUND(location_lon::numeric, 4)::float8,
                COUNT(*)::bigint
            FROM sightings
            WHERE location_lat IS NOT NULL AND location_lon IS NOT NULL
            GROUP BY ROUND(location_lat::numeric, 4), ROUND(location_lon::numeric, 4)
            ORDER BY 3 DESC
            LIMIT 1000
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn count(&self) -> RepoResult<i64> {
        let result: (i64,) = sqlx::query_as(r#"SELECT COUNT(*) FROM sightings"#)
            .fetch_one(&self.pool)
            .await?;

        Ok(result.0)
    }

    async fn count_by_profile(&self, profile_id: Uuid) -> RepoResult<i64> {
        let result: (i64,) = sqlx::query_as(
            r#"SELECT COUNT(*) FROM sightings WHERE profile_id = $1"#
        )
        .bind(profile_id)
        .fetch_one(&self.pool)
        .await?;

        Ok(result.0)
    }
}
