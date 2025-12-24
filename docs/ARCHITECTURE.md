# Safelynx Architecture & Design Patterns

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Clean Architecture Implementation](#clean-architecture-implementation)
3. [Design Patterns](#design-patterns)
4. [Code Examples](#code-examples)
5. [Testing Strategy](#testing-strategy)
6. [Database Design](#database-design)
7. [API Design](#api-design)

---

## Architecture Overview

Safelynx follows **Clean Architecture** principles (also known as Hexagonal Architecture or Ports & Adapters), ensuring:

- **Independence from frameworks**: Business logic doesn't depend on Axum, SQLx, or any external library
- **Testability**: Core domain can be tested without UI, database, or external services
- **Independence from UI**: The UI can change without changing the business rules
- **Independence from database**: PostgreSQL can be swapped for any other database
- **Independence from external agencies**: Business rules don't know about the outside world

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRESENTATION LAYER                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐             │
│  │   REST API      │  │   WebSocket     │  │   React UI      │             │
│  │   (Axum)        │  │   Handler       │  │   (Frontend)    │             │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘             │
│           │                    │                    │                       │
├───────────┼────────────────────┼────────────────────┼───────────────────────┤
│           │         APPLICATION LAYER               │                       │
│           ▼                    ▼                    ▼                       │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                      USE CASES                              │           │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │           │
│  │  │ManageProfiles│  │ProcessFrame  │  │QueryAnalytics│      │           │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                              │                                              │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                      SERVICES                               │           │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │           │
│  │  │DetectionSvc  │  │FaceMatcher   │  │RecordingSvc  │      │           │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │           │
│  │  ┌──────────────┐  ┌──────────────┐                        │           │
│  │  │StorageManager│  │EventBus      │                        │           │
│  │  └──────────────┘  └──────────────┘                        │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                              │                                              │
├──────────────────────────────┼──────────────────────────────────────────────┤
│                       DOMAIN LAYER                                          │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                      ENTITIES                               │           │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │           │
│  │  │Profile       │  │Camera        │  │Sighting      │      │           │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │           │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │           │
│  │  │Recording     │  │Detection     │  │Settings      │      │           │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │           │
│  └─────────────────────────────────────────────────────────────┘           │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    VALUE OBJECTS                            │           │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │           │
│  │  │FaceEmbedding │  │BoundingBox   │  │GeoLocation   │      │           │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │           │
│  │  ┌──────────────┐                                          │           │
│  │  │ProfileTag    │                                          │           │
│  │  └──────────────┘                                          │           │
│  └─────────────────────────────────────────────────────────────┘           │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │              REPOSITORY TRAITS (Ports)                      │           │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │           │
│  │  │ProfileRepo   │  │CameraRepo    │  │SightingRepo  │      │           │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │           │
│  └─────────────────────────────────────────────────────────────┘           │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    DOMAIN EVENTS                            │           │
│  │  FaceDetected │ ProfileCreated │ ProfileSighted │ ...       │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                      INFRASTRUCTURE LAYER                                   │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │              REPOSITORY IMPLEMENTATIONS (Adapters)          │           │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │           │
│  │  │PgProfileRepo │  │PgCameraRepo  │  │PgSightingRepo│      │           │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │           │
│  └─────────────────────────────────────────────────────────────┘           │
│  ┌─────────────────────────────────────────────────────────────┐           │
│  │                    EXTERNAL SERVICES                        │           │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │           │
│  │  │FaceDetector  │  │CameraCapture │  │ONNX Runtime  │      │           │
│  │  │(rustface)    │  │(nokhwa)      │  │(embeddings)  │      │           │
│  │  └──────────────┘  └──────────────┘  └──────────────┘      │           │
│  └─────────────────────────────────────────────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Clean Architecture Implementation

### Directory Structure

```
backend/src/
├── main.rs                 # Application entry point
├── lib.rs                  # Library exports
│
├── domain/                 # DOMAIN LAYER (innermost)
│   ├── mod.rs
│   ├── entities/           # Business entities with behavior
│   │   ├── profile.rs      # Profile entity
│   │   ├── camera.rs       # Camera entity
│   │   ├── sighting.rs     # Sighting entity
│   │   ├── recording.rs    # Recording entity
│   │   ├── detection.rs    # Detection/FrameDetections
│   │   └── settings.rs     # Settings entity
│   │
│   ├── value_objects/      # Immutable value types
│   │   ├── face_embedding.rs   # 128-dim face vector
│   │   ├── bounding_box.rs     # Face location
│   │   ├── geo_location.rs     # GPS coordinates
│   │   └── profile_tag.rs      # Profile labels
│   │
│   ├── repositories.rs     # Repository trait definitions (Ports)
│   └── events.rs           # Domain events
│
├── application/            # APPLICATION LAYER
│   ├── mod.rs
│   ├── services/           # Application services
│   │   ├── detection_service.rs
│   │   ├── face_matcher.rs
│   │   ├── recording_service.rs
│   │   ├── storage_manager.rs
│   │   └── event_bus.rs
│   │
│   └── use_cases/          # Use case implementations
│       ├── manage_profiles.rs
│       ├── manage_cameras.rs
│       ├── process_frame.rs
│       └── query_analytics.rs
│
└── infrastructure/         # INFRASTRUCTURE LAYER (outermost)
    ├── mod.rs
    ├── config.rs           # Application configuration
    │
    ├── database/           # Database adapters
    │   ├── mod.rs
    │   ├── connection.rs   # Connection pool
    │   ├── models.rs       # SQLx row models
    │   └── repositories/   # Repository implementations
    │       ├── profile_repository.rs
    │       ├── camera_repository.rs
    │       ├── sighting_repository.rs
    │       ├── recording_repository.rs
    │       └── settings_repository.rs
    │
    ├── camera/             # Camera adapters
    │   ├── capture.rs      # Frame capture (nokhwa)
    │   └── face_detector.rs # Face detection (rustface)
    │
    └── server/             # HTTP server
        ├── mod.rs          # Server setup
        ├── websocket.rs    # WebSocket handler
        └── api/            # REST endpoints
            ├── profiles.rs
            ├── cameras.rs
            ├── sightings.rs
            ├── recordings.rs
            ├── settings.rs
            └── analytics.rs
```

---

## Design Patterns

### 1. Repository Pattern

**Purpose**: Abstract data persistence from business logic.

**Domain Layer** (Port - Interface):
```rust
// src/domain/repositories.rs
#[async_trait]
pub trait ProfileRepository: Send + Sync {
    async fn find_by_id(&self, id: Uuid) -> RepoResult<Option<Profile>>;
    async fn find_all_active(&self) -> RepoResult<Vec<Profile>>;
    async fn save(&self, profile: &Profile) -> RepoResult<()>;
    async fn update(&self, profile: &Profile) -> RepoResult<()>;
    async fn delete(&self, id: Uuid) -> RepoResult<()>;
}
```

**Infrastructure Layer** (Adapter - Implementation):
```rust
// src/infrastructure/database/repositories/profile_repository.rs
pub struct PgProfileRepository {
    pool: PgPool,
}

#[async_trait]
impl ProfileRepository for PgProfileRepository {
    async fn find_by_id(&self, id: Uuid) -> RepoResult<Option<Profile>> {
        let row = sqlx::query_as::<_, ProfileRow>(
            "SELECT * FROM profiles WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        
        Ok(row.and_then(|r| self.row_to_profile(r)))
    }
    // ... other implementations
}
```

### 2. Value Object Pattern

**Purpose**: Encapsulate domain concepts with validation and behavior.

```rust
// src/domain/value_objects/face_embedding.rs
pub const EMBEDDING_DIMENSION: usize = 128;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FaceEmbedding {
    values: Vec<f32>,
}

impl FaceEmbedding {
    /// Creates a new embedding with validation
    pub fn new(values: Vec<f32>) -> Self {
        assert_eq!(values.len(), EMBEDDING_DIMENSION);
        Self { values }
    }

    /// Calculates cosine distance (0 = identical, 2 = opposite)
    pub fn cosine_distance(&self, other: &FaceEmbedding) -> f32 {
        let dot: f32 = self.values.iter()
            .zip(other.values.iter())
            .map(|(a, b)| a * b)
            .sum();
        
        let norm_a: f32 = self.values.iter().map(|x| x * x).sum::<f32>().sqrt();
        let norm_b: f32 = other.values.iter().map(|x| x * x).sum::<f32>().sqrt();
        
        1.0 - (dot / (norm_a * norm_b))
    }

    /// Serializes to bytes for database storage
    pub fn to_bytes(&self) -> Vec<u8> {
        self.values.iter()
            .flat_map(|v| v.to_le_bytes())
            .collect()
    }

    /// Deserializes from bytes
    pub fn from_bytes(bytes: &[u8]) -> Option<Self> {
        if bytes.len() != EMBEDDING_DIMENSION * 4 {
            return None;
        }
        let values: Vec<f32> = bytes
            .chunks_exact(4)
            .map(|chunk| f32::from_le_bytes(chunk.try_into().unwrap()))
            .collect();
        Some(Self { values })
    }
}
```

### 3. Entity Pattern

**Purpose**: Domain objects with identity and lifecycle.

```rust
// src/domain/entities/profile.rs
#[derive(Debug, Clone)]
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

impl Profile {
    /// Factory method for new profiles
    pub fn new(embedding: FaceEmbedding, thumbnail_path: Option<String>) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::new_v4(),
            name: None,
            classification: ProfileClassification::Unknown,
            embedding,
            thumbnail_path,
            tags: Vec::new(),
            notes: None,
            first_seen_at: now,
            last_seen_at: now,
            sighting_count: 1,
            is_active: true,
            created_at: now,
            updated_at: now,
        }
    }

    /// Domain behavior: record a sighting
    pub fn record_sighting(&mut self) {
        self.sighting_count += 1;
        self.last_seen_at = Utc::now();
        self.updated_at = Utc::now();
    }

    /// Domain behavior: classify profile
    pub fn classify(&mut self, classification: ProfileClassification) {
        self.classification = classification;
        self.updated_at = Utc::now();
    }

    // Getter methods (encapsulation)
    pub fn id(&self) -> Uuid { self.id }
    pub fn name(&self) -> Option<&str> { self.name.as_deref() }
    pub fn classification(&self) -> ProfileClassification { self.classification }
    // ... etc
}
```

### 4. Domain Events Pattern

**Purpose**: Decouple components through event-driven communication.

```rust
// src/domain/events.rs
#[derive(Debug, Clone)]
pub enum DomainEvent {
    FaceDetected(FaceDetectedEvent),
    ProfileCreated(ProfileCreatedEvent),
    ProfileSighted(ProfileSightedEvent),
    ProfileClassified(ProfileClassifiedEvent),
    RecordingStarted(RecordingStartedEvent),
    RecordingStopped(RecordingStoppedEvent),
}

#[derive(Debug, Clone)]
pub struct FaceDetectedEvent {
    pub camera_id: Uuid,
    pub frame_number: u64,
    pub bounding_box: BoundingBox,
    pub confidence: f32,
    pub profile_id: Option<Uuid>,
    pub profile_name: Option<String>,
    pub classification: Option<ProfileClassification>,
    pub timestamp: DateTime<Utc>,
}

// src/application/services/event_bus.rs
pub struct EventBus {
    sender: broadcast::Sender<Arc<DomainEvent>>,
}

impl EventBus {
    pub fn publish(&self, event: DomainEvent) {
        let _ = self.sender.send(Arc::new(event));
    }

    pub fn subscribe(&self) -> EventSubscriber {
        EventSubscriber {
            receiver: self.sender.subscribe(),
        }
    }
}
```

### 5. Use Case Pattern

**Purpose**: Encapsulate application-specific business rules.

```rust
// src/application/use_cases/manage_profiles.rs
pub struct ManageProfilesUseCase {
    profile_repo: Arc<dyn ProfileRepository>,
    face_matcher: Arc<FaceMatcher>,
    event_bus: Arc<EventBus>,
}

impl ManageProfilesUseCase {
    /// Use case: List all profiles with statistics
    pub async fn list_profiles(&self) -> RepoResult<ProfileListResponse> {
        let profiles = self.profile_repo.find_all_active().await?;
        
        let stats = ProfileStats {
            total: profiles.len() as i64,
            trusted: profiles.iter().filter(|p| p.classification() == ProfileClassification::Trusted).count() as i64,
            known: profiles.iter().filter(|p| p.classification() == ProfileClassification::Known).count() as i64,
            unknown: profiles.iter().filter(|p| p.classification() == ProfileClassification::Unknown).count() as i64,
            flagged: profiles.iter().filter(|p| p.classification() == ProfileClassification::Flagged).count() as i64,
            total_sightings: profiles.iter().map(|p| p.sighting_count() as i64).sum(),
        };
        
        Ok(ProfileListResponse { profiles, total: stats.total, stats })
    }

    /// Use case: Classify a profile
    pub async fn classify_profile(
        &self,
        profile_id: Uuid,
        classification: ProfileClassification,
    ) -> RepoResult<Profile> {
        let mut profile = self.profile_repo
            .find_by_id(profile_id)
            .await?
            .ok_or(RepositoryError::NotFound(profile_id.to_string()))?;

        profile.classify(classification);
        self.profile_repo.update(&profile).await?;

        self.event_bus.publish(DomainEvent::ProfileClassified(ProfileClassifiedEvent {
            profile_id,
            classification,
            timestamp: Utc::now(),
        }));

        Ok(profile)
    }
}
```

### 6. Service Layer Pattern

**Purpose**: Orchestrate complex operations across multiple repositories.

```rust
// src/application/services/detection_service.rs
pub struct DetectionService {
    profile_repo: Arc<dyn ProfileRepository>,
    sighting_repo: Arc<dyn SightingRepository>,
    face_matcher: Arc<FaceMatcher>,
    event_bus: Arc<EventBus>,
    config: RwLock<DetectionConfig>,
    sighting_tracker: RwLock<SightingTracker>,
}

impl DetectionService {
    /// Processes a frame with detected faces
    pub async fn process_frame(
        &self,
        frame: &mut FrameDetections,
        snapshot_dir: &str,
    ) -> RepoResult<Vec<Uuid>> {
        let config = self.config.read().await.clone();
        let mut created_profiles = Vec::new();

        // Extract frame metadata before borrowing detections
        let camera_id = frame.camera_id();
        let frame_number = frame.frame_number();
        let frame_data = frame.frame_data().map(|d| d.to_vec());

        // First pass: process each detection
        for detection in frame.detections() {
            if detection.confidence() < config.min_confidence {
                continue;
            }

            let embedding = match detection.embedding() {
                Some(e) => e.clone(),
                None => continue,
            };

            // Try to match against known profiles
            match self.face_matcher.find_match(&embedding).await {
                Some(match_result) => {
                    // Known face - record sighting
                    self.handle_known_face(match_result, camera_id).await?;
                }
                None => {
                    // Unknown face - create new profile
                    let profile = self.create_profile(embedding, detection, &frame_data, snapshot_dir).await?;
                    created_profiles.push(profile.id());
                }
            }
        }

        Ok(created_profiles)
    }
}
```

### 7. Builder Pattern (for complex objects)

```rust
// Example: CameraSettings builder
pub struct CameraSettingsBuilder {
    resolution_width: i32,
    resolution_height: i32,
    fps: i32,
}

impl CameraSettingsBuilder {
    pub fn new() -> Self {
        Self {
            resolution_width: 1280,
            resolution_height: 720,
            fps: 30,
        }
    }

    pub fn resolution(mut self, width: i32, height: i32) -> Self {
        self.resolution_width = width;
        self.resolution_height = height;
        self
    }

    pub fn fps(mut self, fps: i32) -> Self {
        self.fps = fps;
        self
    }

    pub fn build(self) -> CameraSettings {
        CameraSettings {
            resolution_width: self.resolution_width,
            resolution_height: self.resolution_height,
            fps: self.fps,
        }
    }
}
```

---

## Code Examples

### Creating a New Profile via API

```rust
// POST /api/v1/profiles
pub async fn create_profile(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateProfileRequest>,
) -> Result<Json<ProfileResponse>, StatusCode> {
    // 1. Validate embedding
    let embedding = FaceEmbedding::from_bytes(&request.embedding)
        .ok_or(StatusCode::BAD_REQUEST)?;

    // 2. Create domain entity
    let mut profile = Profile::new(embedding, request.thumbnail_path);
    
    // 3. Set optional fields
    if let Some(name) = request.name {
        profile.set_name(name);
    }
    if let Some(classification) = request.classification {
        profile.classify(classification);
    }

    // 4. Persist via repository
    state.profile_repo.save(&profile).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    // 5. Add to face matcher cache
    state.face_matcher.add_to_cache(profile.id(), profile.embedding().clone()).await;

    // 6. Publish domain event
    state.event_bus.publish(DomainEvent::ProfileCreated(ProfileCreatedEvent {
        profile_id: profile.id(),
        thumbnail_path: profile.thumbnail_path().map(String::from),
        camera_id: Uuid::nil(),
        location: None,
        timestamp: Utc::now(),
    }));

    // 7. Return response
    Ok(Json(ProfileResponse::from(profile)))
}
```

### Face Matching Algorithm

```rust
// src/application/services/face_matcher.rs
impl FaceMatcher {
    pub async fn find_match(&self, embedding: &FaceEmbedding) -> Option<MatchResult> {
        let cache = self.embedding_cache.read().await;
        let threshold = *self.threshold.read().await;

        let mut best_match: Option<(Uuid, f32)> = None;

        for (profile_id, cached_embedding) in cache.iter() {
            let distance = embedding.cosine_distance(cached_embedding);
            
            if distance < threshold {
                match best_match {
                    Some((_, best_distance)) if distance < best_distance => {
                        best_match = Some((*profile_id, distance));
                    }
                    None => {
                        best_match = Some((*profile_id, distance));
                    }
                    _ => {}
                }
            }
        }

        best_match.map(|(profile_id, distance)| MatchResult {
            profile_id,
            distance,
            confidence: self.distance_to_confidence(distance, threshold),
        })
    }

    fn distance_to_confidence(&self, distance: f32, threshold: f32) -> f32 {
        // Convert distance to confidence (0.0 - 1.0)
        (1.0 - (distance / threshold)).max(0.0).min(1.0)
    }
}
```

---

## Testing Strategy

### Unit Tests (Domain Layer)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn new_profile_has_unknown_classification() {
        let embedding = FaceEmbedding::new(vec![0.0; 128]);
        let profile = Profile::new(embedding, None);
        
        assert_eq!(profile.classification(), ProfileClassification::Unknown);
    }

    #[test]
    fn record_sighting_increments_count() {
        let embedding = FaceEmbedding::new(vec![0.0; 128]);
        let mut profile = Profile::new(embedding, None);
        
        assert_eq!(profile.sighting_count(), 1);
        profile.record_sighting();
        assert_eq!(profile.sighting_count(), 2);
    }

    #[test]
    fn cosine_distance_of_identical_embeddings_is_zero() {
        let embedding = FaceEmbedding::new(vec![1.0; 128]);
        let distance = embedding.cosine_distance(&embedding);
        
        assert!((distance - 0.0).abs() < 0.0001);
    }
}
```

### Integration Tests (with Mock Repository)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;

    struct MockProfileRepo;

    #[async_trait]
    impl ProfileRepository for MockProfileRepo {
        async fn find_by_id(&self, _id: Uuid) -> RepoResult<Option<Profile>> {
            Ok(None)
        }
        async fn find_all_active(&self) -> RepoResult<Vec<Profile>> {
            Ok(vec![])
        }
        // ... other methods
    }

    #[tokio::test]
    async fn find_match_returns_none_when_empty_cache() {
        let matcher = FaceMatcher::new(Arc::new(MockProfileRepo), 0.6);
        let embedding = FaceEmbedding::new(vec![0.5; 128]);
        
        let result = matcher.find_match(&embedding).await;
        
        assert!(result.is_none());
    }
}
```

---

## Database Design

### Entity-Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  profiles   │       │  sightings  │       │   cameras   │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id (PK)     │◀──────│ profile_id  │       │ id (PK)     │
│ name        │       │ camera_id   │──────▶│ name        │
│ classification│     │ snapshot_path│      │ camera_type │
│ embedding   │       │ confidence  │       │ device_id   │
│ thumbnail   │       │ bbox_*      │       │ status      │
│ tags (JSON) │       │ detected_at │       │ is_enabled  │
│ sighting_cnt│       │ recording_id│──┐    │ settings    │
│ is_active   │       └─────────────┘  │    └─────────────┘
└─────────────┘                        │           │
                                       │           │
┌─────────────┐       ┌─────────────┐  │           │
│  settings   │       │ recordings  │◀─┘           │
├─────────────┤       ├─────────────┤              │
│ id (1)      │       │ id (PK)     │              │
│ config(JSON)│       │ camera_id   │◀─────────────┘
│ updated_at  │       │ file_path   │
└─────────────┘       │ status      │
                      │ started_at  │
                      │ ended_at    │
                      └─────────────┘
```

### Key Indexes

```sql
-- Fast profile lookups
CREATE INDEX idx_profiles_classification ON profiles(classification) WHERE is_active = TRUE;
CREATE INDEX idx_profiles_last_seen ON profiles(last_seen_at DESC) WHERE is_active = TRUE;

-- Fast sighting queries
CREATE INDEX idx_sightings_profile ON sightings(profile_id, detected_at DESC);
CREATE INDEX idx_sightings_camera ON sightings(camera_id, detected_at DESC);
CREATE INDEX idx_sightings_detected_at ON sightings(detected_at DESC);

-- Geospatial queries
CREATE INDEX idx_sightings_location ON sightings(location_lat, location_lon) 
    WHERE location_lat IS NOT NULL;
```

---

## API Design

### RESTful Conventions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/profiles` | List all profiles |
| `GET` | `/api/v1/profiles/:id` | Get single profile |
| `POST` | `/api/v1/profiles` | Create profile |
| `PUT` | `/api/v1/profiles/:id` | Update profile |
| `DELETE` | `/api/v1/profiles/:id` | Delete profile |
| `GET` | `/api/v1/profiles/:id/sightings` | Get profile's sightings |

### Response Format

```json
{
  "profiles": [...],
  "total": 42,
  "stats": {
    "total": 42,
    "trusted": 10,
    "known": 15,
    "unknown": 12,
    "flagged": 5
  }
}
```

### Error Handling

```rust
pub enum ApiError {
    NotFound(String),
    BadRequest(String),
    InternalError(String),
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            ApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
            ApiError::BadRequest(msg) => (StatusCode::BAD_REQUEST, msg),
            ApiError::InternalError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
        };
        
        let body = Json(json!({ "error": message }));
        (status, body).into_response()
    }
}
```

---

## Best Practices Summary

1. **Domain entities are always valid** - Use constructors and methods that enforce invariants
2. **Repositories return domain entities** - Never expose database row types outside infrastructure
3. **Use value objects for complex types** - FaceEmbedding, BoundingBox, GeoLocation
4. **Events for cross-cutting concerns** - WebSocket updates, notifications, logging
5. **Async everywhere** - Use `async_trait` for repository traits
6. **Error handling with Result** - Custom `RepoResult<T>` type alias
7. **Configuration via environment** - `AppConfig::load()` reads from env vars
8. **Test at every layer** - Unit tests for domain, integration tests for services

---

*Document Version: 1.0*
*Last Updated: December 2024*
