import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  SignalIcon,
  XMarkIcon,
  CameraIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline'
import { DetectionOverlay, type DetectionData } from './DetectionPolygon'
import { useStore } from '@/store'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7889'

interface BrowserCameraProps {
  onCameraRegistered?: (cameraId: string) => void
  onDetection?: (detection: DetectionData) => void
}

type CameraStatus = 'idle' | 'checking-permissions' | 'requesting' | 'active' | 'streaming' | 'error'
type PermissionStatus = 'unknown' | 'granted' | 'denied' | 'prompt'

interface GeoPosition {
  latitude: number
  longitude: number
  accuracy: number
}

interface Permissions {
  camera: PermissionStatus
  location: PermissionStatus
}

export function BrowserCamera({ onCameraRegistered, onDetection }: BrowserCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)

  const { addBrowserCamera, removeBrowserCamera, addStreamingCamera, removeStreamingCamera } = useStore()

  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [cameraId, setCameraId] = useState<string | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState<string>('')
  const [cameraName, setCameraName] = useState('')
  const [location, setLocation] = useState<GeoPosition | null>(null)
  const [locationName, setLocationName] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [detections, setDetections] = useState<DetectionData[]>([])
  const [frameCount, setFrameCount] = useState(0)
  const [fps, setFps] = useState(0)
  const [showSetup, setShowSetup] = useState(true)
  const [permissions, setPermissions] = useState<Permissions>({
    camera: 'unknown',
    location: 'unknown',
  })
  const [showPermissionDialog, setShowPermissionDialog] = useState(false)

  // Check permissions on mount
  useEffect(() => {
    checkPermissions()
  }, [])

  // Check current permission status
  const checkPermissions = useCallback(async () => {
    setStatus('checking-permissions')
    const newPermissions: Permissions = { camera: 'unknown', location: 'unknown' }

    try {
      // Check camera permission
      if ('permissions' in navigator) {
        try {
          const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName })
          newPermissions.camera = cameraPermission.state as PermissionStatus
          
          // Listen for changes
          cameraPermission.addEventListener('change', () => {
            setPermissions(p => ({ ...p, camera: cameraPermission.state as PermissionStatus }))
          })
        } catch {
          // Camera permission query not supported
          newPermissions.camera = 'prompt'
        }

        // Check location permission
        try {
          const locationPermission = await navigator.permissions.query({ name: 'geolocation' })
          newPermissions.location = locationPermission.state as PermissionStatus
          
          locationPermission.addEventListener('change', () => {
            setPermissions(p => ({ ...p, location: locationPermission.state as PermissionStatus }))
          })
        } catch {
          newPermissions.location = 'prompt'
        }
      } else {
        newPermissions.camera = 'prompt'
        newPermissions.location = 'prompt'
      }
    } catch (err) {
      console.error('Permission check failed:', err)
    }

    setPermissions(newPermissions)
    setStatus('idle')

    // Show permission dialog if permissions not granted
    if (newPermissions.camera !== 'granted' || newPermissions.location !== 'granted') {
      setShowPermissionDialog(true)
    }
  }, [])

  // Request all permissions
  const requestAllPermissions = useCallback(async () => {
    setStatus('requesting')
    setError(null)

    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      stream.getTracks().forEach(track => track.stop())
      setPermissions(p => ({ ...p, camera: 'granted' }))

      // Request location permission
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setLocation({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            })
            setPermissions(p => ({ ...p, location: 'granted' }))
          },
          (err) => {
            console.warn('Location permission denied:', err.message)
            setPermissions(p => ({ ...p, location: 'denied' }))
          },
          { enableHighAccuracy: true, timeout: 10000 }
        )
      }

      // Get available devices
      const deviceList = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = deviceList.filter(d => d.kind === 'videoinput')
      setDevices(videoDevices)
      if (videoDevices.length > 0 && !selectedDevice) {
        setSelectedDevice(videoDevices[0].deviceId)
      }

      setShowPermissionDialog(false)
      setStatus('idle')
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setPermissions(p => ({ ...p, camera: 'denied' }))
        setError('Camera permission denied. Please allow camera access in your browser settings.')
      } else {
        setError(err.message || 'Failed to request permissions')
      }
      setStatus('error')
    }
  }, [selectedDevice])

  // Request location only
  const requestLocation = useCallback(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocation({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          })
          setPermissions(p => ({ ...p, location: 'granted' }))
        },
        (err) => {
          console.warn('Geolocation error:', err.message)
          setPermissions(p => ({ ...p, location: 'denied' }))
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    }
  }, [])

  // Start camera stream
  const startCamera = useCallback(async () => {
    // Check permissions first
    if (permissions.camera !== 'granted') {
      setShowPermissionDialog(true)
      return
    }

    setStatus('requesting')
    setError(null)

    try {
      const constraints: MediaStreamConstraints = {
        video: selectedDevice
          ? { deviceId: { exact: selectedDevice }, width: 1280, height: 720 }
          : { width: 1280, height: 720, facingMode: 'user' },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setStatus('active')
      
      // Request location if not already granted
      if (permissions.location !== 'granted' && !location) {
        requestLocation()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to access camera')
      setStatus('error')
    }
  }, [selectedDevice, permissions.camera, permissions.location, location, requestLocation])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    // Remove from global tracking
    if (cameraId) {
      removeBrowserCamera(cameraId)
      removeStreamingCamera(cameraId)
    }
    setIsStreaming(false)
    setStatus('idle')
    setDetections([])
  }, [cameraId, removeBrowserCamera, removeStreamingCamera])

  // Register camera with backend
  const registerCamera = useCallback(async () => {
    if (!cameraName.trim()) {
      setError('Please enter a camera name')
      return
    }

    try {
      const response = await fetch(`${API_URL}/api/v1/cameras`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cameraName || 'Browser Camera',
          camera_type: 'browser',
          device_id: `browser-${Date.now()}`,
          location: location ? {
            latitude: location.latitude,
            longitude: location.longitude,
            name: locationName || null,
          } : null,
        }),
      })

      if (!response.ok) throw new Error('Failed to register camera')

      const data = await response.json()
      const newCameraId = data.camera?.id || data.id
      setCameraId(newCameraId)
      onCameraRegistered?.(newCameraId)
      setShowSetup(false)
    } catch (err: any) {
      setError(err.message || 'Failed to register camera')
    }
  }, [cameraName, location, locationName, onCameraRegistered])

  // Stream frames to backend
  const startStreaming = useCallback(async () => {
    if (!cameraId || !videoRef.current || !canvasRef.current) return

    setIsStreaming(true)
    setStatus('streaming')
    
    // Track this browser camera as active in global store
    addBrowserCamera(cameraId)
    addStreamingCamera({
      cameraId,
      cameraName: cameraName || 'Browser Camera',
      source: 'browser',
      isRecording: true,
      startedAt: new Date(),
      location: location ? {
        latitude: location.latitude,
        longitude: location.longitude,
        name: locationName || undefined,
      } : undefined,
    })

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext('2d')!

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    let lastTime = Date.now()
    let frames = 0

    intervalRef.current = window.setInterval(async () => {
      if (!video.videoWidth || !ctx) return

      ctx.drawImage(video, 0, 0)
      const blob = await new Promise<Blob | null>(resolve =>
        canvas.toBlob(resolve, 'image/jpeg', 0.8)
      )

      if (!blob) return

      frames++
      const now = Date.now()
      if (now - lastTime >= 1000) {
        setFps(frames)
        frames = 0
        lastTime = now
      }
      setFrameCount(prev => prev + 1)

      try {
        const formData = new FormData()
        formData.append('frame', blob, 'frame.jpg')
        formData.append('camera_id', cameraId)
        formData.append('timestamp', new Date().toISOString())

        const response = await fetch(`${API_URL}/api/v1/detect/frame`, {
          method: 'POST',
          body: formData,
        })

        if (response.ok) {
          const result = await response.json()
          if (result.detections?.length > 0) {
            const newDetections: DetectionData[] = result.detections.map((d: any, i: number) => ({
              id: `${Date.now()}-${i}`,
              x: d.bounding_box.x,
              y: d.bounding_box.y,
              width: d.bounding_box.width,
              height: d.bounding_box.height,
              confidence: d.confidence,
              profile_id: d.profile_id,
              profile_name: d.profile_name,
              classification: d.profile_id ? 'known' : 'unknown',
              landmarks: d.landmarks,
            }))
            setDetections(newDetections)
            newDetections.forEach(d => onDetection?.(d))
          } else {
            setDetections([])
          }
        }
      } catch (err) {
        console.error('Frame upload error:', err)
      }
    }, 200) // ~5 FPS to backend
  }, [cameraId, cameraName, location, locationName, onDetection, addBrowserCamera, addStreamingCamera])

  const stopStreaming = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    // Remove from global tracking
    if (cameraId) {
      removeBrowserCamera(cameraId)
      removeStreamingCamera(cameraId)
    }
    setIsStreaming(false)
    setStatus('active')
    setDetections([])
  }, [cameraId, removeBrowserCamera, removeStreamingCamera])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  // Permission dialog
  const PermissionDialog = () => (
    <AnimatePresence>
      {showPermissionDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-surface-900 rounded-2xl p-6 max-w-md mx-4 border border-surface-700"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-xl bg-lynx-500/20">
                <ShieldExclamationIcon className="h-6 w-6 text-lynx-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white uppercase tracking-wider">
                  Permissions Required
                </h3>
                <p className="text-sm text-surface-400">
                  To use browser camera features
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className={clsx(
                'flex items-center gap-3 p-3 rounded-lg',
                permissions.camera === 'granted' ? 'bg-emerald-500/10' : 'bg-surface-800'
              )}>
                <CameraIcon className={clsx(
                  'h-5 w-5',
                  permissions.camera === 'granted' ? 'text-emerald-400' : 'text-surface-400'
                )} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white uppercase tracking-wider">Camera Access</p>
                  <p className="text-xs text-surface-400">Required for video capture</p>
                </div>
                {permissions.camera === 'granted' ? (
                  <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
                ) : permissions.camera === 'denied' ? (
                  <XMarkIcon className="h-5 w-5 text-red-400" />
                ) : null}
              </div>

              <div className={clsx(
                'flex items-center gap-3 p-3 rounded-lg',
                permissions.location === 'granted' ? 'bg-emerald-500/10' : 'bg-surface-800'
              )}>
                <MapPinIcon className={clsx(
                  'h-5 w-5',
                  permissions.location === 'granted' ? 'text-emerald-400' : 'text-surface-400'
                )} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-white uppercase tracking-wider">Location Access</p>
                  <p className="text-xs text-surface-400">Optional for heatmap data</p>
                </div>
                {permissions.location === 'granted' ? (
                  <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
                ) : permissions.location === 'denied' ? (
                  <XMarkIcon className="h-5 w-5 text-amber-400" />
                ) : null}
              </div>
            </div>

            {permissions.camera === 'denied' && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">
                  Camera access was denied. Please enable it in your browser settings and reload.
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowPermissionDialog(false)}
                className="flex-1 btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={requestAllPermissions}
                disabled={permissions.camera === 'denied'}
                className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {status === 'requesting' ? (
                  <ArrowPathIcon className="h-5 w-5 animate-spin mx-auto" />
                ) : (
                  'Grant Permissions'
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return (
    <>
      <PermissionDialog />
      
      <div className="card overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-surface-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={clsx(
              'p-2 rounded-lg',
              status === 'streaming' ? 'bg-emerald-500/20' :
              status === 'active' ? 'bg-lynx-500/20' :
              status === 'error' ? 'bg-red-500/20' : 'bg-surface-800'
            )}>
              <CameraIcon className={clsx(
                'h-5 w-5',
                status === 'streaming' ? 'text-emerald-400' :
                status === 'active' ? 'text-lynx-400' :
                status === 'error' ? 'text-red-400' : 'text-surface-400'
              )} />
            </div>
            <div>
              <h3 className="font-semibold text-white uppercase tracking-wider text-sm">
                Browser Camera
              </h3>
              <p className="text-xs text-surface-400 font-mono">
                {status === 'streaming' ? `Streaming • ${fps} FPS` :
                 status === 'active' ? 'Camera ready' :
                 status === 'requesting' ? 'Requesting access...' :
                 status === 'checking-permissions' ? 'Checking permissions...' :
                 status === 'error' ? 'Error' : 'Not started'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Permission indicators */}
            <div className="flex items-center gap-1 px-2 py-1 rounded bg-surface-800">
              <CameraIcon className={clsx(
                'h-4 w-4',
                permissions.camera === 'granted' ? 'text-emerald-400' :
                permissions.camera === 'denied' ? 'text-red-400' : 'text-surface-500'
              )} />
              <MapPinIcon className={clsx(
                'h-4 w-4',
                permissions.location === 'granted' ? 'text-emerald-400' :
                permissions.location === 'denied' ? 'text-amber-400' : 'text-surface-500'
              )} />
            </div>

            {status === 'idle' && (
              <button
                onClick={permissions.camera === 'granted' ? startCamera : () => setShowPermissionDialog(true)}
                className="btn-primary text-sm"
              >
                {permissions.camera === 'granted' ? 'Start Camera' : 'Setup Permissions'}
              </button>
            )}
            {(status === 'active' || status === 'streaming') && (
              <button onClick={stopCamera} className="btn-secondary text-sm">
                Stop
              </button>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-red-500/10 border-b border-red-500/20">
            <div className="flex items-center gap-2 text-red-400">
              <ExclamationTriangleIcon className="h-5 w-5" />
              <span className="text-sm">{error}</span>
              <button onClick={() => setError(null)} className="ml-auto">
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Video container */}
        <div className="relative aspect-video bg-surface-900">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
            muted
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Detection overlay */}
          {detections.length > 0 && (
            <DetectionOverlay
              detections={detections}
            />
          )}

          {/* Location badge */}
          {location && (
            <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-900/80 backdrop-blur-sm">
              <MapPinIcon className="h-4 w-4 text-emerald-400" />
              <span className="text-xs text-white font-mono">
                {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
              </span>
            </div>
          )}

          {/* Status overlay */}
          {status === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-900/80">
              <div className="text-center">
                <CameraIcon className="h-16 w-16 mx-auto text-surface-600 mb-4" />
                <p className="text-surface-400 uppercase tracking-wider font-semibold">
                  {permissions.camera === 'granted' 
                    ? 'Click "Start Camera" to begin' 
                    : 'Click "Setup Permissions" first'}
                </p>
              </div>
            </div>
          )}

          {/* Streaming indicator */}
          {isStreaming && (
            <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/90">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
              </span>
              <span className="text-xs text-white font-semibold uppercase tracking-wider">Recording</span>
            </div>
          )}
        </div>

        {/* Setup form or streaming controls */}
        {(status === 'active' || status === 'streaming') && (
          <div className="p-4 border-t border-surface-800">
            {showSetup ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-surface-300 mb-2 uppercase tracking-wider">
                    Camera Name
                  </label>
                  <input
                    type="text"
                    value={cameraName}
                    onChange={(e) => setCameraName(e.target.value)}
                    placeholder="e.g., Living Room, Front Door"
                    className="input w-full"
                  />
                </div>

                {devices.length > 1 && (
                  <div>
                    <label className="block text-sm font-semibold text-surface-300 mb-2 uppercase tracking-wider">
                      Select Camera
                    </label>
                    <select
                      value={selectedDevice}
                      onChange={(e) => setSelectedDevice(e.target.value)}
                      className="input w-full"
                    >
                      {devices.map((device) => (
                        <option key={device.deviceId} value={device.deviceId}>
                          {device.label || `Camera ${devices.indexOf(device) + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-surface-300 mb-2 uppercase tracking-wider">
                    Location Name (Optional)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={locationName}
                      onChange={(e) => setLocationName(e.target.value)}
                      placeholder="e.g., Home, Office"
                      className="input flex-1"
                    />
                    <button
                      onClick={requestLocation}
                      className="btn-secondary px-3"
                      title="Get current location"
                    >
                      <MapPinIcon className="h-5 w-5" />
                    </button>
                  </div>
                  {location && (
                    <p className="mt-1 text-xs text-emerald-400 font-mono">
                      ✓ Location captured: {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                    </p>
                  )}
                  {permissions.location === 'denied' && (
                    <p className="mt-1 text-xs text-amber-400">
                      Location permission denied. Heatmap features may be limited.
                    </p>
                  )}
                </div>

                <button
                  onClick={registerCamera}
                  disabled={!cameraName.trim()}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  Register Camera & Continue
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white uppercase tracking-wider">
                      {cameraName}
                    </p>
                    <p className="text-xs text-surface-400 font-mono">
                      ID: {cameraId?.slice(0, 8)}...
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-white">{frameCount} frames</p>
                    <p className="text-xs text-surface-400">{fps} FPS</p>
                  </div>
                </div>

                {!isStreaming ? (
                  <button onClick={startStreaming} className="btn-primary w-full">
                    <SignalIcon className="h-5 w-5 mr-2" />
                    Start Streaming to Server
                  </button>
                ) : (
                  <button onClick={stopStreaming} className="btn-secondary w-full">
                    <XMarkIcon className="h-5 w-5 mr-2" />
                    Stop Streaming
                  </button>
                )}

                {detections.length > 0 && (
                  <div className="p-3 rounded-lg bg-lynx-500/10 border border-lynx-500/20">
                    <p className="text-sm text-lynx-400 font-semibold">
                      {detections.length} face(s) detected
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
