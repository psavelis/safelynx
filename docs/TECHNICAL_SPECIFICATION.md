# Safelynx Technical Specification

## System Overview

**Safelynx** is a privacy-first, real-time face recognition security platform designed for residential and small business environments. It combines edge-capable face detection with cloud-scalable profile matching to deliver sub-second person identification.

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SAFELYNX PLATFORM                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Camera    │    │   Camera    │    │   Camera    │    │   Camera    │  │
│  │   Stream    │    │   Stream    │    │   Stream    │    │   Stream    │  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘  │
│         │                  │                  │                  │          │
│         └──────────────────┼──────────────────┼──────────────────┘          │
│                            │                  │                             │
│                    ┌───────▼──────────────────▼───────┐                     │
│                    │      CAPTURE SERVICE             │                     │
│                    │  (Frame Acquisition & Decode)    │                     │
│                    └───────────────┬──────────────────┘                     │
│                                    │                                        │
│                    ┌───────────────▼──────────────────┐                     │
│                    │      DETECTION SERVICE           │                     │
│                    │  (Face Detection via rustface)   │                     │
│                    └───────────────┬──────────────────┘                     │
│                                    │                                        │
│                    ┌───────────────▼──────────────────┐                     │
│                    │      EMBEDDING SERVICE           │                     │
│                    │  (FaceNet via ONNX Runtime)      │                     │
│                    └───────────────┬──────────────────┘                     │
│                                    │                                        │
│                    ┌───────────────▼──────────────────┐                     │
│                    │      MATCHING SERVICE            │                     │
│                    │  (Profile Matching & Tracking)   │                     │
│                    └───────────────┬──────────────────┘                     │
│                                    │                                        │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         │                          │                          │             │
│ ┌───────▼───────┐         ┌────────▼────────┐        ┌────────▼────────┐   │
│ │ Recording     │         │  Event Bus      │        │  WebSocket      │   │
│ │ Service       │         │  (Domain Events)│        │  Broadcaster    │   │
│ └───────────────┘         └─────────────────┘        └─────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                              INFRASTRUCTURE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │   PostgreSQL    │    │   File System   │    │   REST API      │         │
│  │   (Profiles,    │    │   (Recordings,  │    │   (Axum Server) │         │
│  │    Sightings)   │    │    Snapshots)   │    │                 │         │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Clean Architecture Layers

```
┌────────────────────────────────────────────────────────────┐
│                    PRESENTATION LAYER                      │
│  (React Frontend, REST API, WebSocket Handlers)            │
├────────────────────────────────────────────────────────────┤
│                    APPLICATION LAYER                       │
│  (Use Cases, Services, Event Bus)                          │
├────────────────────────────────────────────────────────────┤
│                      DOMAIN LAYER                          │
│  (Entities, Value Objects, Repository Traits, Events)      │
├────────────────────────────────────────────────────────────┤
│                   INFRASTRUCTURE LAYER                     │
│  (PostgreSQL, File System, Camera Capture, ONNX Runtime)   │
└────────────────────────────────────────────────────────────┘
```

---

## Domain Model

### Core Entities

#### Profile
Represents a recognized individual in the system.

```rust
pub struct Profile {
    id: Uuid,
    name: Option<String>,
    classification: ProfileClassification,
    embedding: FaceEmbedding,
    thumbnail_path: Option<String>,
    tags: Vec<ProfileTag>,
    notes: Option<String>,
    first_seen_at: DateTime<Utc>,
    last_seen_at: DateTime<Utc>,
    sighting_count: i32,
    is_active: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique identifier |
| `name` | Optional String | Display name (set by user) |
| `classification` | Enum | Known, Unknown, Flagged |
| `embedding` | FaceEmbedding | 128-dim face vector |
| `thumbnail_path` | Optional String | Path to face thumbnail |
| `tags` | Vec<ProfileTag> | User-defined labels |
| `sighting_count` | i32 | Total times seen |

#### Camera
Represents a video source in the system.

```rust
pub struct Camera {
    id: Uuid,
    name: String,
    camera_type: CameraType,
    connection_string: String,
    location: Option<String>,
    status: CameraStatus,
    is_enabled: bool,
    settings: CameraSettings,
    last_frame_at: Option<DateTime<Utc>>,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}
```

| Camera Type | Protocol | Use Case |
|-------------|----------|----------|
| `Rtsp` | RTSP | IP cameras, NVRs |
| `Usb` | V4L2/DirectShow | USB webcams |
| `File` | File path | Testing, playback |
| `Screen` | Screen capture | Desktop monitoring |

#### Sighting
Records when a profile is detected.

```rust
pub struct Sighting {
    id: Uuid,
    profile_id: Uuid,
    camera_id: Uuid,
    confidence: f32,
    bounding_box: BoundingBox,
    snapshot_path: Option<String>,
    location: Option<GeoLocation>,
    detected_at: DateTime<Utc>,
    created_at: DateTime<Utc>,
}
```

#### Recording
Video recording metadata.

```rust
pub struct Recording {
    id: Uuid,
    camera_id: Uuid,
    file_path: String,
    start_time: DateTime<Utc>,
    end_time: Option<DateTime<Utc>>,
    duration_secs: Option<i64>,
    file_size_bytes: Option<i64>,
    status: RecordingStatus,
    trigger_type: RecordingTrigger,
    trigger_profile_id: Option<Uuid>,
    created_at: DateTime<Utc>,
}
```

### Value Objects

#### FaceEmbedding
128-dimensional face descriptor vector (FaceNet standard).

```rust
pub struct FaceEmbedding {
    values: Vec<f32>,  // length = 128
}

impl FaceEmbedding {
    // Euclidean distance for similarity
    pub fn distance(&self, other: &FaceEmbedding) -> f32;
    
    // Cosine similarity (0 = identical, 2 = opposite)
    pub fn cosine_distance(&self, other: &FaceEmbedding) -> f32;
}
```

**Matching Thresholds:**
- `< 0.4`: High confidence match
- `0.4 - 0.6`: Medium confidence
- `> 0.6`: No match

#### BoundingBox
Face location in frame coordinates.

```rust
pub struct BoundingBox {
    x: i32,      // Top-left X
    y: i32,      // Top-left Y
    width: i32,  // Box width
    height: i32, // Box height
}
```

#### GeoLocation
GPS coordinates for location-aware sightings.

```rust
pub struct GeoLocation {
    latitude: f64,
    longitude: f64,
    accuracy_meters: Option<f32>,
}
```

---

## API Specification

### REST Endpoints

#### Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/profiles` | List all profiles |
| `GET` | `/api/v1/profiles/{id}` | Get profile by ID |
| `POST` | `/api/v1/profiles` | Create profile |
| `PUT` | `/api/v1/profiles/{id}` | Update profile |
| `DELETE` | `/api/v1/profiles/{id}` | Delete profile |
| `GET` | `/api/v1/profiles/{id}/sightings` | Get profile sightings |

#### Cameras

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/cameras` | List all cameras |
| `GET` | `/api/v1/cameras/{id}` | Get camera by ID |
| `POST` | `/api/v1/cameras` | Add camera |
| `PUT` | `/api/v1/cameras/{id}` | Update camera |
| `DELETE` | `/api/v1/cameras/{id}` | Remove camera |
| `POST` | `/api/v1/cameras/{id}/start` | Start streaming |
| `POST` | `/api/v1/cameras/{id}/stop` | Stop streaming |

#### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/analytics/dashboard` | Dashboard stats |
| `GET` | `/api/v1/analytics/heatmap` | Activity heatmap |
| `GET` | `/api/v1/analytics/timeline` | Detection timeline |
| `GET` | `/api/v1/analytics/storage` | Storage statistics |

#### Settings

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/settings` | Get all settings |
| `PUT` | `/api/v1/settings` | Update settings |

### WebSocket Events

Connect to: `ws://localhost:7889/api/v1/ws`

#### Outbound Events (Server → Client)

```typescript
// Face detected in frame
{
  "type": "FaceDetected",
  "payload": {
    "camera_id": "uuid",
    "camera_name": "string",
    "profile_id": "uuid | null",
    "profile_name": "string | null",
    "confidence": 0.95,
    "bounding_box": { "x": 100, "y": 50, "width": 200, "height": 200 },
    "timestamp": "2024-01-01T12:00:00Z"
  }
}

// New sighting recorded
{
  "type": "NewSighting",
  "payload": {
    "id": "uuid",
    "profile_id": "uuid",
    "profile_name": "string",
    "camera_id": "uuid",
    "camera_name": "string",
    "confidence": 0.92,
    "detected_at": "2024-01-01T12:00:00Z",
    "snapshot_url": "/snapshots/abc123.jpg"
  }
}

// New profile created
{
  "type": "NewProfile",
  "payload": {
    "id": "uuid",
    "name": null,
    "classification": "unknown",
    "tags": [],
    "sightings_count": 1
  }
}

// Camera status changed
{
  "type": "CameraStatusChanged",
  "payload": {
    "camera_id": "uuid",
    "camera_name": "string",
    "status": "online | offline | error",
    "streaming": true
  }
}
```

---

## Database Schema

### PostgreSQL DDL

```sql
-- Custom enums
CREATE TYPE profile_classification AS ENUM ('unknown', 'known', 'flagged');
CREATE TYPE camera_type AS ENUM ('rtsp', 'usb', 'file', 'screen');
CREATE TYPE camera_status AS ENUM ('online', 'offline', 'error');
CREATE TYPE recording_status AS ENUM ('recording', 'completed', 'failed');
CREATE TYPE recording_trigger AS ENUM ('manual', 'scheduled', 'detection', 'motion');

-- Profiles table
CREATE TABLE profiles (
    id UUID PRIMARY KEY,
    name VARCHAR(255),
    classification profile_classification NOT NULL DEFAULT 'unknown',
    embedding BYTEA NOT NULL,  -- 512 bytes (128 x f32)
    thumbnail_path VARCHAR(500),
    tags JSONB NOT NULL DEFAULT '[]',
    notes TEXT,
    first_seen_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    sighting_count INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cameras table
CREATE TABLE cameras (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    camera_type camera_type NOT NULL,
    connection_string VARCHAR(1000) NOT NULL,
    location VARCHAR(255),
    status camera_status NOT NULL DEFAULT 'offline',
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    settings JSONB NOT NULL DEFAULT '{}',
    last_frame_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sightings table
CREATE TABLE sightings (
    id UUID PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    confidence REAL NOT NULL,
    bounding_box JSONB NOT NULL,
    snapshot_path VARCHAR(500),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    location_accuracy REAL,
    detected_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recordings table
CREATE TABLE recordings (
    id UUID PRIMARY KEY,
    camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    file_path VARCHAR(1000) NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_secs BIGINT,
    file_size_bytes BIGINT,
    status recording_status NOT NULL DEFAULT 'recording',
    trigger_type recording_trigger NOT NULL DEFAULT 'manual',
    trigger_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Settings table
CREATE TABLE settings (
    id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- Singleton
    detection JSONB NOT NULL DEFAULT '{}',
    recording JSONB NOT NULL DEFAULT '{}',
    notifications JSONB NOT NULL DEFAULT '{}',
    privacy JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_classification ON profiles(classification);
CREATE INDEX idx_profiles_last_seen ON profiles(last_seen_at DESC);
CREATE INDEX idx_sightings_profile ON sightings(profile_id);
CREATE INDEX idx_sightings_camera ON sightings(camera_id);
CREATE INDEX idx_sightings_detected ON sightings(detected_at DESC);
CREATE INDEX idx_recordings_camera ON recordings(camera_id);
CREATE INDEX idx_recordings_start ON recordings(start_time DESC);
```

---

## Face Recognition Pipeline

### Processing Flow

```
Frame (1920x1080 RGB)
    │
    ▼
┌───────────────────────────────────────┐
│  1. FACE DETECTION (rustface)         │
│     • Input: Full frame               │
│     • Output: List of BoundingBoxes   │
│     • Time: ~30-50ms                  │
└───────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────┐
│  2. FACE ALIGNMENT (optional)         │
│     • Eye detection & rotation        │
│     • Normalization to 160x160        │
│     • Time: ~5-10ms per face         │
└───────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────┐
│  3. EMBEDDING EXTRACTION (ONNX/FaceNet)│
│     • Input: 160x160 RGB face         │
│     • Output: 128-dim float vector    │
│     • Time: ~50-80ms per face (CPU)   │
│     • Time: ~5-10ms per face (GPU)    │
└───────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────┐
│  4. PROFILE MATCHING (FaceMatcher)    │
│     • Compare against known embeddings│
│     • Cosine distance threshold: 0.4  │
│     • Time: O(n) linear, ~1ms/1000    │
└───────────────────────────────────────┘
    │
    ▼
┌───────────────────────────────────────┐
│  5. PROFILE CREATION/UPDATE           │
│     • New face → Create profile       │
│     • Known face → Update sighting    │
│     • Emit domain events              │
└───────────────────────────────────────┘
```

### Detection Configuration

```rust
pub struct DetectionSettings {
    pub enabled: bool,
    pub min_face_size: i32,       // Minimum face pixels (default: 80)
    pub confidence_threshold: f32, // Detection confidence (default: 0.7)
    pub match_threshold: f32,      // Embedding match threshold (default: 0.4)
    pub process_every_n_frames: u32, // Skip frames for performance (default: 3)
    pub max_faces_per_frame: usize,  // Limit detections (default: 10)
}
```

---

## Security Considerations

### Data Protection

1. **Embedding Storage**: Face embeddings are one-way; original faces cannot be reconstructed
2. **Local-First**: All processing happens on-device by default
3. **Encryption at Rest**: Recommended for production deployments
4. **Access Control**: JWT-based authentication (future enhancement)

### Privacy Features

```rust
pub struct PrivacySettings {
    pub auto_delete_unknown_after_days: Option<i32>,
    pub blur_unknown_faces_in_recordings: bool,
    pub require_consent_for_known_profiles: bool,
    pub data_retention_days: i32,
}
```

---

## Deployment

### Docker Compose (Recommended)

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: safelynx
      POSTGRES_PASSWORD: safelynx
      POSTGRES_DB: safelynx
    ports:
      - "7888:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/init.sql:/docker-entrypoint-initdb.d/init.sql

  backend:
    build: ./backend
    environment:
      DATABASE_URL: postgres://safelynx:safelynx@postgres:5432/safelynx
      HOST: 0.0.0.0
      PORT: 7889
    ports:
      - "7889:7889"
    depends_on:
      - postgres
    volumes:
      - safelynx_data:/app/data

  frontend:
    build: ./frontend
    ports:
      - "7900:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  safelynx_data:
```

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 4 GB | 8+ GB |
| GPU | - | NVIDIA GTX 1060+ |
| Storage | 20 GB | 100+ GB SSD |
| Network | 100 Mbps | 1 Gbps |

---

## Future Roadmap

### v1.1 - Performance
- [ ] GPU acceleration (CUDA)
- [ ] HNSW embedding index
- [ ] Batch face processing

### v1.2 - Features
- [ ] Multi-user authentication
- [ ] Mobile app (iOS/Android)
- [ ] Email/SMS notifications
- [ ] Scheduled recordings

### v2.0 - Enterprise
- [ ] Distributed deployment
- [ ] Active Directory integration
- [ ] Audit logging
- [ ] Custom ML model support

---

*Document Version: 1.0*
*Last Updated: 2024*
