//! Camera Repository Implementation

use async_trait::async_trait;
use sqlx::PgPool;
use uuid::Uuid;

use crate::domain::entities::{Camera, CameraStatus, CameraType};
use crate::domain::repositories::{CameraRepository, RepoResult, RepositoryError};
use crate::domain::value_objects::GeoLocation;
use crate::infrastructure::database::models::CameraRow;

/// PostgreSQL camera repository.
pub struct PgCameraRepository {
    pool: PgPool,
}

impl PgCameraRepository {
    /// Creates a new camera repository.
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Converts a CameraRow to a Camera entity.
    fn row_to_camera(&self, r: CameraRow) -> Camera {
        let location = match (r.location_lat, r.location_lon) {
            (Some(lat), Some(lon)) => Some(GeoLocation::with_metadata(
                lat,
                lon,
                r.location_alt,
                None,
                r.location_name,
            )),
            _ => None,
        };

        Camera::from_db(
            r.id,
            r.name,
            r.camera_type,
            r.device_id,
            r.rtsp_url,
            location,
            r.status,
            r.resolution_width,
            r.resolution_height,
            r.fps,
            r.is_enabled,
            r.last_frame_at,
            r.created_at,
            r.updated_at,
        )
    }
}

#[async_trait]
impl CameraRepository for PgCameraRepository {
    async fn find_by_id(&self, id: Uuid) -> RepoResult<Option<Camera>> {
        let row = sqlx::query_as::<_, CameraRow>(
            r#"
            SELECT 
                id, name, camera_type, device_id, rtsp_url,
                location_lat, location_lon, location_alt, location_name,
                status, resolution_width, resolution_height, fps,
                is_enabled, last_frame_at, created_at, updated_at
            FROM cameras
            WHERE id = $1
            "#,
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(|r| self.row_to_camera(r)))
    }

    async fn find_all(&self) -> RepoResult<Vec<Camera>> {
        let rows = sqlx::query_as::<_, CameraRow>(
            r#"
            SELECT 
                id, name, camera_type, device_id, rtsp_url,
                location_lat, location_lon, location_alt, location_name,
                status, resolution_width, resolution_height, fps,
                is_enabled, last_frame_at, created_at, updated_at
            FROM cameras
            ORDER BY created_at ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let cameras = rows.into_iter().map(|r| self.row_to_camera(r)).collect();

        Ok(cameras)
    }

    async fn find_enabled(&self) -> RepoResult<Vec<Camera>> {
        let rows = sqlx::query_as::<_, CameraRow>(
            r#"
            SELECT 
                id, name, camera_type, device_id, rtsp_url,
                location_lat, location_lon, location_alt, location_name,
                status, resolution_width, resolution_height, fps,
                is_enabled, last_frame_at, created_at, updated_at
            FROM cameras
            WHERE is_enabled = TRUE
            ORDER BY created_at ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await?;

        let cameras = rows.into_iter().map(|r| self.row_to_camera(r)).collect();

        Ok(cameras)
    }

    async fn save(&self, camera: &Camera) -> RepoResult<()> {
        let (lat, lon, alt, loc_name) = camera
            .location()
            .map(|l| {
                (
                    Some(l.latitude()),
                    Some(l.longitude()),
                    l.altitude(),
                    l.name().map(String::from),
                )
            })
            .unwrap_or((None, None, None, None));

        sqlx::query(
            r#"
            INSERT INTO cameras (
                id, name, camera_type, device_id, rtsp_url,
                location_lat, location_lon, location_alt, location_name,
                status, resolution_width, resolution_height, fps,
                is_enabled, last_frame_at, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
            "#,
        )
        .bind(camera.id())
        .bind(camera.name())
        .bind(camera.camera_type() as CameraType)
        .bind(camera.device_id())
        .bind(camera.rtsp_url())
        .bind(lat)
        .bind(lon)
        .bind(alt)
        .bind(loc_name)
        .bind(camera.status() as CameraStatus)
        .bind(camera.resolution().0)
        .bind(camera.resolution().1)
        .bind(camera.fps())
        .bind(camera.is_enabled())
        .bind(camera.last_frame_at())
        .bind(camera.created_at())
        .bind(camera.updated_at())
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn update(&self, camera: &Camera) -> RepoResult<()> {
        let (lat, lon, alt, loc_name) = camera
            .location()
            .map(|l| {
                (
                    Some(l.latitude()),
                    Some(l.longitude()),
                    l.altitude(),
                    l.name().map(String::from),
                )
            })
            .unwrap_or((None, None, None, None));

        let result = sqlx::query(
            r#"
            UPDATE cameras SET
                name = $2,
                rtsp_url = $3,
                location_lat = $4,
                location_lon = $5,
                location_alt = $6,
                location_name = $7,
                status = $8,
                resolution_width = $9,
                resolution_height = $10,
                fps = $11,
                is_enabled = $12,
                last_frame_at = $13,
                updated_at = $14
            WHERE id = $1
            "#,
        )
        .bind(camera.id())
        .bind(camera.name())
        .bind(camera.rtsp_url())
        .bind(lat)
        .bind(lon)
        .bind(alt)
        .bind(loc_name)
        .bind(camera.status() as CameraStatus)
        .bind(camera.resolution().0)
        .bind(camera.resolution().1)
        .bind(camera.fps())
        .bind(camera.is_enabled())
        .bind(camera.last_frame_at())
        .bind(camera.updated_at())
        .execute(&self.pool)
        .await?;

        if result.rows_affected() == 0 {
            return Err(RepositoryError::NotFound(format!("Camera {}", camera.id())));
        }

        Ok(())
    }

    async fn delete(&self, id: Uuid) -> RepoResult<()> {
        let result = sqlx::query(r#"DELETE FROM cameras WHERE id = $1"#)
            .bind(id)
            .execute(&self.pool)
            .await?;

        if result.rows_affected() == 0 {
            return Err(RepositoryError::NotFound(format!("Camera {}", id)));
        }

        Ok(())
    }
}
