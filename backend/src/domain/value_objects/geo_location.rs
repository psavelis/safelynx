//! GeoLocation Value Object
//!
//! Represents a geographic coordinate with optional metadata.

use serde::{Deserialize, Serialize};

/// A geographic location with latitude and longitude.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GeoLocation {
    latitude: f64,
    longitude: f64,
    altitude: Option<f64>,
    accuracy: Option<f64>,
    name: Option<String>,
}

impl GeoLocation {
    /// Creates a new geographic location.
    ///
    /// # Arguments
    /// * `latitude` - Latitude in decimal degrees (-90 to 90)
    /// * `longitude` - Longitude in decimal degrees (-180 to 180)
    pub fn new(latitude: f64, longitude: f64) -> Self {
        Self {
            latitude: latitude.clamp(-90.0, 90.0),
            longitude: longitude.clamp(-180.0, 180.0),
            altitude: None,
            accuracy: None,
            name: None,
        }
    }

    /// Creates a location with full metadata.
    pub fn with_metadata(
        latitude: f64,
        longitude: f64,
        altitude: Option<f64>,
        accuracy: Option<f64>,
        name: Option<String>,
    ) -> Self {
        Self {
            latitude: latitude.clamp(-90.0, 90.0),
            longitude: longitude.clamp(-180.0, 180.0),
            altitude,
            accuracy,
            name,
        }
    }

    pub fn latitude(&self) -> f64 {
        self.latitude
    }

    pub fn longitude(&self) -> f64 {
        self.longitude
    }

    pub fn altitude(&self) -> Option<f64> {
        self.altitude
    }

    pub fn accuracy(&self) -> Option<f64> {
        self.accuracy
    }

    pub fn name(&self) -> Option<&str> {
        self.name.as_deref()
    }

    /// Calculates the distance to another location in meters using the Haversine formula.
    ///
    /// Reference: https://en.wikipedia.org/wiki/Haversine_formula
    pub fn distance_to(&self, other: &GeoLocation) -> f64 {
        const EARTH_RADIUS_METERS: f64 = 6_371_000.0;

        let lat1 = self.latitude.to_radians();
        let lat2 = other.latitude.to_radians();
        let delta_lat = (other.latitude - self.latitude).to_radians();
        let delta_lon = (other.longitude - self.longitude).to_radians();

        let a = (delta_lat / 2.0).sin().powi(2)
            + lat1.cos() * lat2.cos() * (delta_lon / 2.0).sin().powi(2);
        let c = 2.0 * a.sqrt().asin();

        EARTH_RADIUS_METERS * c
    }

    /// Returns the location as a [latitude, longitude] array.
    pub fn to_array(&self) -> [f64; 2] {
        [self.latitude, self.longitude]
    }

    /// Creates from a [latitude, longitude] array.
    pub fn from_array(arr: [f64; 2]) -> Self {
        Self::new(arr[0], arr[1])
    }

    /// Returns a display-friendly string representation.
    pub fn display(&self) -> String {
        if let Some(name) = &self.name {
            name.clone()
        } else {
            format!("{:.6}, {:.6}", self.latitude, self.longitude)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn coordinates_are_clamped() {
        let loc = GeoLocation::new(100.0, 200.0);
        assert_eq!(loc.latitude(), 90.0);
        assert_eq!(loc.longitude(), 180.0);
    }

    #[test]
    fn distance_to_same_location_is_zero() {
        let loc = GeoLocation::new(40.7128, -74.0060);
        assert!((loc.distance_to(&loc) - 0.0).abs() < 0.01);
    }

    #[test]
    fn distance_calculation_is_accurate() {
        // New York to London is approximately 5,570 km
        let nyc = GeoLocation::new(40.7128, -74.0060);
        let london = GeoLocation::new(51.5074, -0.1278);
        let distance = nyc.distance_to(&london);
        let expected = 5_570_000.0;
        let tolerance = 100_000.0; // 100km tolerance
        assert!((distance - expected).abs() < tolerance);
    }

    #[test]
    fn display_shows_name_when_present() {
        let loc =
            GeoLocation::with_metadata(40.7128, -74.0060, None, None, Some("New York".to_string()));
        assert_eq!(loc.display(), "New York");
    }

    #[test]
    fn display_shows_coordinates_when_no_name() {
        let loc = GeoLocation::new(40.7128, -74.0060);
        assert!(loc.display().contains("40.712800"));
    }
}
