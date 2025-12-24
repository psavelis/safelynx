//! Safelynx Backend - Face Recognition Security Platform
//!
//! A high-performance face detection and recognition system built with Rust.
//! Designed for macOS M1/M4 with Metal acceleration support.
//!
//! # Architecture
//!
//! This application follows Clean Architecture principles:
//! - **Domain**: Core business entities and rules
//! - **Application**: Use cases and application logic
//! - **Infrastructure**: External interfaces (DB, Camera, Web)
//!
//! # References
//!
//! - Clean Architecture: https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html
//! - SOLID Principles: https://en.wikipedia.org/wiki/SOLID
//! - Object Calisthenics: https://williamdurand.fr/2013/06/03/object-calisthenics/

mod application;
mod domain;
mod infrastructure;

use anyhow::Result;
use infrastructure::{config::AppConfig, server::Server};
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    init_tracing();

    info!("Starting Safelynx Backend v{}", env!("CARGO_PKG_VERSION"));

    let config = AppConfig::load()?;
    let server = Server::new(config).await?;

    server.run().await
}

fn init_tracing() {
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "safelynx_backend=info,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();
}
