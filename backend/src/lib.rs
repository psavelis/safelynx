//! Safelynx Backend Library
//!
//! This module re-exports the main components for use in tests and binaries.

pub mod application;
pub mod domain;
pub mod infrastructure;

pub use application::services;
pub use application::use_cases;
pub use domain::entities;
pub use domain::events;
pub use domain::repositories;
pub use domain::value_objects;
pub use infrastructure::config::AppConfig;
pub use infrastructure::database;
pub use infrastructure::server::Server;
