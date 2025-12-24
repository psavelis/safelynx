# Safelynx Performance Optimization Roadmap

## Executive Summary

This document outlines the optimization strategy for Safelynx, a face recognition security platform. The roadmap addresses performance bottlenecks, scalability concerns, and provides concrete optimization paths for each system component.

---

## Current Architecture Assessment

### Strengths ✅

1. **Clean Architecture**: Proper separation of Domain, Application, and Infrastructure layers
2. **Async-First Design**: Tokio runtime with efficient async I/O throughout
3. **Memory-Efficient Face Matching**: In-memory embedding cache with cosine similarity
4. **Event-Driven Architecture**: Decoupled components via domain events
5. **Type Safety**: Strong Rust type system with value objects for domain concepts

### Optimization Opportunities 🎯

| Component | Current State | Target State |
|-----------|--------------|--------------|
| Face Detection | Single-threaded rustface | GPU-accelerated batch processing |
| Embedding Extraction | CPU-bound ONNX | CUDA/TensorRT acceleration |
| Database Queries | Runtime-checked SQLx | Connection pooling optimization |
| Frame Processing | Sequential | Parallel pipeline |
| Storage | Filesystem | Object storage + CDN |

---

## Phase 1: Quick Wins (Week 1-2)

### 1.1 Database Connection Pool Tuning

```toml
# Current: Default pool settings
# Target: Optimized for face recognition workload

[database]
max_connections = 20        # Match camera count + headroom
min_connections = 5         # Keep warm connections
max_lifetime = 1800         # 30 min connection recycle
idle_timeout = 300          # 5 min idle cleanup
acquire_timeout = 10        # Fast failure on pool exhaustion
```

**Files to modify:**
- `backend/src/infrastructure/database/mod.rs`
- `backend/src/infrastructure/config.rs`

### 1.2 Embedding Cache Optimization

**Current**: Linear search through all embeddings
**Optimization**: Spatial indexing with HNSW (Hierarchical Navigable Small World)

```rust
// Add to Cargo.toml
instant-distance = "0.6"  // Rust HNSW implementation

// Benefits:
// - O(log n) search vs O(n) linear scan
// - Scales to millions of profiles
// - ~10-100x speedup for 10k+ profiles
```

### 1.3 Frame Processing Pipeline

**Current**: Sequential frame → detect → embed → match
**Optimization**: Parallel pipeline with bounded channels

```rust
// Pipeline stages with backpressure
Frame Capture → [buffer: 4] → Detection → [buffer: 2] → Embedding → [buffer: 8] → Matching
```

---

## Phase 2: GPU Acceleration (Week 3-4)

### 2.1 CUDA-Enabled ONNX Runtime

```toml
# Update Cargo.toml
[dependencies.ort]
version = "2.0.0-rc.10"
features = ["cuda", "tensorrt"]  # Enable GPU providers
```

**Expected speedup**: 5-20x for embedding extraction

### 2.2 Batch Processing

```rust
// Current: One face at a time
async fn extract_embedding(&self, face: &[u8]) -> FaceEmbedding

// Optimized: Batch processing
async fn extract_embeddings_batch(&self, faces: &[&[u8]], batch_size: usize) -> Vec<FaceEmbedding>
```

**Batch size recommendations:**
- CPU: 4-8 faces per batch
- GPU: 32-64 faces per batch
- Memory: ~2MB per face in GPU memory

### 2.3 Model Optimization

1. **Quantization**: FP32 → FP16 → INT8
   - FP16: 50% memory reduction, ~10% speed improvement
   - INT8: 75% memory reduction, ~2x speed improvement

2. **TensorRT Optimization**: Compile-time graph optimization
   - Operator fusion
   - Kernel auto-tuning
   - Dynamic tensor memory allocation

---

## Phase 3: Scalability (Week 5-8)

### 3.1 Horizontal Scaling Architecture

```
                    ┌─────────────────┐
                    │  Load Balancer  │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼───────┐   ┌───────▼───────┐   ┌───────▼───────┐
│  Safelynx #1  │   │  Safelynx #2  │   │  Safelynx #3  │
│  (Cameras 1-5)│   │  (Cameras 6-10)│  │  (Cameras 11+)│
└───────┬───────┘   └───────┬───────┘   └───────┬───────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                    ┌────────▼────────┐
                    │   PostgreSQL    │
                    │   (Primary)     │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │   Read Replicas │
                    └─────────────────┘
```

### 3.2 Embedding Synchronization

**Option A**: Shared Redis cluster for embedding cache
**Option B**: Event-sourced embedding updates via Kafka/NATS
**Option C**: Periodic full sync with incremental updates

```rust
// New trait for distributed embedding store
#[async_trait]
pub trait DistributedEmbeddingStore: Send + Sync {
    async fn get(&self, profile_id: Uuid) -> Option<FaceEmbedding>;
    async fn set(&self, profile_id: Uuid, embedding: FaceEmbedding);
    async fn sync(&self, local_cache: &EmbeddingCache);
    async fn subscribe_updates(&self) -> impl Stream<Item = EmbeddingUpdate>;
}
```

### 3.3 PostgreSQL Optimization

**pgvector Extension**: Native vector similarity search

```sql
-- Enable pgvector
CREATE EXTENSION vector;

-- Modify profiles table
ALTER TABLE profiles 
  ADD COLUMN embedding_vector vector(128);

-- Create HNSW index for fast similarity search
CREATE INDEX ON profiles 
  USING hnsw (embedding_vector vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Fast k-NN query
SELECT id, name, 1 - (embedding_vector <=> $1) as similarity
FROM profiles
WHERE embedding_vector <=> $1 < 0.4  -- threshold
ORDER BY embedding_vector <=> $1
LIMIT 5;
```

---

## Phase 4: Edge Optimization (Week 9-12)

### 4.1 Edge Processing Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Camera    │────▶│ Edge Device │────▶│   Server    │
│             │     │ (Detection) │     │ (Matching)  │
└─────────────┘     └─────────────┘     └─────────────┘

Benefits:
- Reduced bandwidth (only face crops transmitted)
- Lower latency (detection at edge)
- Privacy (full frames never leave premises)
```

### 4.2 Embedded Rust Optimizations

```rust
// Stack-allocated face detection for embedded systems
#[repr(align(64))]  // Cache-line aligned
struct FaceDetectionBuffer {
    faces: [FaceRect; 32],
    count: usize,
}

// SIMD-optimized distance calculation
#[cfg(target_feature = "avx2")]
fn cosine_distance_avx2(a: &[f32; 128], b: &[f32; 128]) -> f32 {
    // AVX2 implementation for 8x speedup
}
```

### 4.3 Model Compilation for Edge

- **ONNX → NCNN**: Mobile/embedded inference
- **ONNX → TFLite**: TPU/Coral acceleration
- **ONNX → OpenVINO**: Intel NCS2 acceleration

---

## Performance Benchmarks & Targets

### Current Baseline (estimated)

| Metric | Single Camera | 10 Cameras |
|--------|---------------|------------|
| Frame Processing | 15 FPS | 5 FPS |
| Detection Latency | 50ms | 200ms |
| Embedding Extraction | 80ms | 400ms |
| Total E2E Latency | 150ms | 700ms |
| Memory Usage | 500MB | 1.5GB |

### Target Performance (Phase 4)

| Metric | Single Camera | 10 Cameras |
|--------|---------------|------------|
| Frame Processing | 30 FPS | 25 FPS |
| Detection Latency | 10ms | 15ms |
| Embedding Extraction | 15ms | 25ms |
| Total E2E Latency | 35ms | 60ms |
| Memory Usage | 300MB | 800MB |

---

## Monitoring & Observability

### Metrics to Track

```rust
// Add to application
use metrics::{counter, gauge, histogram};

// Key performance indicators
histogram!("face_detection_duration_ms", duration);
histogram!("embedding_extraction_duration_ms", duration);
histogram!("face_matching_duration_ms", duration);
counter!("faces_detected_total", 1);
counter!("profiles_matched_total", 1);
gauge!("embedding_cache_size", cache.len() as f64);
gauge!("active_camera_streams", cameras.len() as f64);
```

### Recommended Stack

- **Metrics**: Prometheus + Grafana
- **Tracing**: Jaeger (OpenTelemetry)
- **Logging**: Structured JSON to Loki/Elasticsearch
- **Alerting**: AlertManager with PagerDuty integration

---

## Cost-Benefit Analysis

| Optimization | Effort | Impact | ROI |
|-------------|--------|--------|-----|
| Connection Pool Tuning | 2h | Medium | ⭐⭐⭐⭐⭐ |
| HNSW Embedding Index | 8h | High | ⭐⭐⭐⭐ |
| GPU Acceleration | 16h | Very High | ⭐⭐⭐⭐ |
| Batch Processing | 4h | High | ⭐⭐⭐⭐⭐ |
| pgvector Migration | 8h | High | ⭐⭐⭐⭐ |
| Edge Processing | 40h+ | Very High | ⭐⭐⭐ |

---

## Next Steps

1. **Immediate**: Implement Phase 1 quick wins
2. **Week 2**: Benchmark current performance baseline
3. **Week 3**: Begin GPU acceleration work
4. **Week 5**: Design distributed architecture
5. **Week 9**: Edge deployment pilot

---

## Appendix: Recommended Crates

```toml
# Performance
instant-distance = "0.6"      # HNSW index
rayon = "1.10"                # Parallel iterators
crossbeam = "0.8"             # Lock-free data structures

# GPU
ort = { version = "2.0.0-rc.10", features = ["cuda", "tensorrt"] }

# Monitoring
metrics = "0.22"
metrics-exporter-prometheus = "0.14"
tracing = "0.1"
tracing-opentelemetry = "0.23"

# Networking
quinn = "0.11"                # QUIC protocol for edge
tokio-rustls = "0.25"         # TLS for secure streams

# Database
sqlx = { version = "0.7", features = ["postgres", "runtime-tokio"] }
deadpool-postgres = "0.12"    # Alternative connection pool
```

---

*Document Version: 1.0*
*Last Updated: 2024*
*Author: Safelynx Engineering Team*
