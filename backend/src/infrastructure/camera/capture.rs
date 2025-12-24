//! Camera Capture
//!
//! Video capture from various camera sources using nokhwa (AVFoundation on macOS).
//! Reference: https://docs.rs/nokhwa/latest/nokhwa/

use std::sync::Arc;
use nokhwa::pixel_format::RgbFormat;
use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType};
use nokhwa::Camera;
use tokio::sync::{broadcast, RwLock};
use tracing::{debug, error, info, warn};
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

/// Camera capture manager using nokhwa for real hardware access.
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

        info!("Starting camera capture for {} with device index {}", 
              self.camera_id, self.config.device_index);

        // Start capture in background task (blocking camera access needs spawn_blocking)
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
        info!("Initializing camera {} with nokhwa (AVFoundation)", camera_id);
        
        // Camera initialization must happen in a blocking context
        let device_index = config.device_index;
        let init_result = tokio::task::spawn_blocking(move || {
            let index = CameraIndex::Index(device_index);
            let requested = RequestedFormat::new::<RgbFormat>(
                RequestedFormatType::AbsoluteHighestResolution,
            );
            
            info!("Opening camera at index {}...", device_index);
            let mut cam = Camera::new(index, requested)?;
            
            // Get actual resolution
            let resolution = cam.resolution();
            info!("Camera resolution: {}x{}", resolution.width(), resolution.height());
            
            // Open the camera stream - this triggers macOS permission dialog
            info!("Opening camera stream - macOS should prompt for camera access now...");
            cam.open_stream()?;
            
            info!("Camera stream opened successfully!");
            Ok::<_, nokhwa::NokhwaError>((cam, resolution.width(), resolution.height()))
        }).await?;

        let (camera, actual_width, actual_height) = match init_result {
            Ok(result) => result,
            Err(e) => {
                error!("Failed to initialize camera: {}", e);
                *state.write().await = CaptureState::Error;
                return Err(anyhow::anyhow!("Camera initialization failed: {}", e));
            }
        };

        *state.write().await = CaptureState::Running;
        info!("Camera capture running - resolution: {}x{}", actual_width, actual_height);

        // Wrap camera in Arc<Mutex> for safe access across blocking tasks
        let camera = Arc::new(std::sync::Mutex::new(camera));
        
        let frame_interval = std::time::Duration::from_millis(1000 / config.fps as u64);
        let mut interval = tokio::time::interval(frame_interval);

        loop {
            interval.tick().await;

            if *state.read().await != CaptureState::Running {
                info!("Capture state changed, stopping loop");
                break;
            }

            // Capture frame in blocking context
            let camera_clone = camera.clone();
            let frame_result = tokio::task::spawn_blocking(move || {
                let mut cam = camera_clone.lock().unwrap();
                cam.frame()
            }).await;

            match frame_result {
                Ok(Ok(buffer)) => {
                    let mut count = frame_count.write().await;
                    *count += 1;
                    let frame_num = *count;
                    drop(count);

                    let frame = CapturedFrame {
                        camera_id,
                        frame_number: frame_num,
                        timestamp_ms: chrono::Utc::now().timestamp_millis(),
                        width: actual_width,
                        height: actual_height,
                        data: buffer.buffer().to_vec(),
                    };

                    if frame_num % 30 == 0 {
                        debug!("Captured frame {} ({}x{}, {} bytes)", 
                               frame_num, actual_width, actual_height, frame.data.len());
                    }

                    if frame_sender.send(frame).is_err() {
                        // No subscribers - that's OK, just means no one is processing frames yet
                    }
                }
                Ok(Err(e)) => {
                    warn!("Frame capture error: {}", e);
                }
                Err(e) => {
                    error!("Frame capture task error: {}", e);
                }
            }
        }

        // Close camera
        info!("Closing camera...");
        drop(camera);
        *state.write().await = CaptureState::Stopped;

        Ok(())
    }

    /// Returns the current frame count.
    pub async fn frame_count(&self) -> u64 {
        *self.frame_count.read().await
    }
}

/// Lists available camera devices using nokhwa.
pub fn list_cameras() -> Vec<CameraInfo> {
    match nokhwa::query(nokhwa::utils::ApiBackend::AVFoundation) {
        Ok(cameras) => {
            info!("Found {} cameras via AVFoundation", cameras.len());
            cameras
                .into_iter()
                .enumerate()
                .map(|(idx, info)| {
                    info!("Camera {}: {} - {}", idx, info.human_name(), info.description());
                    CameraInfo {
                        index: idx as u32,
                        name: info.human_name().to_string(),
                        description: info.description().to_string(),
                    }
                })
                .collect()
        }
        Err(e) => {
            warn!("Failed to enumerate cameras: {}. Returning default.", e);
            vec![CameraInfo {
                index: 0,
                name: "Built-in FaceTime HD Camera".to_string(),
                description: "Default MacBook camera".to_string(),
            }]
        }
    }
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
