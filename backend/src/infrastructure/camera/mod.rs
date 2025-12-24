//! Camera Infrastructure
//!
//! Camera capture, face detection, and camera service implementation.

mod capture;
mod face_detector;
mod service;

pub use capture::*;
pub use face_detector::*;
pub use service::*;
