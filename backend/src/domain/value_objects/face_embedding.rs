//! Face Embedding Value Object
//!
//! Represents a 128-dimensional face embedding vector.
//! Reference: https://arxiv.org/abs/1503.03832 (FaceNet)

use serde::{Deserialize, Serialize};

/// Dimension of face embedding vector (FaceNet standard).
pub const EMBEDDING_DIMENSION: usize = 128;

/// A face embedding vector for facial recognition.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceEmbedding {
    values: Vec<f32>,
}

impl FaceEmbedding {
    /// Creates a new face embedding from a vector.
    ///
    /// # Panics
    /// Panics if the vector length does not match EMBEDDING_DIMENSION.
    pub fn new(values: Vec<f32>) -> Self {
        assert_eq!(
            values.len(),
            EMBEDDING_DIMENSION,
            "Embedding must have {} dimensions, got {}",
            EMBEDDING_DIMENSION,
            values.len()
        );
        Self { values }
    }

    /// Creates an embedding from a byte slice (for database storage).
    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() != EMBEDDING_DIMENSION * 4 {
            return None;
        }

        let values: Vec<f32> = bytes
            .chunks_exact(4)
            .map(|chunk| f32::from_le_bytes(chunk.try_into().unwrap()))
            .collect();

        Some(Self { values })
    }

    /// Converts the embedding to bytes for storage.
    pub fn to_bytes(&self) -> Vec<u8> {
        self.values
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect()
    }

    /// Returns the embedding values.
    pub fn values(&self) -> &[f32] {
        &self.values
    }

    /// Calculates the Euclidean distance to another embedding.
    /// Lower values indicate more similar faces.
    ///
    /// Reference: https://en.wikipedia.org/wiki/Euclidean_distance
    pub fn distance(&self, other: &FaceEmbedding) -> f32 {
        self.values
            .iter()
            .zip(other.values.iter())
            .map(|(a, b)| (a - b).powi(2))
            .sum::<f32>()
            .sqrt()
    }

    /// Calculates the cosine similarity to another embedding.
    /// Higher values indicate more similar faces (range: -1 to 1).
    ///
    /// Reference: https://en.wikipedia.org/wiki/Cosine_similarity
    pub fn cosine_similarity(&self, other: &FaceEmbedding) -> f32 {
        let dot_product: f32 = self
            .values
            .iter()
            .zip(other.values.iter())
            .map(|(a, b)| a * b)
            .sum();

        let magnitude_self = self.values.iter().map(|x| x.powi(2)).sum::<f32>().sqrt();
        let magnitude_other = other.values.iter().map(|x| x.powi(2)).sum::<f32>().sqrt();

        if magnitude_self == 0.0 || magnitude_other == 0.0 {
            return 0.0;
        }

        dot_product / (magnitude_self * magnitude_other)
    }

    /// Normalizes the embedding to unit length (L2 normalization).
    pub fn normalize(&mut self) {
        let magnitude: f32 = self.values.iter().map(|x| x.powi(2)).sum::<f32>().sqrt();
        if magnitude > 0.0 {
            for v in &mut self.values {
                *v /= magnitude;
            }
        }
    }

    /// Returns a normalized copy of this embedding.
    pub fn normalized(&self) -> Self {
        let mut copy = self.clone();
        copy.normalize();
        copy
    }
}

impl PartialEq for FaceEmbedding {
    fn eq(&self, other: &Self) -> bool {
        self.values
            .iter()
            .zip(other.values.iter())
            .all(|(a, b)| (a - b).abs() < f32::EPSILON)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_embedding(value: f32) -> FaceEmbedding {
        FaceEmbedding::new(vec![value; EMBEDDING_DIMENSION])
    }

    #[test]
    fn distance_of_identical_embeddings_is_zero() {
        let e1 = create_test_embedding(0.5);
        let e2 = create_test_embedding(0.5);
        assert!((e1.distance(&e2) - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn distance_increases_with_difference() {
        let e1 = create_test_embedding(0.0);
        let e2 = create_test_embedding(1.0);
        let distance = e1.distance(&e2);
        assert!(distance > 0.0);
    }

    #[test]
    fn cosine_similarity_of_identical_is_one() {
        let e1 = create_test_embedding(0.5);
        let e2 = create_test_embedding(0.5);
        let similarity = e1.cosine_similarity(&e2);
        assert!((similarity - 1.0).abs() < 0.0001);
    }

    #[test]
    fn bytes_roundtrip_preserves_values() {
        let original = create_test_embedding(0.123);
        let bytes = original.to_bytes();
        let restored = FaceEmbedding::from_bytes(&bytes).unwrap();
        assert_eq!(original.values(), restored.values());
    }

    #[test]
    fn normalized_embedding_has_unit_length() {
        let e = create_test_embedding(5.0);
        let normalized = e.normalized();
        let magnitude: f32 = normalized.values().iter().map(|x| x.powi(2)).sum::<f32>().sqrt();
        assert!((magnitude - 1.0).abs() < 0.0001);
    }

    #[test]
    #[should_panic(expected = "Embedding must have 128 dimensions")]
    fn rejects_wrong_dimension() {
        FaceEmbedding::new(vec![0.0; 64]);
    }
}
