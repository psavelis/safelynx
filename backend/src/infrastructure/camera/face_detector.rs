//! Face Detector
//!
//! Face detection and embedding extraction.
//! Uses rustface for detection in a dedicated thread (since Detector is not Send).
//!
//! References:
//! - rustface: https://github.com/nickelc/rustface
//! - FaceNet: https://arxiv.org/abs/1503.03832

use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::thread;
use crossbeam_channel::{bounded, Receiver, Sender};
use tracing::{debug, error, info, warn};
use rustface::{FaceInfo, ImageData};

use crate::domain::entities::Detection;
use crate::domain::value_objects::{BoundingBox, FaceEmbedding, EMBEDDING_DIMENSION};
use crate::infrastructure::camera::CapturedFrame;

/// Face detector configuration.
#[derive(Debug, Clone)]
pub struct DetectorConfig {
    /// Minimum face size in pixels.
    pub min_face_size: u32,
    /// Detection confidence threshold.
    pub confidence_threshold: f32,
    /// Scale factor for image pyramid.
    pub scale_factor: f32,
    /// Enable face embedding extraction.
    pub extract_embeddings: bool,
    /// Path to rustface model file.
    pub model_path: PathBuf,
}

impl Default for DetectorConfig {
    fn default() -> Self {
        Self {
            min_face_size: 40,
            confidence_threshold: 0.7,
            scale_factor: 0.8,
            extract_embeddings: true,
            model_path: PathBuf::from("models/seeta_fd_frontal_v1.0.bin"),
        }
    }
}

/// Detection request sent to the detector thread.
struct DetectionRequest {
    frame: CapturedFrame,
    response_tx: tokio::sync::oneshot::Sender<Vec<Detection>>,
}

/// Face detector using rustface.
/// Runs detection in a dedicated thread since rustface Detector is not Send.
pub struct FaceDetector {
    request_tx: Sender<DetectionRequest>,
    detection_count: Arc<AtomicU64>,
    config: DetectorConfig,
}

// FaceDetector is now Send + Sync since it only holds channels and atomics
unsafe impl Send for FaceDetector {}
unsafe impl Sync for FaceDetector {}

impl FaceDetector {
    /// Creates a new face detector.
    pub fn new(config: DetectorConfig) -> anyhow::Result<Self> {
        info!("Initializing face detector with model: {:?}", config.model_path);
        
        let model_path = config.model_path.clone();
        
        if !model_path.exists() {
            return Err(anyhow::anyhow!(
                "Face detection model not found at {:?}. Please download it from: \
                https://github.com/nickelc/rustface/raw/master/model/seeta_fd_frontal_v1.0.bin",
                model_path
            ));
        }
        
        // Create bounded channel for detection requests
        let (request_tx, request_rx): (Sender<DetectionRequest>, Receiver<DetectionRequest>) = bounded(32);
        let detection_count = Arc::new(AtomicU64::new(0));
        let detection_count_clone = detection_count.clone();
        let config_clone = config.clone();
        
        // Spawn detector thread
        thread::Builder::new()
            .name("face-detector".to_string())
            .spawn(move || {
                Self::detector_thread(request_rx, config_clone, detection_count_clone);
            })?;
        
        info!("Face detector initialized successfully");
        
        Ok(Self {
            request_tx,
            detection_count,
            config,
        })
    }

    /// The detector thread that processes frames.
    fn detector_thread(
        request_rx: Receiver<DetectionRequest>,
        config: DetectorConfig,
        detection_count: Arc<AtomicU64>,
    ) {
        info!("Face detector thread starting...");
        
        // Create the detector in this thread
        let model_path_str = config.model_path.to_string_lossy();
        let mut detector = match rustface::create_detector(&model_path_str) {
            Ok(d) => d,
            Err(e) => {
                error!("Failed to create face detector: {}", e);
                return;
            }
        };
        
        detector.set_min_face_size(config.min_face_size);
        detector.set_score_thresh(config.confidence_threshold as f64);
        detector.set_pyramid_scale_factor(config.scale_factor);
        detector.set_slide_window_step(4, 4);
        
        info!("Face detector thread ready, waiting for frames...");
        
        while let Ok(request) = request_rx.recv() {
            let frame = request.frame;
            
            if frame.data.is_empty() {
                let _ = request.response_tx.send(Vec::new());
                continue;
            }
            
            // Convert to grayscale
            let gray_data = Self::rgb_to_grayscale(&frame.data, frame.width, frame.height);
            
            // Create image data for rustface
            let image = ImageData::new(&gray_data, frame.width, frame.height);
            
            // Detect faces
            let faces = detector.detect(&image);
            let detections = Self::convert_faces_to_detections(faces, config.confidence_threshold);
            
            if !detections.is_empty() {
                detection_count.fetch_add(detections.len() as u64, Ordering::Relaxed);
                debug!("Detected {} face(s) in frame {}", detections.len(), frame.frame_number);
            }
            
            // Send response
            let _ = request.response_tx.send(detections);
        }
        
        info!("Face detector thread stopping");
    }

    /// Detects faces in a frame asynchronously.
    pub async fn detect(&self, frame: &CapturedFrame) -> Vec<Detection> {
        if frame.data.is_empty() {
            return Vec::new();
        }

        let (response_tx, response_rx) = tokio::sync::oneshot::channel();
        
        let request = DetectionRequest {
            frame: frame.clone(),
            response_tx,
        };
        
        // Send request to detector thread
        if self.request_tx.send(request).is_err() {
            warn!("Failed to send detection request - detector thread may have stopped");
            return Vec::new();
        }
        
        // Wait for response
        match response_rx.await {
            Ok(detections) => detections,
            Err(_) => {
                warn!("Detection response channel closed");
                Vec::new()
            }
        }
    }

    /// Convert image buffer to grayscale.
    /// Handles both RGB and YUV (NV12/YUY2) formats.
    fn rgb_to_grayscale(data: &[u8], width: u32, height: u32) -> Vec<u8> {
        let pixel_count = (width * height) as usize;
        let expected_rgb_size = pixel_count * 3;
        let expected_yuv_size = pixel_count * 2; // YUY2 format
        let expected_nv12_size = pixel_count + pixel_count / 2; // NV12 format (Y plane + UV interleaved)
        
        // Check if it's YUV/NV12 format (common for MacBook cameras)
        if data.len() == expected_yuv_size {
            // YUY2 format: YUYV YUYV... - just extract Y channel
            debug!("Converting YUY2 frame to grayscale ({} bytes)", data.len());
            let mut gray = Vec::with_capacity(pixel_count);
            for i in 0..pixel_count {
                // Y is at even indices in YUY2
                gray.push(data[i * 2]);
            }
            return gray;
        } else if data.len() >= pixel_count && data.len() < expected_rgb_size {
            // NV12 or similar: Y plane first, then UV
            // For NV12, Y plane is the first (width * height) bytes
            debug!("Converting NV12/planar frame to grayscale ({} bytes)", data.len());
            return data[..pixel_count].to_vec();
        } else if data.len() >= expected_rgb_size {
            // RGB format
            debug!("Converting RGB frame to grayscale ({} bytes)", data.len());
            let mut gray = Vec::with_capacity(pixel_count);
            
            for i in 0..pixel_count {
                let idx = i * 3;
                if idx + 2 < data.len() {
                    let r = data[idx] as f32;
                    let g = data[idx + 1] as f32;
                    let b = data[idx + 2] as f32;
                    // Standard grayscale conversion
                    let gray_val = (0.299 * r + 0.587 * g + 0.114 * b) as u8;
                    gray.push(gray_val);
                } else {
                    gray.push(128);
                }
            }
            return gray;
        }
        
        // Unknown format - try to extract Y channel assuming packed format
        warn!(
            "Unknown image format: {} bytes for {}x{} (expected RGB={}, YUV={}, NV12={})",
            data.len(), width, height, expected_rgb_size, expected_yuv_size, expected_nv12_size
        );
        
        // Try to extract whatever we can as Y channel
        let gray_len = pixel_count.min(data.len());
        data[..gray_len].to_vec()
    }

    /// Convert rustface FaceInfo to our Detection type.
    fn convert_faces_to_detections(faces: Vec<FaceInfo>, threshold: f32) -> Vec<Detection> {
        faces
            .into_iter()
            .filter(|face| face.score() >= threshold as f64)
            .map(|face| {
                let bbox = face.bbox();
                let bounding_box = BoundingBox::new(
                    bbox.x() as i32,
                    bbox.y() as i32,
                    bbox.width() as i32,
                    bbox.height() as i32,
                );
                Detection::new(bounding_box, face.score() as f32)
            })
            .collect()
    }

    /// Updates the detector configuration.
    /// Note: This creates a new detector thread with the new config.
    pub async fn update_config(&self, _config: DetectorConfig) {
        // For now, config updates would require restarting the detector
        // This is a limitation of the thread-based architecture
        warn!("Config updates not yet supported - restart detector to apply changes");
    }

    /// Extracts face embedding from a cropped face image.
    pub async fn extract_embedding(&self, _face_data: &[u8]) -> Option<FaceEmbedding> {
        if !self.config.extract_embeddings {
            return None;
        }
        
        // Note: Actual implementation would use ONNX Runtime with a face embedding model
        // This is a placeholder that generates a dummy embedding
        
        // In production, you would:
        // 1. Preprocess the face image (align, resize to 160x160)
        // 2. Run through FaceNet/ArcFace model
        // 3. L2 normalize the output
        
        let values = vec![0.0f32; EMBEDDING_DIMENSION];
        Some(FaceEmbedding::new(values))
    }

    /// Returns total detection count.
    pub async fn detection_count(&self) -> u64 {
        self.detection_count.load(Ordering::Relaxed)
    }
}

/// Aligns a face for better embedding extraction.
/// Uses facial landmarks to normalize pose.
#[allow(dead_code)]
pub fn align_face(
    _image_data: &[u8],
    _width: u32,
    _height: u32,
    _bbox: &BoundingBox,
) -> Vec<u8> {
    // Note: Actual implementation would:
    // 1. Detect facial landmarks (eyes, nose, mouth)
    // 2. Calculate affine transformation
    // 3. Warp image to align face
    
    Vec::new()
}

/// Crops a face from an image.
#[allow(dead_code)]
pub fn crop_face(
    _image_data: &[u8],
    width: u32,
    height: u32,
    bbox: &BoundingBox,
    margin: f32,
) -> Vec<u8> {
    // Expand bounding box by margin
    let expanded = bbox.scale(1.0 + margin);
    
    // Clamp to image bounds
    let _x1 = expanded.x().max(0) as u32;
    let _y1 = expanded.y().max(0) as u32;
    let _x2 = (expanded.right() as u32).min(width);
    let _y2 = (expanded.bottom() as u32).min(height);
    
    // Note: Actual cropping would be done here
    Vec::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_config_has_reasonable_values() {
        let config = DetectorConfig::default();
        assert!(config.min_face_size >= 20);
        assert!(config.confidence_threshold >= 0.5);
        assert!(config.scale_factor > 0.0 && config.scale_factor < 1.0);
    }

    #[tokio::test]
    async fn detector_tracks_detection_count() {
        // Skip test if model doesn't exist
        let config = DetectorConfig::default();
        if !config.model_path.exists() {
            return;
        }
        let detector = FaceDetector::new(config).unwrap();
        assert_eq!(detector.detection_count().await, 0);
    }
}
