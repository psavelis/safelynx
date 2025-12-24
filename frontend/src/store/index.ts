import { create } from 'zustand'
import type { Profile, Camera, Settings, DashboardStats, FaceDetectedPayload } from '@/types'

interface PaginationState {
  pageSize: number
  setPageSize: (size: number) => void
}

// Camera tracking info
interface CameraStreamInfo {
  cameraId: string
  cameraName: string
  source: 'device' | 'browser'
  isRecording: boolean
  startedAt: Date
  location?: {
    latitude: number
    longitude: number
    name?: string
  }
}

// Browser camera tracking (client-side only)
interface CameraTrackingState {
  activeBrowserCameras: Set<string> // camera IDs registered via browser
  streamingCameras: Map<string, CameraStreamInfo> // All actively streaming cameras
  addBrowserCamera: (cameraId: string) => void
  removeBrowserCamera: (cameraId: string) => void
  addStreamingCamera: (info: CameraStreamInfo) => void
  removeStreamingCamera: (cameraId: string) => void
  updateStreamingCamera: (cameraId: string, updates: Partial<CameraStreamInfo>) => void
}

interface AppState extends PaginationState, CameraTrackingState {
  profiles: Profile[]
  cameras: Camera[]
  settings: Settings | null
  dashboardStats: DashboardStats | null
  activeDetections: Map<string, FaceDetectedPayload>
  wsConnected: boolean
  
  setProfiles: (profiles: Profile[]) => void
  setProfile: (profile: Profile) => void
  removeProfile: (id: string) => void
  
  setCameras: (cameras: Camera[]) => void
  setCamera: (camera: Camera) => void
  removeCamera: (id: string) => void
  
  setSettings: (settings: Settings) => void
  setDashboardStats: (stats: DashboardStats) => void
  
  addDetection: (detection: FaceDetectedPayload) => void
  removeDetection: (cameraId: string) => void
  
  setWsConnected: (connected: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  profiles: [],
  cameras: [],
  settings: null,
  dashboardStats: null,
  activeDetections: new Map(),
  activeBrowserCameras: new Set(),
  streamingCameras: new Map(),
  wsConnected: false,
  pageSize: 25,

  setProfiles: (profiles) => set({ profiles }),
  setProfile: (profile) =>
    set((state) => ({
      profiles: state.profiles.some((p) => p.id === profile.id)
        ? state.profiles.map((p) => (p.id === profile.id ? profile : p))
        : [...state.profiles, profile],
    })),
  removeProfile: (id) =>
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== id),
    })),

  setCameras: (cameras) => set({ cameras }),
  setCamera: (camera) =>
    set((state) => ({
      cameras: state.cameras.some((c) => c.id === camera.id)
        ? state.cameras.map((c) => (c.id === camera.id ? camera : c))
        : [...state.cameras, camera],
    })),
  removeCamera: (id) =>
    set((state) => ({
      cameras: state.cameras.filter((c) => c.id !== id),
    })),

  setSettings: (settings) => set({ settings }),
  setDashboardStats: (dashboardStats) => set({ dashboardStats }),

  addDetection: (detection) =>
    set((state) => {
      const newDetections = new Map(state.activeDetections)
      newDetections.set(detection.camera_id, detection)
      return { activeDetections: newDetections }
    }),
  removeDetection: (cameraId) =>
    set((state) => {
      const newDetections = new Map(state.activeDetections)
      newDetections.delete(cameraId)
      return { activeDetections: newDetections }
    }),

  addBrowserCamera: (cameraId) =>
    set((state) => {
      const newSet = new Set(state.activeBrowserCameras)
      newSet.add(cameraId)
      return { activeBrowserCameras: newSet }
    }),
  removeBrowserCamera: (cameraId) =>
    set((state) => {
      const newSet = new Set(state.activeBrowserCameras)
      newSet.delete(cameraId)
      return { activeBrowserCameras: newSet }
    }),

  addStreamingCamera: (info) =>
    set((state) => {
      const newMap = new Map(state.streamingCameras)
      newMap.set(info.cameraId, info)
      return { streamingCameras: newMap }
    }),
  removeStreamingCamera: (cameraId) =>
    set((state) => {
      const newMap = new Map(state.streamingCameras)
      newMap.delete(cameraId)
      return { streamingCameras: newMap }
    }),
  updateStreamingCamera: (cameraId, updates) =>
    set((state) => {
      const newMap = new Map(state.streamingCameras)
      const existing = newMap.get(cameraId)
      if (existing) {
        newMap.set(cameraId, { ...existing, ...updates })
      }
      return { streamingCameras: newMap }
    }),

  setWsConnected: (wsConnected) => set({ wsConnected }),
  setPageSize: (pageSize) => set({ pageSize }),
}))

// Export type for CameraStreamInfo
export type { CameraStreamInfo }
