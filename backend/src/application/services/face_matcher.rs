//! Face Matcher Service
//!
//! Matches detected faces against known profiles using embedding similarity.
//! Reference: https://arxiv.org/abs/1503.03832 (FaceNet: A Unified Embedding for Face Recognition)

use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use crate::domain::repositories::{ProfileRepository, RepoResult};
use crate::domain::value_objects::FaceEmbedding;

/// Result of a face matching operation.
#[derive(Debug, Clone)]
pub struct MatchResult {
    pub profile_id: Uuid,
    pub distance: f32,
    pub confidence: f32,
}

/// Service for matching face embeddings to profiles.
pub struct FaceMatcher {
    profile_repo: Arc<dyn ProfileRepository>,
    /// Cached embeddings for fast matching.
    embedding_cache: RwLock<Vec<(Uuid, FaceEmbedding)>>,
    /// Match threshold (lower = stricter matching).
    threshold: RwLock<f32>,
}

impl FaceMatcher {
    /// Creates a new face matcher.
    pub fn new(profile_repo: Arc<dyn ProfileRepository>, threshold: f32) -> Self {
        Self {
            profile_repo,
            embedding_cache: RwLock::new(Vec::new()),
            threshold: RwLock::new(threshold),
        }
    }

    /// Loads all profile embeddings into cache for fast matching.
    pub async fn load_cache(&self) -> RepoResult<()> {
        let profiles = self.profile_repo.find_all_active().await?;
        let mut cache = self.embedding_cache.write().await;
        cache.clear();

        for profile in profiles {
            cache.push((profile.id(), profile.embedding().clone()));
        }

        tracing::info!("Loaded {} profile embeddings into cache", cache.len());
        Ok(())
    }

    /// Adds a profile embedding to the cache.
    pub async fn add_to_cache(&self, profile_id: Uuid, embedding: FaceEmbedding) {
        let mut cache = self.embedding_cache.write().await;
        cache.push((profile_id, embedding));
    }

    /// Removes a profile from the cache.
    pub async fn remove_from_cache(&self, profile_id: Uuid) {
        let mut cache = self.embedding_cache.write().await;
        cache.retain(|(id, _)| *id != profile_id);
    }

    /// Updates the match threshold.
    pub async fn set_threshold(&self, threshold: f32) {
        *self.threshold.write().await = threshold;
    }

    /// Gets the current threshold.
    pub async fn threshold(&self) -> f32 {
        *self.threshold.read().await
    }

    /// Finds the best matching profile for an embedding.
    /// Returns None if no profile is within the threshold.
    pub async fn find_match(&self, embedding: &FaceEmbedding) -> Option<MatchResult> {
        let cache = self.embedding_cache.read().await;
        let threshold = *self.threshold.read().await;

        let mut best_match: Option<(Uuid, f32)> = None;

        for (profile_id, stored_embedding) in cache.iter() {
            let distance = embedding.distance(stored_embedding);

            if distance < threshold {
                match &best_match {
                    None => best_match = Some((*profile_id, distance)),
                    Some((_, best_distance)) if distance < *best_distance => {
                        best_match = Some((*profile_id, distance));
                    }
                    _ => {}
                }
            }
        }

        best_match.map(|(profile_id, distance)| {
            let confidence = Self::distance_to_confidence(distance, threshold);
            MatchResult {
                profile_id,
                distance,
                confidence,
            }
        })
    }

    /// Finds all profiles within the threshold, sorted by distance.
    pub async fn find_all_matches(&self, embedding: &FaceEmbedding) -> Vec<MatchResult> {
        let cache = self.embedding_cache.read().await;
        let threshold = *self.threshold.read().await;

        let mut matches: Vec<_> = cache
            .iter()
            .map(|(profile_id, stored_embedding)| {
                let distance = embedding.distance(stored_embedding);
                (*profile_id, distance)
            })
            .filter(|(_, distance)| *distance < threshold)
            .collect();

        matches.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

        matches
            .into_iter()
            .map(|(profile_id, distance)| {
                let confidence = Self::distance_to_confidence(distance, threshold);
                MatchResult {
                    profile_id,
                    distance,
                    confidence,
                }
            })
            .collect()
    }

    /// Converts a distance to a confidence score (0.0-1.0).
    /// Lower distance = higher confidence.
    fn distance_to_confidence(distance: f32, threshold: f32) -> f32 {
        (1.0 - (distance / threshold)).max(0.0).min(1.0)
    }

    /// Returns the number of cached profiles.
    pub async fn cache_size(&self) -> usize {
        self.embedding_cache.read().await.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::domain::entities::Profile;
    use crate::domain::value_objects::EMBEDDING_DIMENSION;
    use async_trait::async_trait;
    use std::sync::Arc;

    struct MockProfileRepo;

    #[async_trait]
    impl ProfileRepository for MockProfileRepo {
        async fn find_by_id(&self, _id: Uuid) -> RepoResult<Option<Profile>> {
            Ok(None)
        }
        async fn find_all_active(&self) -> RepoResult<Vec<Profile>> {
            Ok(vec![])
        }
        async fn find_by_embedding(
            &self,
            _: &FaceEmbedding,
            _: f32,
        ) -> RepoResult<Vec<(Profile, f32)>> {
            Ok(vec![])
        }
        async fn save(&self, _: &Profile) -> RepoResult<()> {
            Ok(())
        }
        async fn update(&self, _: &Profile) -> RepoResult<()> {
            Ok(())
        }
        async fn delete(&self, _: Uuid) -> RepoResult<()> {
            Ok(())
        }
        async fn count(&self) -> RepoResult<i64> {
            Ok(0)
        }
    }

    fn create_embedding(value: f32) -> FaceEmbedding {
        FaceEmbedding::new(vec![value; EMBEDDING_DIMENSION])
    }

    #[tokio::test]
    async fn find_match_returns_none_when_empty_cache() {
        let matcher = FaceMatcher::new(Arc::new(MockProfileRepo), 0.6);
        let embedding = create_embedding(0.5);
        let result = matcher.find_match(&embedding).await;
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_match_returns_best_match_within_threshold() {
        let matcher = FaceMatcher::new(Arc::new(MockProfileRepo), 0.6);

        let profile_id = Uuid::new_v4();
        matcher
            .add_to_cache(profile_id, create_embedding(0.5))
            .await;

        let query = create_embedding(0.5);
        let result = matcher.find_match(&query).await;

        assert!(result.is_some());
        assert_eq!(result.unwrap().profile_id, profile_id);
    }

    #[tokio::test]
    async fn find_match_returns_none_when_outside_threshold() {
        let matcher = FaceMatcher::new(Arc::new(MockProfileRepo), 0.1);

        matcher
            .add_to_cache(Uuid::new_v4(), create_embedding(0.0))
            .await;

        let query = create_embedding(1.0);
        let result = matcher.find_match(&query).await;

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn remove_from_cache_removes_profile() {
        let matcher = FaceMatcher::new(Arc::new(MockProfileRepo), 0.6);
        let profile_id = Uuid::new_v4();

        matcher
            .add_to_cache(profile_id, create_embedding(0.5))
            .await;
        assert_eq!(matcher.cache_size().await, 1);

        matcher.remove_from_cache(profile_id).await;
        assert_eq!(matcher.cache_size().await, 0);
    }
}
