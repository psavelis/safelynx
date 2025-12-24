//! Profile Tag Value Object
//!
//! A label for categorizing profiles.

use serde::{Deserialize, Serialize};

/// A tag for categorizing profiles.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct ProfileTag {
    value: String,
}

impl ProfileTag {
    /// Creates a new tag with normalized value (lowercase, trimmed).
    pub fn new(value: String) -> Self {
        Self {
            value: value.trim().to_lowercase(),
        }
    }

    /// Returns the tag value.
    pub fn value(&self) -> &str {
        &self.value
    }
}

impl From<String> for ProfileTag {
    fn from(value: String) -> Self {
        Self::new(value)
    }
}

impl From<&str> for ProfileTag {
    fn from(value: &str) -> Self {
        Self::new(value.to_string())
    }
}

impl std::fmt::Display for ProfileTag {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.value)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tag_is_normalized_to_lowercase() {
        let tag = ProfileTag::new("FAMILY".to_string());
        assert_eq!(tag.value(), "family");
    }

    #[test]
    fn tag_is_trimmed() {
        let tag = ProfileTag::new("  friend  ".to_string());
        assert_eq!(tag.value(), "friend");
    }

    #[test]
    fn equal_tags_are_equal() {
        let t1 = ProfileTag::new("Family".to_string());
        let t2 = ProfileTag::new("family".to_string());
        assert_eq!(t1, t2);
    }
}
