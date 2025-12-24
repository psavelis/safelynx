import { useEffect, useCallback, useRef } from 'react'
import { useStore, type CameraStreamInfo } from '@/store'
import type { Camera } from '@/types'

/**
 * Hook to sync backend/device cameras with the global streamingCameras store
 * This ensures consistent counting between device cameras (Rust backend) and browser cameras
 */
export function useCameraSync(cameras: Camera[] | undefined | null) {
  const { streamingCameras, addStreamingCamera, removeStreamingCamera } = useStore()
  
  // Use ref to avoid infinite loop - we need to read streamingCameras but not trigger re-renders
  const streamingCamerasRef = useRef(streamingCameras)
  streamingCamerasRef.current = streamingCameras

  // Sync device cameras to streamingCameras store
  const syncDeviceCameras = useCallback(() => {
    if (!cameras) return

    const currentStreamingCameras = streamingCamerasRef.current
    const deviceCameraIds = new Set(
      Array.from(currentStreamingCameras.values())
        .filter(c => c.source === 'device')
        .map(c => c.cameraId)
    )

    // Track which cameras need to be removed
    const camerasToRemove = new Set(deviceCameraIds)

    // Add active device cameras to store
    cameras.forEach(camera => {
      if (camera.status === 'active') {
        camerasToRemove.delete(camera.id) // Mark as still active
        
        if (!deviceCameraIds.has(camera.id)) {
          // Add new active device camera
          const info: CameraStreamInfo = {
            cameraId: camera.id,
            cameraName: camera.name,
            source: 'device',
            isRecording: camera.status === 'active', // Rust cameras are recording when active
            startedAt: camera.last_frame_at ? new Date(camera.last_frame_at) : new Date(),
            location: camera.location ? {
              latitude: camera.location.latitude,
              longitude: camera.location.longitude,
              name: camera.location.name || undefined,
            } : undefined,
          }
          addStreamingCamera(info)
        }
        // Note: Removed updateStreamingCamera call to prevent infinite loops
        // Location updates will happen on next camera fetch
      }
    })

    // Remove device cameras that are no longer active
    camerasToRemove.forEach(id => {
      removeStreamingCamera(id)
    })
  }, [cameras, addStreamingCamera, removeStreamingCamera])

  useEffect(() => {
    syncDeviceCameras()
  }, [syncDeviceCameras])

  // Return computed stats
  const stats = {
    totalDevice: cameras?.filter(c => c.status === 'active').length ?? 0,
    totalBrowser: Array.from(streamingCameras.values()).filter(c => c.source === 'browser').length,
    get total() {
      return this.totalDevice + this.totalBrowser
    },
    deviceWithLocation: cameras?.filter(c => c.status === 'active' && c.location).length ?? 0,
    browserWithLocation: Array.from(streamingCameras.values()).filter(
      c => c.source === 'browser' && c.location
    ).length,
  }

  return { stats, syncDeviceCameras }
}
