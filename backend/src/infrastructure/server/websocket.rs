//! WebSocket Handler
//!
//! Real-time event streaming for face detection events.

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
};
use chrono::{DateTime, Utc};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::broadcast;
use uuid::Uuid;

use crate::domain::events::DomainEvent;
use crate::infrastructure::server::AppState;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum WsMessage {
    Connected { client_id: String },
    FaceDetected(FaceDetectedPayload),
    NewSighting(SightingPayload),
    NewProfile(ProfilePayload),
    ProfileUpdated(ProfilePayload),
    CameraStatusChanged(CameraStatusPayload),
    RecordingStarted(RecordingPayload),
    RecordingStopped(RecordingPayload),
    StorageWarning(StorageWarningPayload),
    Ping,
    Pong,
    Error { message: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceDetectedPayload {
    pub camera_id: Uuid,
    pub camera_name: String,
    pub profile_id: Option<Uuid>,
    pub profile_name: Option<String>,
    pub confidence: f32,
    pub bounding_box: BoundingBoxPayload,
    pub timestamp: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBoxPayload {
    pub x: f32,
    pub y: f32,
    pub width: f32,
    pub height: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SightingPayload {
    pub id: Uuid,
    pub profile_id: Uuid,
    pub profile_name: Option<String>,
    pub camera_id: Uuid,
    pub camera_name: String,
    pub confidence: f32,
    pub detected_at: DateTime<Utc>,
    pub snapshot_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfilePayload {
    pub id: Uuid,
    pub name: Option<String>,
    pub classification: String,
    pub tags: Vec<String>,
    pub sightings_count: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraStatusPayload {
    pub camera_id: Uuid,
    pub camera_name: String,
    pub status: String,
    pub streaming: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecordingPayload {
    pub id: Uuid,
    pub camera_id: Uuid,
    pub camera_name: String,
    pub started_at: DateTime<Utc>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StorageWarningPayload {
    pub percent_used: f32,
    pub bytes_used: i64,
    pub bytes_total: i64,
    pub message: String,
}

pub struct WsBroadcaster {
    tx: broadcast::Sender<WsMessage>,
}

impl WsBroadcaster {
    pub fn new(capacity: usize) -> Self {
        let (tx, _) = broadcast::channel(capacity);
        Self { tx }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<WsMessage> {
        self.tx.subscribe()
    }

    pub fn broadcast(&self, msg: WsMessage) {
        let _ = self.tx.send(msg);
    }

    pub fn broadcast_domain_event(&self, event: DomainEvent) {
        match event {
            DomainEvent::FaceDetected(e) => {
                self.broadcast(WsMessage::FaceDetected(FaceDetectedPayload {
                    camera_id: e.camera_id,
                    camera_name: String::new(),
                    profile_id: e.profile_id,
                    profile_name: e.profile_name,
                    confidence: e.confidence,
                    bounding_box: BoundingBoxPayload {
                        x: e.bounding_box.x() as f32,
                        y: e.bounding_box.y() as f32,
                        width: e.bounding_box.width() as f32,
                        height: e.bounding_box.height() as f32,
                    },
                    timestamp: e.timestamp,
                }));
            }
            DomainEvent::ProfileSighted(e) => {
                self.broadcast(WsMessage::NewSighting(SightingPayload {
                    id: e.sighting_id,
                    profile_id: e.profile_id,
                    profile_name: e.profile_name,
                    camera_id: e.camera_id,
                    camera_name: String::new(),
                    confidence: e.confidence,
                    detected_at: e.timestamp,
                    snapshot_url: None,
                }));
            }
            DomainEvent::ProfileCreated(e) => {
                self.broadcast(WsMessage::NewProfile(ProfilePayload {
                    id: e.profile_id,
                    name: None,
                    classification: "unknown".to_string(),
                    tags: Vec::new(),
                    sightings_count: 1,
                }));
            }
            DomainEvent::CameraStatusChanged(e) => {
                self.broadcast(WsMessage::CameraStatusChanged(CameraStatusPayload {
                    camera_id: e.camera_id,
                    camera_name: e.camera_name,
                    status: e.status.clone(),
                    streaming: e.status == "streaming",
                }));
            }
            DomainEvent::RecordingStarted(e) => {
                self.broadcast(WsMessage::RecordingStarted(RecordingPayload {
                    id: e.recording_id,
                    camera_id: e.camera_id,
                    camera_name: String::new(),
                    started_at: e.timestamp,
                    reason: "detection".to_string(),
                }));
            }
            DomainEvent::RecordingEnded(e) => {
                self.broadcast(WsMessage::RecordingStopped(RecordingPayload {
                    id: e.recording_id,
                    camera_id: e.camera_id,
                    camera_name: String::new(),
                    started_at: e.timestamp,
                    reason: "detection".to_string(),
                }));
            }
            DomainEvent::SettingsChanged(_) => {}
        }
    }
}

/// WebSocket upgrade handler
pub async fn ws_handler(ws: WebSocketUpgrade, State(state): State<Arc<AppState>>) -> Response {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let (mut sender, mut receiver) = socket.split();

    let client_id = Uuid::new_v4().to_string();
    let connected_msg = WsMessage::Connected {
        client_id: client_id.clone(),
    };

    if let Ok(json) = serde_json::to_string(&connected_msg) {
        let _ = sender.send(Message::Text(json.into())).await;
    }

    let mut rx = state.ws_broadcaster.subscribe();

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            if let Ok(json) = serde_json::to_string(&msg) {
                if sender.send(Message::Text(json.into())).await.is_err() {
                    break;
                }
            }
        }
    });

    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(ws_msg) = serde_json::from_str::<WsMessage>(&text) {
                        match ws_msg {
                            WsMessage::Ping => {}
                            _ => {}
                        }
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = &mut send_task => recv_task.abort(),
        _ = &mut recv_task => send_task.abort(),
    };

    tracing::info!("WebSocket client {} disconnected", client_id);
}
