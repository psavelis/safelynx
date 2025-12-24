//! HTTP Server
//!
//! Axum-based web server with REST API and WebSocket support.

mod api;
mod app_state;
mod websocket;

pub use app_state::AppState;

use anyhow::Result;
use axum::{routing::get, Router};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::info;

use crate::infrastructure::config::AppConfig;

/// HTTP server for the Safelynx API.
pub struct Server {
    config: AppConfig,
    state: Arc<AppState>,
}

impl Server {
    /// Creates a new server instance.
    pub async fn new(config: AppConfig) -> Result<Self> {
        let state = AppState::new(&config).await?;

        Ok(Self {
            config,
            state: Arc::new(state),
        })
    }

    /// Runs the server.
    pub async fn run(self) -> Result<()> {
        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);

        let app = Router::new()
            // Health check
            .route("/health", get(api::health::health_check))
            // API routes
            .nest("/api/v1", api::routes(self.state.clone()))
            // WebSocket
            .route("/ws", get(websocket::ws_handler))
            // Static files for recordings/snapshots
            .nest_service(
                "/files",
                tower_http::services::ServeDir::new(&self.config.data_dir),
            )
            .layer(cors)
            .layer(TraceLayer::new_for_http())
            .with_state(self.state);

        let addr = format!("{}:{}", self.config.host, self.config.port);
        let listener = tokio::net::TcpListener::bind(&addr).await?;

        info!("Safelynx API server listening on http://{}", addr);
        info!("API documentation: http://{}/api/v1/docs", addr);

        axum::serve(listener, app).await?;

        Ok(())
    }
}
