import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import {
  VideoCameraIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  UserIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { sdk } from '@/sdk'
import { useFetch } from '@/hooks'
import { useStore } from '@/store'
import type { Camera, BoundingBox } from '@/types'

interface DetectionBox extends BoundingBox {
  profile_id?: string
  profile_name?: string
  confidence: number
  classification?: 'known' | 'unknown' | 'flagged'
  timestamp: number
}

export function LiveView() {
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showOverlay, setShowOverlay] = useState(true)
  const [detections, setDetections] = useState<Map<string, DetectionBox[]>>(new Map())
  const containerRef = useRef<HTMLDivElement>(null)

  const { data: cameras, loading, refetch } = useFetch<Camera[]>(
    () => sdk.cameras.list(),
    []
  )

  const { activeDetections, wsConnected, setCameras } = useStore()

  useEffect(() => {
    if (cameras) {
      setCameras(cameras)
      // Auto-select first active camera
      const activeCamera = cameras.find((c: Camera) => c.status === 'active')
      if (activeCamera && !selectedCamera) {
        setSelectedCamera(activeCamera.id)
      }
    }
  }, [cameras, setCameras, selectedCamera])

  // Update detections from WebSocket
  useEffect(() => {
    activeDetections.forEach((detection, cameraId) => {
      setDetections(prev => {
        const newMap = new Map(prev)
        const existing = newMap.get(cameraId) || []
        const newDetection: DetectionBox = {
          ...detection.bounding_box,
          profile_id: detection.profile_id ?? undefined,
          profile_name: detection.profile_name ?? undefined,
          confidence: detection.confidence,
          classification: detection.profile_id ? 'known' : 'unknown',
          timestamp: Date.now(),
        }
        // Keep only recent detections (last 2 seconds)
        const recent = existing.filter(d => Date.now() - d.timestamp < 2000)
        newMap.set(cameraId, [...recent, newDetection])
        return newMap
      })
    })
  }, [activeDetections])

  // Clean up old detections
  useEffect(() => {
    const interval = setInterval(() => {
      setDetections(prev => {
        const newMap = new Map()
        prev.forEach((boxes, cameraId) => {
          const recent = boxes.filter(d => Date.now() - d.timestamp < 2000)
          if (recent.length > 0) {
            newMap.set(cameraId, recent)
          }
        })
        return newMap
      })
    }, 500)
    return () => clearInterval(interval)
  }, [])

  const handleStartStream = async (cameraId: string) => {
    try {
      await sdk.cameras.startStream(cameraId)
      refetch()
    } catch (error) {
      console.error('Failed to start stream:', error)
    }
  }

  const handleStopStream = async (cameraId: string) => {
    try {
      await sdk.cameras.stopStream(cameraId)
      refetch()
    } catch (error) {
      console.error('Failed to stop stream:', error)
    }
  }

  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen()
      setIsFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const selectedCameraData = cameras?.find((c: Camera) => c.id === selectedCamera)
  const cameraDetections = selectedCamera ? detections.get(selectedCamera) || [] : []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Live View</h1>
          <p className="mt-1 text-surface-400">
            Real-time camera monitoring with face detection
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm',
            wsConnected 
              ? 'bg-emerald-500/20 text-emerald-400' 
              : 'bg-red-500/20 text-red-400'
          )}>
            <span className={clsx(
              'h-2 w-2 rounded-full',
              wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
            )} />
            {wsConnected ? 'Connected' : 'Disconnected'}
          </div>
          <button
            onClick={() => setShowOverlay(!showOverlay)}
            className={clsx(
              'btn-secondary p-2',
              showOverlay && 'bg-lynx-600/20 text-lynx-400'
            )}
            title="Toggle detection overlay"
          >
            <EyeIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Camera List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wide">
            Cameras
          </h2>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin h-6 w-6 border-2 border-lynx-500 border-t-transparent rounded-full" />
            </div>
          ) : cameras?.length === 0 ? (
            <div className="card p-6 text-center">
              <VideoCameraIcon className="h-10 w-10 mx-auto text-surface-600" />
              <p className="mt-2 text-sm text-surface-400">No cameras configured</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cameras?.map((camera: Camera) => {
                const isSelected = selectedCamera === camera.id
                const isActive = camera.status === 'active'
                const hasDetection = detections.has(camera.id)
                
                return (
                  <motion.button
                    key={camera.id}
                    onClick={() => setSelectedCamera(camera.id)}
                    className={clsx(
                      'w-full p-3 rounded-xl text-left transition-all',
                      isSelected
                        ? 'bg-lynx-600/20 border-2 border-lynx-500'
                        : 'bg-surface-900/50 border-2 border-surface-800 hover:border-surface-700'
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        'p-2 rounded-lg',
                        isActive ? 'bg-emerald-500/20' : 'bg-surface-800'
                      )}>
                        <VideoCameraIcon className={clsx(
                          'h-5 w-5',
                          isActive ? 'text-emerald-400' : 'text-surface-500'
                        )} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate">
                            {camera.name}
                          </span>
                          {hasDetection && (
                            <span className="flex h-2 w-2">
                              <span className="animate-ping absolute h-2 w-2 rounded-full bg-lynx-400 opacity-75" />
                              <span className="relative h-2 w-2 rounded-full bg-lynx-500" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-surface-500">
                          {camera.width}x{camera.height} @ {camera.fps}fps
                        </div>
                      </div>
                      <div className={clsx(
                        'h-2 w-2 rounded-full',
                        isActive ? 'bg-emerald-500' : 'bg-surface-600'
                      )} />
                    </div>
                  </motion.button>
                )
              })}
            </div>
          )}
        </div>

        {/* Main View */}
        <div className="lg:col-span-3" ref={containerRef}>
          {selectedCameraData ? (
            <div className="relative rounded-2xl overflow-hidden bg-surface-900 border border-surface-800">
              {/* Video Container */}
              <div className="relative aspect-video bg-black">
                {/* Placeholder video feed - replace with actual stream */}
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-900 to-surface-950">
                  {selectedCameraData.status === 'active' ? (
                    <>
                      {/* Simulated video feed pattern */}
                      <div className="absolute inset-0 opacity-10">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(14,165,233,0.1),transparent_50%)]" />
                        <div className="absolute inset-0" style={{
                          backgroundImage: 'linear-gradient(90deg, transparent 50%, rgba(14,165,233,0.02) 50%)',
                          backgroundSize: '4px 4px'
                        }} />
                      </div>
                      <div className="text-center z-10">
                        <VideoCameraIcon className="h-16 w-16 mx-auto text-lynx-500/50 animate-pulse" />
                        <p className="mt-3 text-surface-400">Camera Feed Active</p>
                        <p className="text-sm text-surface-500 mt-1">
                          {selectedCameraData.name} - {selectedCameraData.width || selectedCameraData.resolution?.width}x{selectedCameraData.height || selectedCameraData.resolution?.height}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <VideoCameraIcon className="h-16 w-16 mx-auto text-surface-600" />
                      <p className="mt-3 text-surface-400">Camera Offline</p>
                      <button
                        onClick={() => handleStartStream(selectedCameraData.id)}
                        className="mt-4 btn-primary"
                      >
                        Start Stream
                      </button>
                    </div>
                  )}
                </div>

                {/* Detection Overlays */}
                {showOverlay && (
                  <AnimatePresence>
                    {cameraDetections.map((detection, index) => (
                      <motion.div
                        key={`${detection.timestamp}-${index}`}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className={clsx(
                          'absolute border-2 rounded-lg',
                          detection.classification === 'flagged'
                            ? 'border-red-500 bg-red-500/10 animate-pulse'
                            : detection.classification === 'known'
                            ? 'border-emerald-500 bg-emerald-500/10'
                            : 'border-amber-500 bg-amber-500/10'
                        )}
                        style={{
                          left: `${detection.x * 100}%`,
                          top: `${detection.y * 100}%`,
                          width: `${detection.width * 100}%`,
                          height: `${detection.height * 100}%`,
                        }}
                      >
                        {/* Detection Label */}
                        <div className={clsx(
                          'absolute -top-8 left-0 flex items-center gap-2 px-2 py-1 rounded text-xs font-medium',
                          detection.classification === 'flagged'
                            ? 'bg-red-500 text-white'
                            : detection.classification === 'known'
                            ? 'bg-emerald-500 text-white'
                            : 'bg-amber-500 text-black'
                        )}>
                          {detection.classification === 'flagged' ? (
                            <ExclamationTriangleIcon className="h-3 w-3" />
                          ) : detection.classification === 'known' ? (
                            <CheckCircleIcon className="h-3 w-3" />
                          ) : (
                            <UserIcon className="h-3 w-3" />
                          )}
                          <span>
                            {detection.profile_name || 'Unknown'}
                          </span>
                          <span className="opacity-70">
                            {Math.round(detection.confidence * 100)}%
                          </span>
                        </div>

                        {/* Corner indicators */}
                        <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-current rounded-tl" />
                        <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-current rounded-tr" />
                        <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-current rounded-bl" />
                        <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-current rounded-br" />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}

                {/* Live indicator */}
                {selectedCameraData.status === 'active' && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/90 text-white text-sm font-medium">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    LIVE
                  </div>
                )}

                {/* Controls overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartStream(selectedCameraData.id)}
                      disabled={selectedCameraData.status === 'active'}
                      className={clsx(
                        'p-2 rounded-lg transition-colors',
                        selectedCameraData.status === 'active'
                          ? 'bg-surface-800/80 text-surface-500'
                          : 'bg-emerald-500/80 text-white hover:bg-emerald-500'
                      )}
                    >
                      <VideoCameraIcon className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleFullscreen}
                      className="p-2 rounded-lg bg-surface-800/80 text-white hover:bg-surface-700 transition-colors"
                    >
                      {isFullscreen ? (
                        <ArrowsPointingInIcon className="h-5 w-5" />
                      ) : (
                        <ArrowsPointingOutIcon className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Info bar */}
              <div className="p-4 bg-surface-900/50 border-t border-surface-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <h3 className="font-semibold text-white">{selectedCameraData.name}</h3>
                      <p className="text-xs text-surface-500">
                        {selectedCameraData.camera_type.toUpperCase()} Camera
                      </p>
                    </div>
                    <div className="h-8 w-px bg-surface-800" />
                    <div className="text-sm">
                      <span className="text-surface-400">Resolution: </span>
                      <span className="text-white">
                        {selectedCameraData.width || selectedCameraData.resolution?.width}x{selectedCameraData.height || selectedCameraData.resolution?.height}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-surface-400">FPS: </span>
                      <span className="text-white">{selectedCameraData.fps}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <span className="text-surface-400">Detections: </span>
                      <span className="text-lynx-400 font-semibold">
                        {cameraDetections.length}
                      </span>
                    </div>
                    {selectedCameraData.status === 'active' ? (
                      <button
                        onClick={() => handleStopStream(selectedCameraData.id)}
                        className="btn-danger text-sm py-1.5"
                      >
                        Stop Stream
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartStream(selectedCameraData.id)}
                        className="btn-primary text-sm py-1.5"
                      >
                        Start Stream
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-12 text-center aspect-video flex flex-col items-center justify-center"
            >
              <VideoCameraIcon className="h-20 w-20 text-surface-600" />
              <h3 className="mt-4 text-xl font-semibold text-white">
                Select a Camera
              </h3>
              <p className="mt-2 text-surface-400 max-w-md">
                Choose a camera from the list to start viewing the live feed
                with real-time face detection overlays
              </p>
            </motion.div>
          )}
        </div>
      </div>

      {/* Detection Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-lynx-500/20">
              <EyeIcon className="h-5 w-5 text-lynx-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {Array.from(detections.values()).flat().length}
              </div>
              <div className="text-xs text-surface-400">Active Detections</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {Array.from(detections.values()).flat().filter(d => d.classification === 'known').length}
              </div>
              <div className="text-xs text-surface-400">Known Faces</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <UserIcon className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {Array.from(detections.values()).flat().filter(d => d.classification === 'unknown').length}
              </div>
              <div className="text-xs text-surface-400">Unknown Faces</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">
                {Array.from(detections.values()).flat().filter(d => d.classification === 'flagged').length}
              </div>
              <div className="text-xs text-surface-400">Flagged Alerts</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
