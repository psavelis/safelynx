import { create } from 'zustand'
import type { Profile, Camera, Settings, DashboardStats, FaceDetectedPayload } from '@/types'

interface AppState {
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
  wsConnected: false,

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

  setWsConnected: (wsConnected) => set({ wsConnected }),
}))
