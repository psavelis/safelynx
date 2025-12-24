//! Value Objects
//!
//! Immutable domain objects defined by their attributes rather than identity.

mod bounding_box;
mod face_embedding;
mod geo_location;
mod profile_tag;

pub use bounding_box::*;
pub use face_embedding::*;
pub use geo_location::*;
pub use profile_tag::*;
