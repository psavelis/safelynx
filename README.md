# 🦁 Safelynx

**Face Recognition Security for macOS**

Safelynx is a face recognition security system designed for residential and small business use. It runs on macOS (optimized for M1/M4 chips) and provides real-time face detection, profile management, and automated recording capabilities.

![Safelynx Dashboard](docs/dashboard-preview.png)

## ✨ Features

- **Real-time Face Detection** - Continuous monitoring with instant face detection using pure Rust implementation
- **Profile Management** - Automatically group detected faces into profiles with classification (Known/Unknown/Flagged)
- **Multi-Camera Support** - Connect multiple cameras including MacBook built-in, USB, and RTSP streams
- **Detection-Triggered Recording** - Automatically record video when faces are detected
- **Dark Mode UI** - React frontend with minimal design
- **Real-time Dashboard** - Activity charts, storage stats, and live camera feeds
- **Timeline View** - Chronological view of all detections with filtering
- **Heatmap Analytics** - Visualize detection patterns across your space
- **100GB Rotating Storage** - Automatic cleanup of old recordings
- **Multi-Instance Sync** - Sync profiles and settings across multiple Mac devices
- **Configurable Thresholds** - Adjust detection sensitivity and match confidence

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            Safelynx Architecture                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────┐     ┌─────────────────────┐     ┌─────────────────┐  │
│   │   Frontend  │────▶│   Rust Backend      │────▶│   PostgreSQL    │  │
│   │   (React)   │◀────│   (Axum + Tokio)    │◀────│   Database      │  │
│   │  Port 7900  │     │     Port 7889       │     │    Port 7888    │  │
│   └─────────────┘     └─────────────────────┘     └─────────────────┘  │
│         │                      │                           │           │
│         │  WebSocket           │                           │           │
│         └──────────────────────┘                           │           │
│                                                            │           │
│   ┌─────────────────────────────────────────────────────────┘           │
│   │                                                                     │
│   │   ┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐  │
│   │   │   Camera    │     │  Face Detector  │     │   Recording     │  │
│   │   │   Capture   │────▶│  (rustface +    │────▶│   Manager       │  │
│   │   │  (nokhwa)   │     │   ONNX)         │     │                 │  │
│   │   └─────────────┘     └─────────────────┘     └─────────────────┘  │
│   │                                                                     │
│   └─────────────────────────────────────────────────────────────────────┘
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- macOS 12+ (Apple Silicon recommended)
- Docker Desktop
- Rust (latest stable)
- Node.js 18+

### Installation

```bash
# Clone the repository
git clone https://github.com/psavelis/safelynx.git
cd safelynx

# Setup (installs dependencies)
make setup

# Start everything
make up
```

Open http://localhost:7900 to access the dashboard.

### Development Mode

```bash
# Start with hot reload
make dev
```

## 📦 Tech Stack

### Backend (Rust)
- **Axum** - Fast async web framework
- **SQLx** - Compile-time verified SQL queries
- **Tokio** - Async runtime
- **rustface** - Pure Rust face detection
- **ONNX Runtime** - Face embedding generation
- **nokhwa** - Camera capture for macOS

### Frontend (React)
- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Chart.js** - Analytics charts
- **Framer Motion** - Animations
- **Zustand** - State management

### Infrastructure
- **PostgreSQL 16** - Database
- **Docker** - Containerization

## 📁 Project Structure

```
safelynx/
├── backend/
│   ├── src/
│   │   ├── domain/           # Entities, value objects, events
│   │   ├── application/      # Use cases, services
│   │   └── infrastructure/   # Database, camera, HTTP server
│   ├── migrations/           # SQL migrations
│   └── Cargo.toml
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   ├── pages/            # Page components
│   │   ├── api/              # API client
│   │   ├── hooks/            # Custom React hooks
│   │   ├── store/            # Zustand state
│   │   └── types/            # TypeScript types
│   └── package.json
├── docker/
│   ├── docker-compose.yml
│   └── init.sql
└── Makefile
```

## 🔧 Configuration

### Environment Variables

```bash
# Backend
DATABASE_URL=postgres://safelynx:safelynx@localhost:7888/safelynx
HOST=127.0.0.1
PORT=7889
DATA_DIR=~/Documents/Safelynx
RUST_LOG=info

# Frontend (via Vite proxy)
# API and WebSocket automatically proxied to backend
```

### Settings (via UI)

- **Detection Settings**
  - Minimum confidence threshold (0.1-1.0)
  - Match threshold for profile matching
  - Sighting cooldown period
  - Motion detection toggle

- **Recording Settings**
  - Detection-triggered recording toggle
  - Pre/post trigger buffer duration
  - Maximum storage limit
  - Auto-cleanup when full

- **Notification Settings**
  - Desktop notifications
  - Alert types (new profile, flagged, unknown)

- **Display Settings**
  - Show bounding boxes
  - Show confidence percentages
  - Show profile names
  - Dark/light mode

## 🔌 API Reference

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/profiles` | List all profiles |
| GET | `/api/v1/profiles/:id` | Get profile details |
| PUT | `/api/v1/profiles/:id` | Update profile |
| DELETE | `/api/v1/profiles/:id` | Delete profile |
| GET | `/api/v1/cameras` | List cameras |
| POST | `/api/v1/cameras` | Add camera |
| POST | `/api/v1/cameras/:id/stream/start` | Start streaming |
| POST | `/api/v1/cameras/:id/stream/stop` | Stop streaming |
| GET | `/api/v1/sightings` | List sightings |
| GET | `/api/v1/recordings` | List recordings |
| GET | `/api/v1/settings` | Get settings |
| PUT | `/api/v1/settings` | Update settings |
| GET | `/api/v1/analytics/dashboard` | Dashboard stats |
| GET | `/api/v1/analytics/timeline` | Timeline events |
| GET | `/api/v1/analytics/heatmap` | Heatmap data |

### WebSocket

Connect to `/ws` for real-time events:

```typescript
// Event types
type WsMessage = 
  | { type: 'FaceDetected', payload: FaceDetectedPayload }
  | { type: 'NewSighting', payload: SightingPayload }
  | { type: 'NewProfile', payload: ProfilePayload }
  | { type: 'RecordingStarted', payload: RecordingPayload }
  | { type: 'RecordingStopped', payload: RecordingPayload }
  | { type: 'StorageWarning', payload: StorageWarningPayload }
```

## 🎨 Screenshots

### Dashboard
Real-time overview with activity charts, storage usage, and quick actions.

### Cameras
Live camera feeds with face detection overlays.

### Profiles
Grid view of all detected faces with classification badges.

### Timeline
Chronological list of all detection events.

### Settings
All detection, recording, and display options.

## 📊 Data Storage

All data is stored in `~/Documents/Safelynx/`:

```
~/Documents/Safelynx/
├── recordings/     # Video recordings
├── snapshots/      # Face snapshots
├── db/             # PostgreSQL data volume
└── logs/           # Application logs
```

## 🛡️ Security Considerations

- Local-only access by default (127.0.0.1)
- No authentication required (designed for single-user home use)
- All data stored locally
- No cloud connectivity
- Recordings encrypted at rest (macOS FileVault)

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- [rustface](https://github.com/nicholassm/rustface) - Rust face detection
- [nokhwa](https://github.com/l1npengtul/nokhwa) - Camera capture
- [Axum](https://github.com/tokio-rs/axum) - Web framework
- [Tailwind CSS](https://tailwindcss.com/) - Styling

## License

MIT License - see [LICENSE](LICENSE) for details.
