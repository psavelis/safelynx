export interface Profile {
  id: string
  name: string | null
  display_name: string
  classification: 'known' | 'unknown' | 'flagged' | 'trusted'
  notes: string | null
  tags: string[]
  thumbnail_url: string | null
  sighting_count: number
  first_seen_at: string
  last_seen_at: string
  is_active: boolean
}

export interface Camera {
  id: string
  name: string
  camera_type: 'builtin' | 'usb' | 'rtsp' | 'browser'
  device_id: string
  rtsp_url: string | null
  status: 'active' | 'inactive' | 'error'
  streaming?: boolean // Computed from status
  resolution: {
    width: number
    height: number
  }
  width?: number // Flattened for convenience
  height?: number
  fps: number
  is_enabled: boolean
  location: GeoLocation | null
  last_frame_at: string | null
  created_at: string
}

export interface GeoLocation {
  latitude: number
  longitude: number
  name: string | null
}

export interface Sighting {
  id: string
  profile_id: string
  camera_id: string
  confidence: number
  bounding_box: BoundingBox
  snapshot_path: string | null
  detected_at: string
  created_at: string
}

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface Recording {
  id: string
  camera_id: string
  file_path: string
  started_at: string
  ended_at: string | null
  trigger_type: 'motion' | 'face' | 'scheduled' | 'manual'
  status: 'recording' | 'completed' | 'error'
  file_size_bytes: number | null
  duration_secs: number | null
  created_at: string
}

export interface Settings {
  detection: DetectionSettings
  recording: RecordingSettings
  notification: NotificationSettings
  display: DisplaySettings
}

export interface DetectionSettings {
  min_confidence: number
  match_threshold: number
  sighting_cooldown_secs: number
  motion_detection_enabled: boolean
  motion_sensitivity: number
}

export interface RecordingSettings {
  detection_triggered: boolean
  pre_trigger_buffer_secs: number
  post_trigger_buffer_secs: number
  max_segment_duration_secs: number
  max_storage_bytes: number
  max_storage_human: string
  auto_cleanup_enabled: boolean
}

export interface NotificationSettings {
  desktop_notifications: boolean
  notify_new_profile: boolean
  notify_flagged: boolean
  notify_unknown: boolean
}

export interface DisplaySettings {
  show_bounding_boxes: boolean
  show_confidence: boolean
  show_names: boolean
  dark_mode: boolean
}

export interface DashboardStats {
  total_profiles: number
  known_profiles: number
  unknown_profiles: number
  flagged_profiles: number
  total_sightings_today: number
  total_sightings_week: number
  active_cameras: number
  recording_active: boolean
  storage_used_bytes: number
  storage_used_human: string
  storage_total_bytes: number
  storage_percent_used: number
}

export interface TimelineEntry {
  timestamp: string
  event_type: string
  profile_id: string | null
  profile_name: string | null
  camera_id: string
  camera_name: string
  thumbnail_url: string | null
}

export interface ActivityChart {
  labels: string[]
  datasets: {
    label: string
    data: number[]
    color: string
  }[]
}

export interface StorageStats {
  total_bytes: number
  used_bytes: number
  available_bytes: number
  recordings_count: number
  recordings_bytes: number
  snapshots_count: number
  snapshots_bytes: number
  breakdown_by_camera: {
    camera_id: string
    camera_name: string
    bytes_used: number
    recordings_count: number
  }[]
}

export interface WsMessage {
  type: string
  payload?: unknown
}

export interface FaceDetectedPayload {
  camera_id: string
  camera_name: string
  profile_id: string | null
  profile_name: string | null
  confidence: number
  bounding_box: BoundingBox
  timestamp: string
  landmarks?: { x: number; y: number }[]
}
