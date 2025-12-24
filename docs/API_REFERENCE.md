# Safelynx API Reference

## Base URL

```
http://localhost:7889/api/v1
```

## Authentication

Currently no authentication required. Future versions will implement JWT.

---

## Profiles

### List All Profiles

```http
GET /profiles
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `classification` | string | Filter by: trusted, known, unknown, flagged |
| `limit` | integer | Max results (default: 100) |
| `offset` | integer | Pagination offset |

**Response** `200 OK`:
```json
{
  "profiles": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "John Smith",
      "classification": "known",
      "thumbnail_path": "/snapshots/550e8400.jpg",
      "tags": ["family", "resident"],
      "notes": "Lives in apartment 3B",
      "first_seen_at": "2024-12-01T10:30:00Z",
      "last_seen_at": "2024-12-24T08:15:00Z",
      "sighting_count": 142,
      "is_active": true,
      "created_at": "2024-12-01T10:30:00Z",
      "updated_at": "2024-12-24T08:15:00Z"
    }
  ],
  "total": 42,
  "stats": {
    "total": 42,
    "trusted": 5,
    "known": 20,
    "unknown": 15,
    "flagged": 2,
    "total_sightings": 1250
  }
}
```

### Get Single Profile

```http
GET /profiles/:id
```

**Response** `200 OK`:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Smith",
  "classification": "known",
  "thumbnail_path": "/snapshots/550e8400.jpg",
  "tags": ["family", "resident"],
  "notes": "Lives in apartment 3B",
  "first_seen_at": "2024-12-01T10:30:00Z",
  "last_seen_at": "2024-12-24T08:15:00Z",
  "sighting_count": 142,
  "is_active": true
}
```

**Response** `404 Not Found`:
```json
{
  "error": "Profile not found"
}
```

### Create Profile

```http
POST /profiles
```

**Request Body**:
```json
{
  "embedding": "base64-encoded-512-bytes",
  "name": "John Smith",
  "classification": "known",
  "thumbnail_path": "/snapshots/new.jpg",
  "tags": ["family"]
}
```

**Response** `201 Created`:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Smith",
  "classification": "known",
  "thumbnail_path": "/snapshots/new.jpg",
  "tags": ["family"],
  "sighting_count": 1,
  "created_at": "2024-12-24T10:00:00Z"
}
```

### Update Profile

```http
PUT /profiles/:id
```

**Request Body**:
```json
{
  "name": "John Smith Jr.",
  "classification": "trusted",
  "tags": ["family", "vip"],
  "notes": "Updated notes"
}
```

**Response** `200 OK`:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "John Smith Jr.",
  "classification": "trusted",
  "tags": ["family", "vip"],
  "updated_at": "2024-12-24T10:30:00Z"
}
```

### Delete Profile

```http
DELETE /profiles/:id
```

**Response** `204 No Content`

### Get Profile Sightings

```http
GET /profiles/:id/sightings
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | integer | Max results (default: 50) |
| `offset` | integer | Pagination offset |
| `start_date` | ISO8601 | Filter from date |
| `end_date` | ISO8601 | Filter to date |

**Response** `200 OK`:
```json
{
  "sightings": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "profile_id": "550e8400-e29b-41d4-a716-446655440000",
      "camera_id": "770e8400-e29b-41d4-a716-446655440002",
      "camera_name": "Front Door",
      "confidence": 0.95,
      "bounding_box": {
        "x": 100,
        "y": 50,
        "width": 200,
        "height": 200
      },
      "snapshot_path": "/snapshots/660e8400.jpg",
      "location": {
        "latitude": 37.7749,
        "longitude": -122.4194,
        "name": "San Francisco, CA"
      },
      "detected_at": "2024-12-24T08:15:00Z"
    }
  ],
  "total": 142
}
```

---

## Cameras

### List All Cameras

```http
GET /cameras
```

**Response** `200 OK`:
```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "name": "Front Door",
    "camera_type": "usb",
    "device_id": "0",
    "rtsp_url": null,
    "location": "Main Entrance",
    "status": "active",
    "resolution": {
      "width": 1280,
      "height": 720
    },
    "fps": 30,
    "is_enabled": true,
    "last_frame_at": "2024-12-24T10:30:00Z",
    "created_at": "2024-12-01T09:00:00Z"
  }
]
```

### Get Single Camera

```http
GET /cameras/:id
```

**Response** `200 OK`:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "name": "Front Door",
  "camera_type": "usb",
  "device_id": "0",
  "status": "active",
  "resolution": {
    "width": 1280,
    "height": 720
  },
  "fps": 30,
  "is_enabled": true
}
```

### Add Camera

```http
POST /cameras
```

**Request Body**:
```json
{
  "name": "Back Door",
  "camera_type": "usb",
  "device_id": "1",
  "location": "Kitchen"
}
```

For RTSP camera:
```json
{
  "name": "IP Camera",
  "camera_type": "rtsp",
  "device_id": "rtsp://192.168.1.100:554/stream",
  "location": "Garage"
}
```

**Response** `201 Created`:
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "name": "Back Door",
  "camera_type": "usb",
  "device_id": "1",
  "status": "inactive",
  "is_enabled": true,
  "created_at": "2024-12-24T10:00:00Z"
}
```

### Update Camera

```http
PUT /cameras/:id
```

**Request Body**:
```json
{
  "name": "Updated Name",
  "location": "New Location",
  "resolution_width": 1920,
  "resolution_height": 1080,
  "fps": 15,
  "is_enabled": true
}
```

**Response** `200 OK`

### Delete Camera

```http
DELETE /cameras/:id
```

**Response** `204 No Content`

### Start Camera Streaming

```http
POST /cameras/:id/start
```

**Response** `200 OK`:
```json
{
  "message": "Camera streaming started",
  "camera_id": "770e8400-e29b-41d4-a716-446655440002",
  "status": "active"
}
```

### Stop Camera Streaming

```http
POST /cameras/:id/stop
```

**Response** `200 OK`:
```json
{
  "message": "Camera streaming stopped",
  "camera_id": "770e8400-e29b-41d4-a716-446655440002",
  "status": "inactive"
}
```

---

## Sightings

### List Sightings

```http
GET /sightings
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `profile_id` | UUID | Filter by profile |
| `camera_id` | UUID | Filter by camera |
| `start_date` | ISO8601 | From date |
| `end_date` | ISO8601 | To date |
| `limit` | integer | Max results (default: 100) |
| `offset` | integer | Pagination offset |

**Response** `200 OK`:
```json
{
  "sightings": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440004",
      "profile_id": "550e8400-e29b-41d4-a716-446655440000",
      "profile_name": "John Smith",
      "camera_id": "770e8400-e29b-41d4-a716-446655440002",
      "camera_name": "Front Door",
      "confidence": 0.95,
      "snapshot_path": "/snapshots/990e8400.jpg",
      "detected_at": "2024-12-24T08:15:00Z"
    }
  ],
  "total": 500
}
```

### Get Single Sighting

```http
GET /sightings/:id
```

**Response** `200 OK`:
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "profile_id": "550e8400-e29b-41d4-a716-446655440000",
  "camera_id": "770e8400-e29b-41d4-a716-446655440002",
  "confidence": 0.95,
  "bounding_box": {
    "x": 100,
    "y": 50,
    "width": 200,
    "height": 200
  },
  "snapshot_path": "/snapshots/990e8400.jpg",
  "location": {
    "latitude": 37.7749,
    "longitude": -122.4194
  },
  "recording_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "recording_timestamp_ms": 15000,
  "detected_at": "2024-12-24T08:15:00Z"
}
```

---

## Recordings

### List Recordings

```http
GET /recordings
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `camera_id` | UUID | Filter by camera |
| `status` | string | Filter by: recording, completed, interrupted |
| `has_detections` | boolean | Filter by detection presence |
| `limit` | integer | Max results (default: 50) |

**Response** `200 OK`:
```json
{
  "recordings": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440005",
      "camera_id": "770e8400-e29b-41d4-a716-446655440002",
      "camera_name": "Front Door",
      "file_path": "/recordings/2024-12-24/front-door-081500.mp4",
      "file_size_bytes": 52428800,
      "file_size_human": "50 MB",
      "duration_ms": 300000,
      "duration_human": "5:00",
      "frame_count": 9000,
      "status": "completed",
      "has_detections": true,
      "started_at": "2024-12-24T08:15:00Z",
      "ended_at": "2024-12-24T08:20:00Z"
    }
  ],
  "total": 25
}
```

### Get Single Recording

```http
GET /recordings/:id
```

### Delete Recording

```http
DELETE /recordings/:id
```

**Response** `204 No Content`

---

## Settings

### Get Settings

```http
GET /settings
```

**Response** `200 OK`:
```json
{
  "detection": {
    "min_confidence": 0.7,
    "match_threshold": 0.6,
    "sighting_cooldown_secs": 30,
    "motion_detection_enabled": true,
    "motion_sensitivity": 0.3
  },
  "recording": {
    "detection_triggered": true,
    "pre_trigger_buffer_secs": 5,
    "post_trigger_buffer_secs": 10,
    "max_segment_duration_secs": 300,
    "max_storage_bytes": 107374182400,
    "max_storage_human": "100 GB",
    "auto_cleanup_enabled": true
  },
  "notification": {
    "desktop_notifications": true,
    "notify_new_profile": true,
    "notify_flagged": true,
    "notify_unknown": false
  },
  "display": {
    "show_bounding_boxes": true,
    "show_confidence": true,
    "show_names": true,
    "dark_mode": true
  }
}
```

### Update Settings

```http
PUT /settings
```

**Request Body** (partial update supported):
```json
{
  "detection": {
    "min_confidence": 0.8,
    "match_threshold": 0.5
  },
  "recording": {
    "detection_triggered": false
  }
}
```

**Response** `200 OK`: Returns updated settings

---

## Analytics

### Dashboard Statistics

```http
GET /analytics/dashboard
```

**Response** `200 OK`:
```json
{
  "total_profiles": 42,
  "known_profiles": 25,
  "unknown_profiles": 15,
  "flagged_profiles": 2,
  "total_sightings_today": 156,
  "total_sightings_week": 1024,
  "active_cameras": 3,
  "recording_active": true,
  "storage_used_bytes": 52428800000,
  "storage_used_human": "48.83 GB",
  "storage_total_bytes": 107374182400,
  "storage_percent_used": 48.83
}
```

### Activity Timeline

```http
GET /analytics/timeline
```

**Query Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `hours` | integer | Last N hours (default: 24) |
| `profile_id` | UUID | Filter by profile |
| `camera_id` | UUID | Filter by camera |
| `classification` | string | Filter by classification |

**Response** `200 OK`:
```json
{
  "events": [
    {
      "timestamp": "2024-12-24T10:30:00Z",
      "type": "face_detected",
      "profile_id": "550e8400-e29b-41d4-a716-446655440000",
      "profile_name": "John Smith",
      "camera_id": "770e8400-e29b-41d4-a716-446655440002",
      "camera_name": "Front Door",
      "classification": "known",
      "confidence": 0.95,
      "snapshot_url": "/snapshots/abc123.jpg"
    }
  ],
  "total": 156
}
```

### Activity Heatmap

```http
GET /analytics/heatmap
```

**Response** `200 OK`:
```json
{
  "data": [
    {
      "hour": 0,
      "day": 0,
      "count": 5
    },
    {
      "hour": 1,
      "day": 0,
      "count": 2
    }
  ],
  "max_count": 45,
  "period": {
    "start": "2024-12-17T00:00:00Z",
    "end": "2024-12-24T23:59:59Z"
  }
}
```

### Storage Statistics

```http
GET /analytics/storage
```

**Response** `200 OK`:
```json
{
  "total_bytes": 107374182400,
  "used_bytes": 52428800000,
  "available_bytes": 54945382400,
  "percent_used": 48.83,
  "breakdown": {
    "recordings_bytes": 45000000000,
    "recordings_human": "41.91 GB",
    "recordings_count": 150,
    "snapshots_bytes": 7428800000,
    "snapshots_human": "6.92 GB",
    "snapshots_count": 5000
  },
  "oldest_recording": "2024-11-24T10:00:00Z",
  "auto_cleanup_enabled": true,
  "cleanup_target_percent": 80
}
```

---

## WebSocket

### Connection

```
ws://localhost:7889/api/v1/ws
```

### Events (Server → Client)

#### FaceDetected
```json
{
  "type": "FaceDetected",
  "payload": {
    "camera_id": "770e8400-e29b-41d4-a716-446655440002",
    "camera_name": "Front Door",
    "profile_id": "550e8400-e29b-41d4-a716-446655440000",
    "profile_name": "John Smith",
    "confidence": 0.95,
    "bounding_box": {
      "x": 100,
      "y": 50,
      "width": 200,
      "height": 200
    },
    "timestamp": "2024-12-24T10:30:00Z"
  }
}
```

#### NewSighting
```json
{
  "type": "NewSighting",
  "payload": {
    "id": "990e8400-e29b-41d4-a716-446655440004",
    "profile_id": "550e8400-e29b-41d4-a716-446655440000",
    "profile_name": "John Smith",
    "camera_id": "770e8400-e29b-41d4-a716-446655440002",
    "camera_name": "Front Door",
    "confidence": 0.95,
    "detected_at": "2024-12-24T10:30:00Z",
    "snapshot_url": "/snapshots/990e8400.jpg"
  }
}
```

#### NewProfile
```json
{
  "type": "NewProfile",
  "payload": {
    "id": "bb0e8400-e29b-41d4-a716-446655440006",
    "name": null,
    "classification": "unknown",
    "tags": [],
    "sightings_count": 1
  }
}
```

#### CameraStatusChanged
```json
{
  "type": "CameraStatusChanged",
  "payload": {
    "camera_id": "770e8400-e29b-41d4-a716-446655440002",
    "camera_name": "Front Door",
    "status": "active",
    "streaming": true
  }
}
```

#### RecordingStarted
```json
{
  "type": "RecordingStarted",
  "payload": {
    "id": "cc0e8400-e29b-41d4-a716-446655440007",
    "camera_id": "770e8400-e29b-41d4-a716-446655440002",
    "camera_name": "Front Door",
    "started_at": "2024-12-24T10:30:00Z",
    "reason": "detection"
  }
}
```

#### StorageWarning
```json
{
  "type": "StorageWarning",
  "payload": {
    "percent_used": 92.5,
    "bytes_used": 99321274368,
    "bytes_total": 107374182400,
    "message": "Storage is 92.5% full. Auto-cleanup will start at 95%."
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| `200` | Success |
| `201` | Created |
| `204` | No Content (successful delete) |
| `400` | Bad Request (invalid input) |
| `404` | Not Found |
| `409` | Conflict (duplicate resource) |
| `500` | Internal Server Error |

---

## Rate Limiting

Currently no rate limiting implemented. Future versions will add:
- 100 requests/second per IP
- 1000 requests/minute per IP
- WebSocket: 10 messages/second

---

*API Version: 1.0*
*Last Updated: December 2024*
