# Safelynx Master Iteration Guide

## Quick Reference

### System Status Check
```bash
# Check all prerequisites
make check-prereqs

# Expected output:
#   Rust:     ✓ 1.94.0-nightly
#   Cargo:    ✓ 1.94.0-nightly
#   Docker:   ✓ 29.0.1
#   Node.js:  ✓ (optional)
#   npm:      ✓ (optional)
```

### Start System
```bash
# 1. Start database
make docker-up

# 2. Run migrations
make migrate

# 3. Run tests
make test-backend

# 4. Start server
make backend-dev
```

### Verify System Working
```bash
# Check all API endpoints
curl http://127.0.0.1:7889/api/v1/profiles
curl http://127.0.0.1:7889/api/v1/cameras
curl http://127.0.0.1:7889/api/v1/settings
curl http://127.0.0.1:7889/api/v1/analytics/dashboard
```

---

## Current Implementation Status

### ✅ Fully Implemented & Tested

| Component | Files | Tests | Status |
|-----------|-------|-------|--------|
| Domain Entities | 6 | 28 | ✅ Complete |
| Value Objects | 4 | 20 | ✅ Complete |
| Repository Traits | 1 | - | ✅ Complete |
| Domain Events | 1 | - | ✅ Complete |
| Application Services | 5 | 15 | ✅ Complete |
| Use Cases | 4 | 7 | ✅ Complete |
| PostgreSQL Repositories | 5 | 1 | ✅ Complete |
| REST API Endpoints | 6 | - | ✅ Complete |
| WebSocket Handler | 1 | - | ✅ Complete |
| Face Detection | 1 | 2 | ✅ Complete |
| Camera Capture | 1 | 2 | ✅ Complete |
| Configuration | 1 | 2 | ✅ Complete |

**Total: 70 tests passing**

### 🔄 Partially Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend React App | Structure only | Needs npm to build |
| GPU Acceleration | Feature flag | Requires CUDA setup |
| RTSP Streaming | Code ready | Needs camera for testing |
| Mobile Push | Not started | iOS app needed |

---

## Development Workflow

### 1. Making Changes to Domain Layer

```bash
# Edit domain entity
vim backend/src/domain/entities/profile.rs

# Run domain tests
cd backend && cargo test domain::

# Expected: All entity/value object tests pass
```

**Key Files**:
- `src/domain/entities/*.rs` - Business entities
- `src/domain/value_objects/*.rs` - Immutable value types
- `src/domain/repositories.rs` - Repository traits
- `src/domain/events.rs` - Domain events

### 2. Making Changes to Application Layer

```bash
# Edit service
vim backend/src/application/services/detection_service.rs

# Run application tests
cd backend && cargo test application::

# Expected: All service/use case tests pass
```

**Key Files**:
- `src/application/services/*.rs` - Application services
- `src/application/use_cases/*.rs` - Use case implementations

### 3. Making Changes to Infrastructure Layer

```bash
# Edit repository implementation
vim backend/src/infrastructure/database/repositories/profile_repository.rs

# Run with database
make docker-up
cd backend && DATABASE_URL="postgres://safelynx:safelynx@localhost:7888/safelynx" cargo test

# Expected: All tests pass including integration
```

**Key Files**:
- `src/infrastructure/database/repositories/*.rs` - PostgreSQL implementations
- `src/infrastructure/server/api/*.rs` - REST endpoints
- `src/infrastructure/camera/*.rs` - Camera integration

### 4. Adding a New Entity

1. **Create entity file**:
```rust
// src/domain/entities/new_entity.rs
#[derive(Debug, Clone)]
pub struct NewEntity {
    id: Uuid,
    // fields...
}

impl NewEntity {
    pub fn new(/* params */) -> Self { /* ... */ }
    // getters and domain behavior
}
```

2. **Add to module**:
```rust
// src/domain/entities/mod.rs
mod new_entity;
pub use new_entity::NewEntity;
```

3. **Create repository trait**:
```rust
// src/domain/repositories.rs
#[async_trait]
pub trait NewEntityRepository: Send + Sync {
    async fn find_by_id(&self, id: Uuid) -> RepoResult<Option<NewEntity>>;
    async fn save(&self, entity: &NewEntity) -> RepoResult<()>;
}
```

4. **Create database model**:
```rust
// src/infrastructure/database/models.rs
#[derive(FromRow)]
pub struct NewEntityRow {
    pub id: Uuid,
    // fields...
}
```

5. **Implement repository**:
```rust
// src/infrastructure/database/repositories/new_entity_repository.rs
pub struct PgNewEntityRepository {
    pool: PgPool,
}

#[async_trait]
impl NewEntityRepository for PgNewEntityRepository {
    // implementations...
}
```

6. **Add migration**:
```sql
-- migrations/002_new_entity.sql
CREATE TABLE new_entities (
    id UUID PRIMARY KEY,
    -- columns...
);
```

### 5. Adding a New API Endpoint

1. **Create handler**:
```rust
// src/infrastructure/server/api/new_endpoint.rs
pub async fn get_new_entity(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<NewEntityResponse>, StatusCode> {
    let entity = state.new_entity_repo
        .find_by_id(id)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?;
    
    Ok(Json(NewEntityResponse::from(entity)))
}
```

2. **Register route**:
```rust
// src/infrastructure/server/mod.rs
.route("/api/v1/new-entities/:id", get(api::new_endpoint::get_new_entity))
```

---

## Testing Strategies

### Unit Tests (Fast, No Dependencies)

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_entity_behavior() {
        let entity = Entity::new(/* params */);
        entity.do_something();
        assert_eq!(entity.state(), expected);
    }
}
```

Run: `cargo test --lib`

### Integration Tests (With Mock)

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;

    struct MockRepository;

    #[async_trait]
    impl Repository for MockRepository {
        async fn find_by_id(&self, _: Uuid) -> RepoResult<Option<Entity>> {
            Ok(Some(Entity::new(/* */)))
        }
    }

    #[tokio::test]
    async fn test_service_with_mock() {
        let service = Service::new(Arc::new(MockRepository));
        let result = service.do_work().await;
        assert!(result.is_ok());
    }
}
```

### Database Tests (Requires PostgreSQL)

```rust
#[cfg(test)]
mod tests {
    #[tokio::test]
    #[ignore] // Run with: cargo test -- --ignored
    async fn test_with_real_database() {
        let pool = create_test_pool().await;
        let repo = PgRepository::new(pool);
        // test with real database
    }
}
```

Run: `DATABASE_URL="..." cargo test -- --ignored`

---

## Debugging Guide

### Common Issues

#### 1. Database Connection Failed
```
Error: error communicating with database
```
**Solution**:
```bash
# Check if PostgreSQL is running
docker ps | grep safelynx-postgres

# If not running:
make docker-up

# Check connection manually:
docker exec safelynx-postgres psql -U safelynx -d safelynx -c "SELECT 1"
```

#### 2. Missing Tables
```
Error: relation "profiles" does not exist
```
**Solution**:
```bash
# Run migrations
make migrate

# Or manually:
cd backend && DATABASE_URL="postgres://safelynx:safelynx@localhost:7888/safelynx" cargo run --bin migrate
```

#### 3. Port Already in Use
```
Error: Address already in use (os error 48)
```
**Solution**:
```bash
# Find and kill process
lsof -i :7889 | grep LISTEN
kill -9 <PID>

# Or stop all:
make down
```

#### 4. Camera Not Found
```
Error: No cameras found
```
**Solution**:
- Check System Preferences > Security & Privacy > Camera
- Grant permission to Terminal/IDE
- Try USB camera index 0, 1, 2...

---

## Performance Benchmarks

### Current Baseline (M1 MacBook)

| Operation | Time | Notes |
|-----------|------|-------|
| Face detection | ~30ms | Per 720p frame |
| Embedding extraction | ~50ms | Per face (CPU) |
| Database query | ~2ms | Simple SELECT |
| API response | ~10ms | P50 latency |
| Full E2E | ~100ms | Detection to WebSocket |

### Target Performance

| Operation | Target | Optimization |
|-----------|--------|--------------|
| Face detection | <10ms | GPU/Metal |
| Embedding extraction | <5ms | TensorRT |
| Matching | <1ms | HNSW index |
| Full E2E | <30ms | Pipeline parallelism |

---

## Release Checklist

### Before Release

- [ ] All tests passing: `make test-backend`
- [ ] No compiler warnings: `cargo clippy`
- [ ] Code formatted: `cargo fmt`
- [ ] Release build works: `make backend-build`
- [ ] Database migrations tested
- [ ] API endpoints verified
- [ ] Documentation updated

### Release Commands

```bash
# Clean build
make clean

# Run full test suite
make test

# Build release
make build

# Create tag
git tag -a v1.0.0 -m "Release 1.0.0"
git push origin v1.0.0
```

---

## Quick API Reference

### Profiles
```bash
# List all profiles
curl http://localhost:7889/api/v1/profiles

# Get single profile
curl http://localhost:7889/api/v1/profiles/{id}

# Update profile
curl -X PUT http://localhost:7889/api/v1/profiles/{id} \
  -H "Content-Type: application/json" \
  -d '{"name": "John", "classification": "known"}'

# Delete profile
curl -X DELETE http://localhost:7889/api/v1/profiles/{id}
```

### Cameras
```bash
# List cameras
curl http://localhost:7889/api/v1/cameras

# Add camera
curl -X POST http://localhost:7889/api/v1/cameras \
  -H "Content-Type: application/json" \
  -d '{"name": "Front Door", "camera_type": "usb", "device_id": "0"}'

# Start streaming
curl -X POST http://localhost:7889/api/v1/cameras/{id}/start

# Stop streaming
curl -X POST http://localhost:7889/api/v1/cameras/{id}/stop
```

### Analytics
```bash
# Dashboard stats
curl http://localhost:7889/api/v1/analytics/dashboard

# Activity timeline
curl "http://localhost:7889/api/v1/analytics/timeline?hours=24"

# Heatmap data
curl http://localhost:7889/api/v1/analytics/heatmap

# Storage stats
curl http://localhost:7889/api/v1/analytics/storage
```

### Settings
```bash
# Get settings
curl http://localhost:7889/api/v1/settings

# Update settings
curl -X PUT http://localhost:7889/api/v1/settings \
  -H "Content-Type: application/json" \
  -d '{"detection": {"min_confidence": 0.8}}'
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgres://safelynx:safelynx@localhost:7888/safelynx` | PostgreSQL connection |
| `HOST` | `127.0.0.1` | Server bind address |
| `PORT` | `7889` | Server port |
| `RUST_LOG` | `info` | Log level |
| `DATA_DIR` | `~/Documents/Safelynx` | Storage directory |
| `CORS_ORIGIN` | `http://localhost:7900` | Frontend URL |

---

## Useful Commands

```bash
# View database tables
docker exec safelynx-postgres psql -U safelynx -d safelynx -c "\dt"

# View table data
docker exec safelynx-postgres psql -U safelynx -d safelynx -c "SELECT * FROM profiles"

# Watch logs
RUST_LOG=debug cargo run

# Profile performance
cargo build --release
./target/release/safelynx-backend

# Generate documentation
cargo doc --open
```

---

*Guide Version: 1.0*
*Last Updated: December 2024*
