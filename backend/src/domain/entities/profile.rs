//! Profile Entity
//!
//! Represents an identified person with their face embedding and metadata.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::domain::value_objects::{FaceEmbedding, ProfileTag};

/// Classification level for a profile.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "profile_classification", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum ProfileClassification {
    /// Trusted household member or frequent visitor
    Trusted,
    /// Known visitor (delivery, maintenance, etc.)
    Known,
    /// Unknown person - needs classification
    Unknown,
    /// Flagged for alerts
    Flagged,
}

impl Default for ProfileClassification {
    fn default() -> Self {
        Self::Unknown
    }
}

/// A profile represents a unique individual identified by the system.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    id: Uuid,
    name: Option<String>,
    classification: ProfileClassification,
    embedding: FaceEmbedding,
    thumbnail_path: Option<String>,
    tags: Vec<ProfileTag>,
    notes: Option<String>,
    first_seen_at: DateTime<Utc>,
    last_seen_at: DateTime<Utc>,
    sighting_count: i64,
    is_active: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

impl Profile {
    /// Creates a new profile from a face detection.
    pub fn new(embedding: FaceEmbedding, thumbnail_path: Option<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name: None,
            classification: ProfileClassification::default(),
            embedding,
            thumbnail_path,
            tags: Vec::new(),
            notes: None,
            first_seen_at: now,
            last_seen_at: now,
            sighting_count: 1,
            is_active: true,
            created_at: now,
            updated_at: now,
        }
    }

    /// Reconstructs a profile from database fields.
    #[allow(clippy::too_many_arguments)]
    pub fn from_db(
        id: Uuid,
        name: Option<String>,
        classification: ProfileClassification,
        embedding: FaceEmbedding,
        thumbnail_path: Option<String>,
        tags: Vec<ProfileTag>,
        notes: Option<String>,
        first_seen_at: DateTime<Utc>,
        last_seen_at: DateTime<Utc>,
        sighting_count: i64,
        is_active: bool,
        created_at: DateTime<Utc>,
        updated_at: DateTime<Utc>,
    ) -> Self {
        Self {
            id,
            name,
            classification,
            embedding,
            thumbnail_path,
            tags,
            notes,
            first_seen_at,
            last_seen_at,
            sighting_count,
            is_active,
            created_at,
            updated_at,
        }
    }

    pub fn id(&self) -> Uuid {
        self.id
    }

    pub fn name(&self) -> Option<&str> {
        self.name.as_deref()
    }

    pub fn display_name(&self) -> String {
        self.name
            .clone()
            .unwrap_or_else(|| format!("Unknown #{}", &self.id.to_string()[..8]))
    }

    pub fn classification(&self) -> ProfileClassification {
        self.classification
    }

    pub fn embedding(&self) -> &FaceEmbedding {
        &self.embedding
    }

    pub fn thumbnail_path(&self) -> Option<&str> {
        self.thumbnail_path.as_deref()
    }

    pub fn tags(&self) -> &[ProfileTag] {
        &self.tags
    }

    pub fn notes(&self) -> Option<&str> {
        self.notes.as_deref()
    }

    pub fn first_seen_at(&self) -> DateTime<Utc> {
        self.first_seen_at
    }

    pub fn last_seen_at(&self) -> DateTime<Utc> {
        self.last_seen_at
    }

    pub fn sighting_count(&self) -> i64 {
        self.sighting_count
    }

    pub fn is_active(&self) -> bool {
        self.is_active
    }

    pub fn created_at(&self) -> DateTime<Utc> {
        self.created_at
    }

    pub fn updated_at(&self) -> DateTime<Utc> {
        self.updated_at
    }

    /// Updates the profile name.
    pub fn set_name(&mut self, name: Option<String>) {
        self.name = name;
        self.updated_at = Utc::now();
    }

    /// Updates the classification level.
    pub fn set_classification(&mut self, classification: ProfileClassification) {
        self.classification = classification;
        self.updated_at = Utc::now();
    }

    /// Adds a tag to the profile.
    pub fn add_tag(&mut self, tag: ProfileTag) {
        if !self.tags.contains(&tag) {
            self.tags.push(tag);
            self.updated_at = Utc::now();
        }
    }

    /// Removes a tag from the profile.
    pub fn remove_tag(&mut self, tag: &ProfileTag) {
        self.tags.retain(|t| t != tag);
        self.updated_at = Utc::now();
    }

    /// Updates notes.
    pub fn set_notes(&mut self, notes: Option<String>) {
        self.notes = notes;
        self.updated_at = Utc::now();
    }

    /// Records a new sighting of this profile.
    pub fn record_sighting(&mut self) {
        self.sighting_count += 1;
        self.last_seen_at = Utc::now();
        self.updated_at = Utc::now();
    }

    /// Deactivates the profile (soft delete).
    pub fn deactivate(&mut self) {
        self.is_active = false;
        self.updated_at = Utc::now();
    }

    /// Reactivates a previously deactivated profile.
    pub fn reactivate(&mut self) {
        self.is_active = true;
        self.updated_at = Utc::now();
    }

    /// Updates the face embedding with a better quality sample.
    pub fn update_embedding(&mut self, embedding: FaceEmbedding) {
        self.embedding = embedding;
        self.updated_at = Utc::now();
    }

    /// Updates the thumbnail image.
    pub fn set_thumbnail(&mut self, path: String) {
        self.thumbnail_path = Some(path);
        self.updated_at = Utc::now();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_embedding() -> FaceEmbedding {
        FaceEmbedding::new(vec![0.1; 128])
    }

    #[test]
    fn new_profile_has_unknown_classification() {
        let profile = Profile::new(create_test_embedding(), None);
        assert_eq!(profile.classification(), ProfileClassification::Unknown);
    }

    #[test]
    fn new_profile_has_sighting_count_of_one() {
        let profile = Profile::new(create_test_embedding(), None);
        assert_eq!(profile.sighting_count(), 1);
    }

    #[test]
    fn record_sighting_increments_count() {
        let mut profile = Profile::new(create_test_embedding(), None);
        profile.record_sighting();
        assert_eq!(profile.sighting_count(), 2);
    }

    #[test]
    fn display_name_shows_id_prefix_when_unnamed() {
        let profile = Profile::new(create_test_embedding(), None);
        assert!(profile.display_name().starts_with("Unknown #"));
    }

    #[test]
    fn display_name_shows_name_when_set() {
        let mut profile = Profile::new(create_test_embedding(), None);
        profile.set_name(Some("John".to_string()));
        assert_eq!(profile.display_name(), "John");
    }

    #[test]
    fn add_tag_prevents_duplicates() {
        let mut profile = Profile::new(create_test_embedding(), None);
        let tag = ProfileTag::new("family".to_string());
        profile.add_tag(tag.clone());
        profile.add_tag(tag);
        assert_eq!(profile.tags().len(), 1);
    }

    #[test]
    fn deactivate_sets_inactive_flag() {
        let mut profile = Profile::new(create_test_embedding(), None);
        profile.deactivate();
        assert!(!profile.is_active());
    }
}
