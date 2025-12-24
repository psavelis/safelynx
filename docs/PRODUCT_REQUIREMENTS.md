# Safelynx Product Requirements Document (PRD)

## Executive Summary

**Safelynx** is an intelligent face recognition security platform designed for residential and small business environments. It provides real-time face detection, profile management, and automated security monitoring through a modern, privacy-first architecture.

---

## Product Vision

> "Local-first facial recognition security for homes and small businesses. No cloud required."

### Key Differentiators

1. **Local-First**: All processing happens on-device, no cloud dependency
2. **Privacy-Focused**: Face embeddings cannot reconstruct original faces
3. **macOS Optimized**: Native performance on Apple Silicon (M1/M4)
4. **Open Architecture**: Clean code, extensible design, well-documented

---

## User Personas

### 1. Homeowner (Primary)
- **Name**: Sarah, 42
- **Context**: Family home with 3 entry points
- **Goals**: Know who's at the door, track family arrivals, identify strangers
- **Pain Points**: Too many false alerts from motion cameras, can't tell if package was delivered

### 2. Small Business Owner (Secondary)
- **Name**: Mike, 35
- **Context**: Retail store with 2 employees
- **Goals**: Track employee attendance, identify repeat customers, flag shoplifters
- **Pain Points**: Expensive commercial systems, complicated setup

### 3. Technical Enthusiast (Power User)
- **Name**: Alex, 28
- **Context**: Smart home setup with multiple cameras
- **Goals**: Integrate with home automation, customize detection rules
- **Pain Points**: Closed ecosystems, lack of API access

---

## Use Cases

### UC-001: Real-Time Face Detection

**Actor**: System
**Trigger**: Camera captures video frame
**Preconditions**: Camera is connected and streaming

**Main Flow**:
1. Camera captures frame at configured FPS
2. System processes frame through face detection model (rustface)
3. For each detected face:
   - Extract 128-dimensional embedding (FaceNet via ONNX)
   - Search embedding cache for match (cosine distance < 0.4)
   - If match found: Update existing profile, record sighting
   - If no match: Create new profile with "Unknown" classification
4. Emit FaceDetected event for real-time updates
5. Store sighting in database with timestamp and snapshot

**Success Criteria**:
- Detection latency < 200ms per frame
- False positive rate < 5%
- True positive rate > 95%

**Technical Implementation**:
```rust
// DetectionService::process_frame()
for detection in frame.detections() {
    let embedding = detection.embedding()?;
    
    match face_matcher.find_match(&embedding).await {
        Some(match_result) => {
            // Known face - emit ProfileSighted event
            event_bus.publish(DomainEvent::ProfileSighted(...));
        }
        None => {
            // New face - create profile
            let profile = Profile::new(embedding, snapshot_path);
            profile_repo.save(&profile).await?;
            event_bus.publish(DomainEvent::ProfileCreated(...));
        }
    }
}
```

---

### UC-002: Profile Management

**Actor**: User
**Trigger**: User views profiles dashboard

**Flows**:

#### UC-002a: View All Profiles
1. User navigates to Profiles page
2. System displays paginated list of profiles
3. Each profile shows: thumbnail, name/ID, classification, sighting count, last seen

#### UC-002b: Classify Profile
1. User selects a profile
2. User chooses classification: Trusted, Known, Unknown, Flagged
3. System updates profile and stores change
4. If Flagged: Enable notifications for future sightings

#### UC-002c: Name Profile
1. User selects a profile
2. User enters display name
3. System updates profile name
4. Future detections show name in real-time feed

#### UC-002d: Add Tags to Profile
1. User selects a profile
2. User adds tags (e.g., "family", "delivery", "employee")
3. System stores tags for filtering/search

**API Endpoints**:
```
GET    /api/v1/profiles              - List all profiles
GET    /api/v1/profiles/:id          - Get single profile
PUT    /api/v1/profiles/:id          - Update profile (name, classification, tags)
DELETE /api/v1/profiles/:id          - Delete profile
GET    /api/v1/profiles/:id/sightings - Get profile's sighting history
```

---

### UC-003: Camera Management

**Actor**: User
**Trigger**: User configures cameras

**Flows**:

#### UC-003a: Add Camera
1. User clicks "Add Camera"
2. User selects camera type: Built-in, USB, RTSP
3. For RTSP: User enters stream URL
4. System validates connection
5. Camera appears in list with "Inactive" status

#### UC-003b: Start Camera Stream
1. User clicks "Start" on camera
2. System begins capturing frames
3. Camera status changes to "Active"
4. Live feed appears in dashboard

#### UC-003c: Configure Camera Settings
1. User opens camera settings
2. User adjusts: resolution, FPS, location name
3. System applies settings on next frame

**Camera Types**:
| Type | Device ID Format | Example |
|------|------------------|---------|
| Built-in | `0` | MacBook FaceTime camera |
| USB | `1`, `2`, ... | External webcam |
| RTSP | `rtsp://...` | IP camera stream |

---

### UC-004: Detection-Triggered Recording

**Actor**: System
**Trigger**: Face detected in frame

**Main Flow**:
1. Face detection triggers recording start
2. Pre-trigger buffer (5s) is included
3. Recording continues while faces are detected
4. Post-trigger buffer (10s) after last detection
5. Recording stops and file is finalized
6. Sightings are linked to recording with timestamps

**Configuration**:
```rust
pub struct RecordingSettings {
    pub detection_triggered: bool,     // Enable auto-recording
    pub pre_trigger_buffer_secs: i64,  // Seconds before detection
    pub post_trigger_buffer_secs: i64, // Seconds after last detection
    pub max_segment_duration_secs: i64, // Max recording length
    pub max_storage_bytes: u64,        // 100GB default
}
```

---

### UC-005: Analytics Dashboard

**Actor**: User
**Trigger**: User opens dashboard

**Features**:

#### UC-005a: Profile Statistics
- Total profiles by classification
- New profiles today/week
- Most frequently seen profiles

#### UC-005b: Activity Timeline
- Chronological list of sightings
- Filter by: profile, camera, classification, time range
- Click to view snapshot/recording

#### UC-005c: Activity Heatmap
- Hourly detection counts (24h × 7d grid)
- Color intensity indicates activity level
- Helps identify patterns (e.g., delivery times)

#### UC-005d: Storage Usage
- Current usage vs. limit (100GB default)
- Breakdown by: recordings, snapshots
- Auto-cleanup status

**API Endpoints**:
```
GET /api/v1/analytics/dashboard  - Dashboard stats
GET /api/v1/analytics/timeline   - Activity timeline
GET /api/v1/analytics/heatmap    - Activity heatmap
GET /api/v1/analytics/storage    - Storage statistics
```

---

### UC-006: Real-Time Notifications

**Actor**: System
**Trigger**: Face detected matching notification criteria

**Main Flow**:
1. Face detected and matched to profile
2. Check notification settings:
   - Flagged profiles: Always notify
   - Unknown profiles: Notify if enabled
   - New profiles: Notify if enabled
3. Emit WebSocket event to connected clients
4. (Future) Send desktop notification
5. (Future) Send push notification to mobile app

**WebSocket Events**:
```typescript
// Real-time face detection
{
  "type": "FaceDetected",
  "payload": {
    "camera_id": "uuid",
    "profile_id": "uuid",
    "profile_name": "John",
    "confidence": 0.95,
    "bounding_box": { "x": 100, "y": 50, "width": 200, "height": 200 },
    "timestamp": "2024-12-24T10:30:00Z"
  }
}

// New sighting recorded
{
  "type": "NewSighting",
  "payload": {
    "id": "uuid",
    "profile_id": "uuid",
    "camera_id": "uuid",
    "snapshot_url": "/snapshots/abc123.jpg"
  }
}
```

---

### UC-007: Storage Management

**Actor**: System
**Trigger**: Storage usage exceeds threshold

**Main Flow**:
1. Storage manager checks usage periodically
2. If usage > 90%: Warn user via WebSocket
3. If usage > 95% and auto-cleanup enabled:
   - Delete oldest recordings first
   - Delete oldest snapshots
   - Continue until usage < 80%
4. Log cleanup actions

**Configuration**:
```rust
pub struct StorageConfig {
    pub max_storage_bytes: u64,        // 100GB default
    pub auto_cleanup_enabled: bool,    // Enable auto-deletion
    pub cleanup_target_percent: f32,   // Target: 80%
    pub retention_days: i32,           // Min retention: 30 days
}
```

---

## Feature Requirements

### F-001: Face Detection Engine

| Requirement | Description | Priority |
|-------------|-------------|----------|
| F-001.1 | Detect faces in real-time video stream | P0 |
| F-001.2 | Extract 128-dim face embedding | P0 |
| F-001.3 | Match embedding against known profiles | P0 |
| F-001.4 | Support configurable confidence threshold | P1 |
| F-001.5 | Track detection count statistics | P1 |
| F-001.6 | GPU acceleration support | P2 |

### F-002: Profile Management

| Requirement | Description | Priority |
|-------------|-------------|----------|
| F-002.1 | Auto-create profile for new faces | P0 |
| F-002.2 | Classify profiles (Trusted/Known/Unknown/Flagged) | P0 |
| F-002.3 | Assign display names to profiles | P0 |
| F-002.4 | Add tags to profiles | P1 |
| F-002.5 | Add notes to profiles | P2 |
| F-002.6 | Merge duplicate profiles | P2 |
| F-002.7 | Export/import profiles | P3 |

### F-003: Camera Support

| Requirement | Description | Priority |
|-------------|-------------|----------|
| F-003.1 | Support MacBook built-in camera | P0 |
| F-003.2 | Support USB webcams | P0 |
| F-003.3 | Support RTSP streams | P0 |
| F-003.4 | Configurable resolution/FPS | P1 |
| F-003.5 | Camera health monitoring | P1 |
| F-003.6 | Multi-camera simultaneous capture | P2 |

### F-004: Recording

| Requirement | Description | Priority |
|-------------|-------------|----------|
| F-004.1 | Detection-triggered recording | P0 |
| F-004.2 | Pre/post trigger buffers | P1 |
| F-004.3 | Recording playback | P1 |
| F-004.4 | Link sightings to recordings | P1 |
| F-004.5 | Scheduled recording | P2 |
| F-004.6 | Manual recording trigger | P2 |

### F-005: Analytics

| Requirement | Description | Priority |
|-------------|-------------|----------|
| F-005.1 | Dashboard statistics | P0 |
| F-005.2 | Activity timeline | P1 |
| F-005.3 | Activity heatmap | P1 |
| F-005.4 | Storage usage stats | P1 |
| F-005.5 | Export reports | P2 |

### F-006: Notifications

| Requirement | Description | Priority |
|-------------|-------------|----------|
| F-006.1 | WebSocket real-time events | P0 |
| F-006.2 | Desktop notifications | P1 |
| F-006.3 | Email notifications | P2 |
| F-006.4 | Mobile push notifications | P3 |

---

## Non-Functional Requirements

### NFR-001: Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Frame processing | < 200ms | End-to-end latency |
| Face matching | < 10ms | Embedding search time |
| API response | < 100ms | P95 latency |
| Memory usage | < 2GB | Resident set size |
| Startup time | < 5s | Time to first frame |

### NFR-002: Reliability

| Requirement | Target |
|-------------|--------|
| Uptime | 99.9% |
| Data durability | No data loss on clean shutdown |
| Recovery time | < 30s after crash |

### NFR-003: Security

| Requirement | Description |
|-------------|-------------|
| Data at rest | Embeddings stored securely |
| Data in transit | HTTPS for API, WSS for WebSocket |
| Access control | (Future) JWT authentication |

### NFR-004: Scalability

| Requirement | Target |
|-------------|--------|
| Profiles | 10,000+ |
| Cameras | 10+ simultaneous |
| Sightings/day | 100,000+ |

---

## Technical Constraints

1. **Platform**: macOS 12+ (Apple Silicon optimized)
2. **Database**: PostgreSQL 16+
3. **Backend**: Rust (async, Tokio runtime)
4. **Frontend**: React 18, TypeScript, Vite
5. **Camera**: nokhwa (AVFoundation backend)
6. **Face Detection**: rustface (pure Rust)
7. **Embeddings**: ONNX Runtime (FaceNet model)

---

## Acceptance Criteria

### MVP (Minimum Viable Product)

- [ ] Detect faces from built-in camera
- [ ] Create/view/classify profiles
- [ ] View sighting history
- [ ] Real-time WebSocket updates
- [ ] Basic dashboard statistics
- [ ] 70+ unit tests passing

### Beta Release

- [ ] All MVP features
- [ ] RTSP camera support
- [ ] Detection-triggered recording
- [ ] Activity heatmap
- [ ] Storage management
- [ ] Desktop notifications

### 1.0 Release

- [ ] All Beta features
- [ ] Multi-camera support
- [ ] Profile merge/export
- [ ] Mobile app (iOS)
- [ ] Email notifications
- [ ] Documentation complete

---

## Glossary

| Term | Definition |
|------|------------|
| **Embedding** | 128-dimensional vector representing a face's unique features |
| **Profile** | A recognized individual with associated embeddings and metadata |
| **Sighting** | A recorded instance of seeing a profile at a specific time/location |
| **Classification** | Category assigned to a profile (Trusted/Known/Unknown/Flagged) |
| **Cosine Distance** | Metric for comparing embeddings (0 = identical, 2 = opposite) |
| **RTSP** | Real-Time Streaming Protocol for IP cameras |

---

*Document Version: 1.0*
*Last Updated: December 2024*
*Author: Safelynx Product Team*
