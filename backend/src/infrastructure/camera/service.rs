//! Camera Service
//!
//! Manages camera capture and frame processing pipeline.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{info, warn};
use uuid::Uuid;

use super::capture::{CameraCapture, CapturedFrame, CaptureConfig, CaptureState, list_cameras};
use super::FaceDetector;
use crate::application::use_cases::ProcessFrameUseCase;
use crate::domain::entities::Camera;

/// Camera service that manages capture and processing.
pub struct CameraService {
    captures: Arc<RwLock<HashMap<Uuid, Arc<CameraCapture>>>>,
    face_detector: Arc<FaceDetector>,
    process_frame: Arc<ProcessFrameUseCase>,
}

impl CameraService {
    /// Creates a new camera service.
    pub fn new(
        face_detector: Arc<FaceDetector>,
        process_frame: Arc<ProcessFrameUseCase>,
    ) -> Self {
        Self {
            captures: Arc::new(RwLock::new(HashMap::new())),
            face_detector,
            process_frame,
        }
    }

    /// Lists available cameras on the system.
    pub fn list_available_cameras(&self) -> Vec<super::capture::CameraInfo> {
        list_cameras()
    }

    /// Starts capture for a camera.
    pub async fn start_camera(&self, camera: &Camera) -> anyhow::Result<()> {
        let camera_id = camera.id();
        
        info!("Starting camera service for {} ({})", camera.name(), camera_id);
        
        // Create capture config based on camera settings
        let config = CaptureConfig {
            device_index: 0, // Default to first camera for built-in
            width: 1280,
            height: 720,
            fps: 15, // Lower FPS for face detection processing
        };
        
        let capture = Arc::new(CameraCapture::new(camera_id, config));
        
        // Store capture reference
        {
            let mut captures = self.captures.write().await;
            captures.insert(camera_id, capture.clone());
        }
        
        // Start the capture
        capture.start().await?;
        
        // Start frame processing in background
        let face_detector = self.face_detector.clone();
        let _process_frame = self.process_frame.clone();
        let mut frame_rx = capture.subscribe();
        
        tokio::spawn(async move {
            info!("Frame processing started for camera {}", camera_id);
            
            while let Ok(frame) = frame_rx.recv().await {
                // Process every 3rd frame to reduce CPU load
                if frame.frame_number % 3 != 0 {
                    continue;
                }
                
                if let Err(e) = Self::process_frame_internal(
                    &face_detector,
                    frame,
                ).await {
                    warn!("Frame processing error: {}", e);
                }
            }
            
            info!("Frame processing stopped for camera {}", camera_id);
        });
        
        Ok(())
    }

    /// Stops capture for a camera.
    pub async fn stop_camera(&self, camera_id: Uuid) {
        let mut captures = self.captures.write().await;
        if let Some(capture) = captures.remove(&camera_id) {
            capture.stop().await;
            info!("Stopped camera {}", camera_id);
        }
    }

    /// Gets the capture state for a camera.
    pub async fn get_camera_state(&self, camera_id: Uuid) -> Option<CaptureState> {
        let captures = self.captures.read().await;
        if let Some(capture) = captures.get(&camera_id) {
            Some(capture.state().await)
        } else {
            None
        }
    }

    /// Starts capture for the built-in camera automatically.
    pub async fn start_builtin_camera(&self) -> anyhow::Result<Uuid> {
        info!("Starting built-in camera capture automatically");
        
        // Generate a camera ID for the built-in camera
        let camera_id = Uuid::new_v4();
        
        let config = CaptureConfig {
            device_index: 0,
            width: 1280,
            height: 720,
            fps: 15,
        };
        
        let capture = Arc::new(CameraCapture::new(camera_id, config));
        
        {
            let mut captures = self.captures.write().await;
            captures.insert(camera_id, capture.clone());
        }
        
        capture.start().await?;
        
        // Start frame processing
        let face_detector = self.face_detector.clone();
        let mut frame_rx = capture.subscribe();
        
        tokio::spawn(async move {
            info!("Built-in camera frame processing started");
            
            while let Ok(frame) = frame_rx.recv().await {
                // Process every 5th frame to reduce CPU load
                if frame.frame_number % 5 != 0 {
                    continue;
                }
                
                if let Err(e) = Self::process_frame_internal(
                    &face_detector,
                    frame,
                ).await {
                    warn!("Frame processing error: {}", e);
                }
            }
        });
        
        Ok(camera_id)
    }

    async fn process_frame_internal(
        face_detector: &FaceDetector,
        frame: CapturedFrame,
    ) -> anyhow::Result<()> {
        // Skip empty frames
        if frame.data.is_empty() {
            return Ok(());
        }
        
        // Detect faces in the frame using the async detect method
        let detections = face_detector.detect(&frame).await;
        
        if !detections.is_empty() {
            info!(
                "Frame {}: Detected {} face(s) in camera {}",
                frame.frame_number,
                detections.len(),
                frame.camera_id
            );
            
            for (i, detection) in detections.iter().enumerate() {
                let bbox = detection.bounding_box();
                info!(
                    "  Face {}: bbox=({}, {}, {}, {}), confidence={:.2}",
                    i + 1,
                    bbox.x(),
                    bbox.y(),
                    bbox.width(),
                    bbox.height(),
                    detection.confidence()
                );
            }
        }
        
        Ok(())
    }

    /// Stops all cameras.
    pub async fn stop_all(&self) {
        let mut captures = self.captures.write().await;
        for (id, capture) in captures.drain() {
            capture.stop().await;
            info!("Stopped camera {}", id);
        }
    }
}
