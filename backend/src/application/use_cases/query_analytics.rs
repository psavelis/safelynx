//! Query Analytics Use Case
//!
//! Provides analytical queries for dashboards and heatmaps.

use chrono::{DateTime, Utc};
use std::sync::Arc;
use uuid::Uuid;

use crate::domain::entities::Sighting;
use crate::domain::repositories::{
    ProfileRepository, RecordingRepository, RepoResult, SightingRepository,
};

/// Time range filter for queries.
#[derive(Debug, Clone)]
pub struct TimeRange {
    pub start: DateTime<Utc>,
    pub end: DateTime<Utc>,
}

impl TimeRange {
    /// Creates a range for the last N hours.
    pub fn last_hours(hours: i64) -> Self {
        let end = Utc::now();
        let start = end - chrono::Duration::hours(hours);
        Self { start, end }
    }

    /// Creates a range for the last N days.
    pub fn last_days(days: i64) -> Self {
        let end = Utc::now();
        let start = end - chrono::Duration::days(days);
        Self { start, end }
    }

    /// Creates a range for today.
    pub fn today() -> Self {
        let end = Utc::now();
        let start = end
            .date_naive()
            .and_hms_opt(0, 0, 0)
            .map(|t| DateTime::from_naive_utc_and_offset(t, Utc))
            .unwrap_or(end);
        Self { start, end }
    }
}

/// Heatmap data point.
#[derive(Debug, Clone)]
pub struct HeatmapPoint {
    pub latitude: f64,
    pub longitude: f64,
    pub count: i64,
    pub intensity: f64,
}

/// Activity timeline entry.
#[derive(Debug, Clone)]
pub struct TimelineEntry {
    pub timestamp: DateTime<Utc>,
    pub profile_id: Uuid,
    pub profile_name: Option<String>,
    pub camera_id: Uuid,
    pub camera_name: String,
    pub event_type: String,
}

/// Dashboard summary statistics.
#[derive(Debug, Clone, Default)]
pub struct DashboardStats {
    pub total_profiles: i64,
    pub total_sightings: i64,
    pub sightings_today: i64,
    pub unique_profiles_today: i64,
    pub active_cameras: i64,
    pub storage_used_bytes: i64,
    pub storage_max_bytes: i64,
    pub recording_hours: f64,
}

/// Use case for analytical queries.
pub struct QueryAnalyticsUseCase {
    profile_repo: Arc<dyn ProfileRepository>,
    sighting_repo: Arc<dyn SightingRepository>,
    recording_repo: Arc<dyn RecordingRepository>,
}

impl QueryAnalyticsUseCase {
    /// Creates a new query analytics use case.
    pub fn new(
        profile_repo: Arc<dyn ProfileRepository>,
        sighting_repo: Arc<dyn SightingRepository>,
        recording_repo: Arc<dyn RecordingRepository>,
    ) -> Self {
        Self {
            profile_repo,
            sighting_repo,
            recording_repo,
        }
    }

    /// Gets dashboard summary statistics.
    pub async fn get_dashboard_stats(&self) -> RepoResult<DashboardStats> {
        let total_profiles = self.profile_repo.count().await?;
        let total_sightings = self.sighting_repo.count().await?;
        let storage_used_bytes = self.recording_repo.total_storage_bytes().await?;

        Ok(DashboardStats {
            total_profiles,
            total_sightings,
            sightings_today: 0,       // TODO: implement
            unique_profiles_today: 0, // TODO: implement
            active_cameras: 0,        // TODO: implement
            storage_used_bytes,
            storage_max_bytes: 100 * 1024 * 1024 * 1024,
            recording_hours: 0.0, // TODO: implement
        })
    }

    /// Gets heatmap data for profile sightings.
    pub async fn get_heatmap(&self) -> RepoResult<Vec<HeatmapPoint>> {
        let raw_data = self.sighting_repo.get_location_heatmap().await?;

        let max_count = raw_data.iter().map(|(_, _, c)| *c).max().unwrap_or(1);

        let points = raw_data
            .into_iter()
            .map(|(lat, lon, count)| HeatmapPoint {
                latitude: lat,
                longitude: lon,
                count,
                intensity: count as f64 / max_count as f64,
            })
            .collect();

        Ok(points)
    }

    /// Gets sightings within a time range.
    pub async fn get_sightings_in_range(
        &self,
        range: TimeRange,
        limit: i64,
    ) -> RepoResult<Vec<Sighting>> {
        self.sighting_repo
            .find_in_range(range.start, range.end, limit)
            .await
    }

    /// Gets sightings for a specific profile.
    pub async fn get_profile_sightings(
        &self,
        profile_id: Uuid,
        limit: i64,
    ) -> RepoResult<Vec<Sighting>> {
        self.sighting_repo.find_by_profile(profile_id, limit).await
    }

    /// Gets profiles sorted by sighting count.
    pub async fn get_most_seen_profiles(&self, limit: usize) -> RepoResult<Vec<(Uuid, i64)>> {
        let profiles = self.profile_repo.find_all_active().await?;

        let mut profile_counts: Vec<_> = profiles
            .into_iter()
            .map(|p| (p.id(), p.sighting_count()))
            .collect();

        profile_counts.sort_by(|a, b| b.1.cmp(&a.1));
        profile_counts.truncate(limit);

        Ok(profile_counts)
    }

    /// Gets sighting frequency by hour of day.
    pub async fn get_hourly_distribution(&self) -> RepoResult<[i64; 24]> {
        // TODO: Implement proper query
        Ok([0; 24])
    }

    /// Gets sighting frequency by day of week.
    pub async fn get_daily_distribution(&self) -> RepoResult<[i64; 7]> {
        // TODO: Implement proper query
        Ok([0; 7])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn time_range_last_hours_creates_correct_range() {
        let range = TimeRange::last_hours(24);
        let duration = range.end - range.start;
        assert_eq!(duration.num_hours(), 24);
    }

    #[test]
    fn time_range_last_days_creates_correct_range() {
        let range = TimeRange::last_days(7);
        let duration = range.end - range.start;
        assert_eq!(duration.num_days(), 7);
    }

    #[test]
    fn dashboard_stats_default_is_zero() {
        let stats = DashboardStats::default();
        assert_eq!(stats.total_profiles, 0);
        assert_eq!(stats.total_sightings, 0);
    }
}
