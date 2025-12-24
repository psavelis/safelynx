//! Database Connection
//!
//! PostgreSQL connection pool management.

use anyhow::Result;
use sqlx::postgres::{PgPool, PgPoolOptions};
use tracing::info;

/// Creates a database connection pool.
pub async fn create_pool(database_url: &str) -> Result<PgPool> {
    info!("Connecting to database...");

    let pool = PgPoolOptions::new()
        .max_connections(10)
        .min_connections(2)
        .acquire_timeout(std::time::Duration::from_secs(10))
        .idle_timeout(std::time::Duration::from_secs(600))
        .connect(database_url)
        .await?;

    info!("Database connection established");

    Ok(pool)
}

/// Runs pending migrations.
pub async fn run_migrations(pool: &PgPool) -> Result<()> {
    info!("Running database migrations...");

    sqlx::migrate!("./migrations").run(pool).await?;

    info!("Migrations completed");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore] // Requires running database
    async fn can_connect_to_database() {
        let url = "postgres://safelynx:safelynx@localhost:7888/safelynx";
        let pool = create_pool(url).await;
        assert!(pool.is_ok());
    }
}
