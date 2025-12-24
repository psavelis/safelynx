//! Database Migration Runner
//!
//! Executes SQL migrations to initialize or update the database schema.

use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use std::env;
use tracing::info;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new("info"))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://safelynx:safelynx@localhost:7888/safelynx".to_string());

    info!("Connecting to database...");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    info!("Running migrations...");

    sqlx::migrate!("./migrations").run(&pool).await?;

    info!("Migrations completed successfully!");

    Ok(())
}
