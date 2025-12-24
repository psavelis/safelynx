//! Bounding Box Value Object
//!
//! Represents a rectangular region in an image.

use serde::{Deserialize, Serialize};

/// A bounding box defining a rectangular region.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BoundingBox {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

impl BoundingBox {
    /// Creates a new bounding box.
    pub fn new(x: i32, y: i32, width: i32, height: i32) -> Self {
        Self { x, y, width, height }
    }

    /// Creates a bounding box from corner coordinates.
    pub fn from_corners(x1: i32, y1: i32, x2: i32, y2: i32) -> Self {
        Self {
            x: x1.min(x2),
            y: y1.min(y2),
            width: (x2 - x1).abs(),
            height: (y2 - y1).abs(),
        }
    }

    pub fn x(&self) -> i32 {
        self.x
    }

    pub fn y(&self) -> i32 {
        self.y
    }

    pub fn width(&self) -> i32 {
        self.width
    }

    pub fn height(&self) -> i32 {
        self.height
    }

    /// Returns the center point of the bounding box.
    pub fn center(&self) -> (i32, i32) {
        (self.x + self.width / 2, self.y + self.height / 2)
    }

    /// Returns the area of the bounding box.
    pub fn area(&self) -> i32 {
        self.width * self.height
    }

    /// Returns the right edge x coordinate.
    pub fn right(&self) -> i32 {
        self.x + self.width
    }

    /// Returns the bottom edge y coordinate.
    pub fn bottom(&self) -> i32 {
        self.y + self.height
    }

    /// Checks if this bounding box intersects with another.
    pub fn intersects(&self, other: &BoundingBox) -> bool {
        self.x < other.right()
            && self.right() > other.x
            && self.y < other.bottom()
            && self.bottom() > other.y
    }

    /// Calculates the intersection over union (IoU) with another bounding box.
    /// Used for tracking and matching detections.
    ///
    /// Reference: https://en.wikipedia.org/wiki/Jaccard_index
    pub fn iou(&self, other: &BoundingBox) -> f32 {
        let x1 = self.x.max(other.x);
        let y1 = self.y.max(other.y);
        let x2 = self.right().min(other.right());
        let y2 = self.bottom().min(other.bottom());

        if x2 <= x1 || y2 <= y1 {
            return 0.0;
        }

        let intersection = (x2 - x1) * (y2 - y1);
        let union = self.area() + other.area() - intersection;

        if union == 0 {
            return 0.0;
        }

        intersection as f32 / union as f32
    }

    /// Scales the bounding box by a factor.
    pub fn scale(&self, factor: f32) -> Self {
        let center = self.center();
        let new_width = (self.width as f32 * factor) as i32;
        let new_height = (self.height as f32 * factor) as i32;

        Self {
            x: center.0 - new_width / 2,
            y: center.1 - new_height / 2,
            width: new_width,
            height: new_height,
        }
    }

    /// Converts to a JSON-compatible array format [x, y, width, height].
    pub fn to_array(&self) -> [i32; 4] {
        [self.x, self.y, self.width, self.height]
    }

    /// Creates from a JSON array [x, y, width, height].
    pub fn from_array(arr: [i32; 4]) -> Self {
        Self::new(arr[0], arr[1], arr[2], arr[3])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn center_is_calculated_correctly() {
        let bbox = BoundingBox::new(10, 20, 100, 100);
        assert_eq!(bbox.center(), (60, 70));
    }

    #[test]
    fn area_is_calculated_correctly() {
        let bbox = BoundingBox::new(0, 0, 10, 20);
        assert_eq!(bbox.area(), 200);
    }

    #[test]
    fn intersecting_boxes_return_true() {
        let b1 = BoundingBox::new(0, 0, 100, 100);
        let b2 = BoundingBox::new(50, 50, 100, 100);
        assert!(b1.intersects(&b2));
    }

    #[test]
    fn non_intersecting_boxes_return_false() {
        let b1 = BoundingBox::new(0, 0, 100, 100);
        let b2 = BoundingBox::new(200, 200, 100, 100);
        assert!(!b1.intersects(&b2));
    }

    #[test]
    fn iou_of_identical_boxes_is_one() {
        let b1 = BoundingBox::new(0, 0, 100, 100);
        let b2 = BoundingBox::new(0, 0, 100, 100);
        assert!((b1.iou(&b2) - 1.0).abs() < f32::EPSILON);
    }

    #[test]
    fn iou_of_non_overlapping_is_zero() {
        let b1 = BoundingBox::new(0, 0, 100, 100);
        let b2 = BoundingBox::new(200, 200, 100, 100);
        assert!((b1.iou(&b2) - 0.0).abs() < f32::EPSILON);
    }

    #[test]
    fn array_roundtrip_preserves_values() {
        let original = BoundingBox::new(10, 20, 30, 40);
        let arr = original.to_array();
        let restored = BoundingBox::from_array(arr);
        assert_eq!(original, restored);
    }
}
