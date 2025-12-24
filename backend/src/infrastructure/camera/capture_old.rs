//! Camera Capture
//!
//! Video capture from various camera sources using nokhwa.
//! Reference: https://docs.rs/nokhwa/latest/nokhwa/

use std::sync::Arc;
use tokio::sync::{broadcast, RwLock};
use tracing::{debug, error, info};
use uuid::Uuid;

/// Captured frame data.
#[derive(Debug, Clone)]
pub struct CapturedFrame {
    pub camera_id: Uuid,
    pub frame_number: u64,
    pub timestamp_ms: i64,
    pub width: u32,
    pub height: u32,
    pub data: Vec<u8>,
}

/// Camera capture configuration.
#[derive(Debug, Clone)]
pub struct CaptureConfig {
    pub device_index: u32,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
}

impl Default for CaptureConfig {
    fn default() -> Self {
        Self {
            device_index: 0,
            width: 1280,
            height: 720,
            fps: 30,
        }
    }
}

/// Camera capture state.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CaptureState {
    Stopped,
    Starting,
    Running,
    Error,
}

/// Camera capture manager.
pub struct CameraCapture {
    camera_id: Uuid,
    config: CaptureConfig,
    state: Arc<RwLock<CaptureState>>,
    frame_sender: broadcast::Sender<CapturedFrame>,
    frame_count: Arc<RwLock<u64>>,
}

impl CameraCapture {
    /// Creates a new camera capture.
    pub fn new(camera_id: Uuid, config: CaptureConfig) -> Self {
        let (frame_sender, _) = broadcast::channel(32);
        
        Self {
            camera_id,
            config,
            state: Arc::new(RwLock::new(CaptureState::Stopped)),
            frame_sender,
            frame_count: Arc::new(RwLock::new(0)),
        }
    }

    /// Subscribes to frame updates.
    pub fn subscribe(&self) -> broadcast::Receiver<CapturedFrame> {
        self.frame_sender.subscribe()
    }

    /// Returns the current capture state.
    pub async fn state(&self) -> CaptureState {
        *self.state.read().await
    }

    /// Starts the camera capture.
    pub async fn start(&self) -> anyhow::Result<()> {
        let mut state = self.state.write().await;
        if *state == CaptureState::Running {
            return Ok(());
        }
        *state = CaptureState::Starting;
        drop(state);

        info!("Starting camera capture for {}", self.camera_id);

        // Start capture in background task
        let camera_id = self.camera_id;
        let config = self.config.clone();
        let state = self.state.clone();
        let frame_sender = self.frame_sender.clone();
        let frame_count = self.frame_count.clone();

        tokio::spawn(async move {
            match Self::capture_loop(camera_id, config, state.clone(), frame_sender, frame_count).await {
                Ok(_) => info!("Camera capture stopped for {}", camera_id),
                Err(e) => {
                    error!("Camera capture error for {}: {}", camera_id, e);
                    *state.write().await = CaptureState::Error;
                }
            }
        });

        Ok(())
    }

    /// Stops the camera capture.
    pub async fn stop(&self) {
        info!("Stopping camera capture for {}", self.camera_id);
        *self.state.write().await = CaptureState::Stopped;
    }

    async fn capture_loop(
        camera_id: Uuid,
        config: CaptureConfig,
        state: Arc<RwLock<CaptureState>>,
        frame_sender: broadcast::Sender<CapturedFrame>,
        frame_count: Arc<RwLock<u64>>,
    ) -> anyhow::Result<()> {
        // Note: Actual camera implementation using nokhwa
        // This is a placeholder that simulates frame capture
        
        *state.write().await = CaptureState::Running;
        
        let frame_interval = std::time::Duration::from_millis(1000 / config.fps as u64);
        let mut interval = tokio::time::interval(frame_interval);
        
        loop {
            interval.tick().await;
            
            if *state.read().await != CaptureState::Running {
                break;
            }
            
            let mut count = frame_count.write().await;
            *count += 1;
            let frame_num = *count;
            drop(count);
            
            let frame = CapturedFrame {
                camera_id,
                frame_number: frame_num,
                timestamp_ms: chrono::Utc::now().timestamp_millis(),
                width: config.width,
                height: config.height,
                data: Vec::new(), // Placeholder
            };
            
            if frame_sender.send(frame).is_err() {
                debug!("No frame subscribers for camera {}", camera_id);
            }
        }
        
        *state.write().await = CaptureState::Stopped;
        
        Ok(())
    }

    /// Returns the current frame count.
    pub async fn frame_count(&self) -> u64 {
        *self.frame_count.read().await
    }
}

/// Lists available camera devices.
pub fn list_cameras() -> Vec<CameraInfo> {
    // Note: Would use nokhwa to enumerate cameras
    vec![CameraInfo {
        index: 0,
        name: "Built-in FaceTime HD Camera".to_string(),
        description: "Built-in MacBook camera".to_string(),
    }]
}

/// Information about an available camera.
#[derive(Debug, Clone)]
pub struct CameraInfo {
    pub index: u32,
    pub name: String,
    pub description: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_is_720p_30fps() {
        let config = CaptureConfig::default();
        assert_eq!(config.width, 1280);
        assert_eq!(config.height, 720);
        assert_eq!(config.fps, 30);
    }

    #[tokio::test]
    async fn new_capture_is_stopped() {
        let capture = CameraCapture::new(Uuid::new_v4(), CaptureConfig::default());
        assert_eq!(capture.state().await, CaptureState::Stopped);
    }
}
