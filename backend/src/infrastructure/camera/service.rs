//! Camera Service
//!
//! Manages camera capture and frame processing pipeline.

use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::{debug, info, warn};
use uuid::Uuid;

use super::capture::{list_cameras, CameraCapture, CaptureConfig, CaptureState, CapturedFrame};
use super::FaceDetector;
use crate::application::use_cases::ProcessFrameUseCase;
use crate::domain::entities::{Camera, Detection, FrameDetections};
use crate::domain::repositories::CameraRepository;

/// Camera service that manages capture and processing.
pub struct CameraService {
    captures: Arc<RwLock<HashMap<Uuid, Arc<CameraCapture>>>>,
    face_detector: Arc<FaceDetector>,
    process_frame: Arc<ProcessFrameUseCase>,
    camera_repo: Arc<dyn CameraRepository>,
}

impl CameraService {
    /// Creates a new camera service.
    pub fn new(
        face_detector: Arc<FaceDetector>,
        process_frame: Arc<ProcessFrameUseCase>,
        camera_repo: Arc<dyn CameraRepository>,
    ) -> Self {
        Self {
            captures: Arc::new(RwLock::new(HashMap::new())),
            face_detector,
            process_frame,
            camera_repo,
        }
    }

    /// Lists available cameras on the system.
    pub fn list_available_cameras(&self) -> Vec<super::capture::CameraInfo> {
        list_cameras()
    }

    /// Starts capture for a camera.
    pub async fn start_camera(&self, camera: &Camera) -> anyhow::Result<()> {
        let camera_id = camera.id();

        info!(
            "Starting camera service for {} ({})",
            camera.name(),
            camera_id
        );

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
        let process_frame = self.process_frame.clone();
        let mut frame_rx = capture.subscribe();

        tokio::spawn(async move {
            info!("Frame processing started for camera {}", camera_id);

            while let Ok(frame) = frame_rx.recv().await {
                // Process every 3rd frame to reduce CPU load
                if frame.frame_number % 3 != 0 {
                    continue;
                }

                if let Err(e) =
                    Self::process_frame_internal(&face_detector, &process_frame, frame).await
                {
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

    /// Subscribe to frame updates for a specific camera.
    /// Returns a broadcast receiver for frames if the camera is active.
    pub async fn subscribe_frames(
        &self,
        camera_id: Uuid,
    ) -> Option<tokio::sync::broadcast::Receiver<CapturedFrame>> {
        let captures = self.captures.read().await;
        captures.get(&camera_id).map(|capture| capture.subscribe())
    }

    /// Starts capture for the built-in camera automatically.
    /// Reuses existing camera if one with device_id "0" already exists.
    pub async fn start_builtin_camera(&self) -> anyhow::Result<Uuid> {
        info!("Starting built-in camera capture automatically");

        // Check if built-in camera already exists in database (device_id = "0")
        let camera_id = if let Ok(Some(mut existing)) = self.camera_repo.find_by_device_id("0").await {
            info!("Found existing built-in camera in database: {}", existing.id());
            // Update status to Active
            existing.set_status(crate::domain::entities::CameraStatus::Active);
            if let Err(e) = self.camera_repo.update(&existing).await {
                warn!("Failed to update camera status: {}", e);
            }
            existing.id()
        } else {
            // Create and save the built-in camera to the database
            let mut camera = Camera::builtin();
            camera.set_status(crate::domain::entities::CameraStatus::Active);
            let id = camera.id();
            self.camera_repo.save(&camera).await?;
            info!("Registered new built-in camera in database with ID: {}", id);
            id
        };

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
        let process_frame_uc = self.process_frame.clone();
        let mut frame_rx = capture.subscribe();

        tokio::spawn(async move {
            info!("Built-in camera frame processing started");

            while let Ok(frame) = frame_rx.recv().await {
                // Process every 5th frame to reduce CPU load
                if frame.frame_number % 5 != 0 {
                    continue;
                }

                if let Err(e) =
                    Self::process_frame_internal(&face_detector, &process_frame_uc, frame).await
                {
                    warn!("Frame processing error: {}", e);
                }
            }
        });

        Ok(camera_id)
    }

    async fn process_frame_internal(
        face_detector: &FaceDetector,
        process_frame_uc: &ProcessFrameUseCase,
        frame: CapturedFrame,
    ) -> anyhow::Result<()> {
        // Skip empty frames
        if frame.data.is_empty() {
            return Ok(());
        }

        // Detect faces in the frame using the async detect method
        let detections = face_detector.detect(&frame).await;

        if detections.is_empty() {
            return Ok(());
        }

        info!(
            "Frame {}: Detected {} face(s) in camera {}",
            frame.frame_number,
            detections.len(),
            frame.camera_id
        );

        // Convert detections to domain Detection objects
        let domain_detections: Vec<Detection> = detections
            .iter()
            .map(|d| Detection::new(d.bounding_box().clone(), d.confidence()))
            .collect();

        // Create FrameDetections for the use case
        let mut frame_detections = FrameDetections::new(
            frame.camera_id,
            frame.frame_number,
            frame.timestamp_ms,
        );

        for detection in domain_detections {
            frame_detections.add_detection(detection);
        }

        // Store the frame data for thumbnail creation
        frame_detections.set_frame_data(frame.data.clone());

        // Process the frame through the use case (creates profiles, sightings, etc.)
        match process_frame_uc.execute(&mut frame_detections).await {
            Ok(result) => {
                if !result.created_profiles.is_empty() {
                    info!(
                        "Created {} new profile(s): {:?}",
                        result.created_profiles.len(),
                        result.created_profiles
                    );
                }
                debug!(
                    "Frame processed: {} faces, {} new profiles",
                    result.face_count,
                    result.created_profiles.len()
                );
            }
            Err(e) => {
                warn!("Failed to process frame detections: {}", e);
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
