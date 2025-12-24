//! Manage Profiles Use Case
//!
//! Handles CRUD operations for profiles.

use std::sync::Arc;
use uuid::Uuid;

use crate::application::services::FaceMatcher;
use crate::domain::entities::{Profile, ProfileClassification};
use crate::domain::repositories::{ProfileRepository, RepoResult, SightingRepository};
use crate::domain::value_objects::ProfileTag;

/// Request to update a profile.
#[derive(Debug, Clone)]
pub struct UpdateProfileRequest {
    pub name: Option<String>,
    pub classification: Option<ProfileClassification>,
    pub notes: Option<String>,
    pub tags_to_add: Vec<String>,
    pub tags_to_remove: Vec<String>,
}

/// Use case for managing profiles.
pub struct ManageProfilesUseCase {
    profile_repo: Arc<dyn ProfileRepository>,
    sighting_repo: Arc<dyn SightingRepository>,
    face_matcher: Arc<FaceMatcher>,
}

impl ManageProfilesUseCase {
    /// Creates a new manage profiles use case.
    pub fn new(
        profile_repo: Arc<dyn ProfileRepository>,
        sighting_repo: Arc<dyn SightingRepository>,
        face_matcher: Arc<FaceMatcher>,
    ) -> Self {
        Self {
            profile_repo,
            sighting_repo,
            face_matcher,
        }
    }

    /// Gets a profile by ID with sighting count.
    pub async fn get_profile(&self, id: Uuid) -> RepoResult<Option<Profile>> {
        self.profile_repo.find_by_id(id).await
    }

    /// Lists all active profiles.
    pub async fn list_profiles(&self) -> RepoResult<Vec<Profile>> {
        self.profile_repo.find_all_active().await
    }

    /// Updates a profile with the given changes.
    pub async fn update_profile(
        &self,
        id: Uuid,
        request: UpdateProfileRequest,
    ) -> RepoResult<Option<Profile>> {
        let profile = match self.profile_repo.find_by_id(id).await? {
            Some(p) => p,
            None => return Ok(None),
        };

        let mut profile = profile;

        if let Some(name) = request.name {
            profile.set_name(if name.is_empty() { None } else { Some(name) });
        }

        if let Some(classification) = request.classification {
            profile.set_classification(classification);
        }

        if let Some(notes) = request.notes {
            profile.set_notes(if notes.is_empty() { None } else { Some(notes) });
        }

        for tag_name in request.tags_to_add {
            profile.add_tag(ProfileTag::new(tag_name));
        }

        for tag_name in request.tags_to_remove {
            profile.remove_tag(&ProfileTag::new(tag_name));
        }

        self.profile_repo.update(&profile).await?;

        Ok(Some(profile))
    }

    /// Deactivates (soft deletes) a profile.
    pub async fn deactivate_profile(&self, id: Uuid) -> RepoResult<bool> {
        let profile = match self.profile_repo.find_by_id(id).await? {
            Some(p) => p,
            None => return Ok(false),
        };

        let mut profile = profile;
        profile.deactivate();
        
        self.profile_repo.update(&profile).await?;
        self.face_matcher.remove_from_cache(id).await;

        Ok(true)
    }

    /// Reactivates a deactivated profile.
    pub async fn reactivate_profile(&self, id: Uuid) -> RepoResult<bool> {
        let profile = match self.profile_repo.find_by_id(id).await? {
            Some(p) => p,
            None => return Ok(false),
        };

        let mut profile = profile;
        profile.reactivate();
        
        self.profile_repo.update(&profile).await?;
        self.face_matcher.add_to_cache(id, profile.embedding().clone()).await;

        Ok(true)
    }

    /// Merges two profiles (keeps target, removes source).
    pub async fn merge_profiles(&self, target_id: Uuid, source_id: Uuid) -> RepoResult<bool> {
        let target = self.profile_repo.find_by_id(target_id).await?;
        let source = self.profile_repo.find_by_id(source_id).await?;

        match (target, source) {
            (Some(_target), Some(source)) => {
                // Deactivate the source profile
                let mut source = source;
                source.deactivate();
                self.profile_repo.update(&source).await?;
                self.face_matcher.remove_from_cache(source_id).await;

                Ok(true)
            }
            _ => Ok(false),
        }
    }

    /// Gets profile statistics.
    pub async fn get_stats(&self) -> RepoResult<ProfileStats> {
        let profiles = self.profile_repo.find_all_active().await?;
        
        let mut stats = ProfileStats::default();
        stats.total = profiles.len() as i64;
        
        for profile in profiles {
            match profile.classification() {
                ProfileClassification::Trusted => stats.trusted += 1,
                ProfileClassification::Known => stats.known += 1,
                ProfileClassification::Unknown => stats.unknown += 1,
                ProfileClassification::Flagged => stats.flagged += 1,
            }
        }
        
        stats.total_sightings = self.sighting_repo.count().await?;
        
        Ok(stats)
    }
}

/// Profile statistics.
#[derive(Debug, Clone, Default)]
pub struct ProfileStats {
    pub total: i64,
    pub trusted: i64,
    pub known: i64,
    pub unknown: i64,
    pub flagged: i64,
    pub total_sightings: i64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn profile_stats_default_is_zero() {
        let stats = ProfileStats::default();
        assert_eq!(stats.total, 0);
        assert_eq!(stats.trusted, 0);
        assert_eq!(stats.unknown, 0);
    }
}
