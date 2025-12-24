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
  PlusIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import { sdk } from '@/sdk'
import { useFetch, useCameraSync } from '@/hooks'
import { useStore } from '@/store'
import { DetectionOverlay, BrowserCamera } from '@/components'
import type { DetectionData } from '@/components'
import type { Camera, BoundingBox } from '@/types'

interface DetectionBox extends BoundingBox {
  id: string
  profile_id?: string
  profile_name?: string
  confidence: number
  classification?: 'known' | 'unknown' | 'flagged'
  timestamp: number
  landmarks?: { x: number; y: number }[]
}

export function LiveView() {
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showOverlay, setShowOverlay] = useState(true)
  const [showLandmarks, setShowLandmarks] = useState(false)
  const [showBrowserCamera, setShowBrowserCamera] = useState(false)
  const [detections, setDetections] = useState<Map<string, DetectionBox[]>>(new Map())
  const [viewMode, setViewMode] = useState<'device' | 'browser' | 'all'>('all')
  const containerRef = useRef<HTMLDivElement>(null)
  const videoContainerRef = useRef<HTMLDivElement>(null)

  const { data: cameras, loading, refetch } = useFetch<Camera[]>(
    () => sdk.cameras.list(),
    []
  )

  const { activeDetections, wsConnected, setCameras, streamingCameras } = useStore()

  // Sync device cameras to global store
  useCameraSync(cameras ?? undefined)

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
          id: `${detection.camera_id}-${Date.now()}`,
          ...detection.bounding_box,
          profile_id: detection.profile_id ?? undefined,
          profile_name: detection.profile_name ?? undefined,
          confidence: detection.confidence,
          classification: detection.profile_id ? 'known' : 'unknown',
          timestamp: Date.now(),
          landmarks: detection.landmarks,
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

  // Convert DetectionBox to DetectionData format for the overlay
  const detectionDataList: DetectionData[] = cameraDetections.map(d => ({
    id: d.id,
    x: d.x,
    y: d.y,
    width: d.width,
    height: d.height,
    confidence: d.confidence,
    profile_id: d.profile_id,
    profile_name: d.profile_name,
    classification: d.classification,
    landmarks: d.landmarks,
  }))

  // Calculate browser camera count
  const browserCameraCount = Array.from(streamingCameras.values()).filter(c => c.source === 'browser').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white uppercase tracking-wider">Live View</h1>
          <p className="mt-1 text-surface-400">
            Real-time camera monitoring with face detection
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex rounded-lg border border-surface-700 overflow-hidden">
            <button
              onClick={() => setViewMode('all')}
              className={clsx(
                'px-3 py-1.5 text-xs font-semibold transition-colors uppercase tracking-wider',
                viewMode === 'all'
                  ? 'bg-lynx-600 text-white'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              All
            </button>
            <button
              onClick={() => setViewMode('device')}
              className={clsx(
                'px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1 uppercase tracking-wider',
                viewMode === 'device'
                  ? 'bg-lynx-600 text-white'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              <ComputerDesktopIcon className="h-3.5 w-3.5" />
              Device
            </button>
            <button
              onClick={() => setViewMode('browser')}
              className={clsx(
                'px-3 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1 uppercase tracking-wider',
                viewMode === 'browser'
                  ? 'bg-lynx-600 text-white'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              <DevicePhoneMobileIcon className="h-3.5 w-3.5" />
              Browser
            </button>
          </div>

          <div className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono',
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
            onClick={() => setShowLandmarks(!showLandmarks)}
            className={clsx(
              'btn-secondary p-2',
              showLandmarks && 'bg-purple-600/20 text-purple-400'
            )}
            title="Toggle facial landmarks"
          >
            <Cog6ToothIcon className="h-5 w-5" />
          </button>
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
          <button
            onClick={() => setShowBrowserCamera(!showBrowserCamera)}
            className={clsx(
              'btn-primary flex items-center gap-2',
              showBrowserCamera && 'bg-purple-600'
            )}
          >
            <PlusIcon className="h-4 w-4" />
            <span className="uppercase tracking-wider text-sm">Browser Camera</span>
            {browserCameraCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white/20 text-xs font-mono">
                {browserCameraCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Camera List */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-surface-400 uppercase tracking-wider">
            Cameras
          </h2>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin h-6 w-6 border-2 border-lynx-500 border-t-transparent rounded-full" />
            </div>
          ) : cameras?.length === 0 && browserCameraCount === 0 ? (
            <div className="card p-6 text-center">
              <VideoCameraIcon className="h-10 w-10 mx-auto text-surface-600" />
              <p className="mt-2 text-sm text-surface-400 uppercase tracking-wider">No cameras configured</p>
              <button
                onClick={() => setShowBrowserCamera(true)}
                className="mt-3 btn-primary text-sm"
              >
                Add Browser Camera
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {/* Device cameras */}
              {(viewMode === 'all' || viewMode === 'device') && cameras?.map((camera: Camera) => {
                const isSelected = selectedCamera === camera.id
                const isActive = camera.status === 'active'
                const hasDetection = detections.has(camera.id)
                
                return (
                  <motion.button
                    key={camera.id}
                    onClick={() => {
                      setSelectedCamera(camera.id)
                      setShowBrowserCamera(false)
                    }}
                    className={clsx(
                      'w-full p-3 rounded-xl text-left transition-all',
                      isSelected && !showBrowserCamera
                        ? 'bg-lynx-600/20 border-2 border-lynx-500'
                        : 'bg-surface-900/50 border-2 border-surface-800 hover:border-surface-700'
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className={clsx(
                        'p-2 rounded-lg relative',
                        isActive ? 'bg-emerald-500/20' : 'bg-surface-800'
                      )}>
                        <VideoCameraIcon className={clsx(
                          'h-5 w-5',
                          isActive ? 'text-emerald-400' : 'text-surface-500'
                        )} />
                        {/* Source badge */}
                        <span className="absolute -bottom-1 -right-1 bg-blue-500 text-white text-[8px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center">
                          D
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate uppercase tracking-wider text-sm">
                            {camera.name}
                          </span>
                          {hasDetection && (
                            <span className="flex h-2 w-2">
                              <span className="animate-ping absolute h-2 w-2 rounded-full bg-lynx-400 opacity-75" />
                              <span className="relative h-2 w-2 rounded-full bg-lynx-500" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-surface-500 font-mono">
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

              {/* Browser cameras from store */}
              {(viewMode === 'all' || viewMode === 'browser') && Array.from(streamingCameras.values())
                .filter(c => c.source === 'browser')
                .map((browserCam) => (
                  <motion.button
                    key={browserCam.cameraId}
                    onClick={() => {
                      setSelectedCamera(browserCam.cameraId)
                      setShowBrowserCamera(true)
                    }}
                    className={clsx(
                      'w-full p-3 rounded-xl text-left transition-all',
                      selectedCamera === browserCam.cameraId && showBrowserCamera
                        ? 'bg-purple-600/20 border-2 border-purple-500'
                        : 'bg-surface-900/50 border-2 border-surface-800 hover:border-surface-700'
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20 relative">
                        <DevicePhoneMobileIcon className="h-5 w-5 text-purple-400" />
                        <span className="absolute -bottom-1 -right-1 bg-purple-500 text-white text-[8px] font-bold rounded-full h-3.5 w-3.5 flex items-center justify-center">
                          B
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white truncate uppercase tracking-wider text-sm">
                            {browserCam.cameraName}
                          </span>
                          {browserCam.isRecording && (
                            <span className="flex h-2 w-2">
                              <span className="animate-ping absolute h-2 w-2 rounded-full bg-red-400 opacity-75" />
                              <span className="relative h-2 w-2 rounded-full bg-red-500" />
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-surface-500 font-mono">
                          Browser • {browserCam.isRecording ? 'Streaming' : 'Ready'}
                        </div>
                      </div>
                      <div className="h-2 w-2 rounded-full bg-purple-500" />
                    </div>
                  </motion.button>
                ))}
            </div>
          )}
        </div>

        {/* Main View */}
        <div className="lg:col-span-3" ref={containerRef}>
          {/* Browser Camera Panel */}
          <AnimatePresence>
            {showBrowserCamera && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mb-6"
              >
                <BrowserCamera
                  onCameraRegistered={(id) => {
                    setSelectedCamera(id)
                    refetch()
                  }}
                  onDetection={(detection) => {
                    // Handle browser camera detections
                    console.log('Browser detection:', detection)
                  }}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {selectedCameraData && !showBrowserCamera ? (
            <div className="relative rounded-2xl overflow-hidden bg-surface-900 border border-surface-800">
              {/* Video Container */}
              <div className="relative aspect-video bg-black" ref={videoContainerRef}>
                {/* MJPEG video stream or placeholder */}
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-900 to-surface-950">
                  {selectedCameraData.status === 'active' ? (
                    <>
                      {/* MJPEG Stream */}
                      <img
                        src={`${import.meta.env.VITE_API_URL || 'http://localhost:7889'}/api/v1/cameras/${selectedCameraData.id}/mjpeg`}
                        alt={`${selectedCameraData.name} live feed`}
                        className="absolute inset-0 w-full h-full object-contain"
                        onError={(e) => {
                          // Hide image on error, show placeholder
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      {/* Fallback if stream fails */}
                      <div className="text-center z-10 pointer-events-none">
                        <VideoCameraIcon className="h-16 w-16 mx-auto text-lynx-500/50 animate-pulse" />
                        <p className="mt-3 text-surface-400 uppercase tracking-wider font-semibold">Camera Feed Active</p>
                        <p className="text-sm text-surface-500 mt-1 font-mono">
                          {selectedCameraData.name} - {selectedCameraData.width || selectedCameraData.resolution?.width}x{selectedCameraData.height || selectedCameraData.resolution?.height}
                        </p>
                      </div>
                    </>
                  ) : (
                    <div className="text-center">
                      <VideoCameraIcon className="h-16 w-16 mx-auto text-surface-600" />
                      <p className="mt-3 text-surface-400 uppercase tracking-wider font-semibold">Camera Offline</p>
                      <button
                        onClick={() => handleStartStream(selectedCameraData.id)}
                        className="mt-4 btn-primary"
                      >
                        Start Stream
                      </button>
                    </div>
                  )}
                </div>

                {/* Advanced Detection Overlay */}
                {showOverlay && detectionDataList.length > 0 && (
                  <DetectionOverlay
                    detections={detectionDataList}
                    showLabels={true}
                    showLandmarks={showLandmarks}
                    showConfidence={true}
                    animated={true}
                  />
                )}

                {/* Live indicator */}
                {selectedCameraData.status === 'active' && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/90 text-white text-sm font-semibold uppercase tracking-wider">
                    <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                    Live
                  </div>
                )}

                {/* Detection count badge */}
                {detectionDataList.length > 0 && (
                  <div className="absolute top-4 right-16 flex items-center gap-2 px-3 py-1.5 rounded-full bg-lynx-500/90 text-white text-sm font-semibold uppercase tracking-wider">
                    <EyeIcon className="h-4 w-4" />
                    {detectionDataList.length} Detected
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
                      <h3 className="font-semibold text-white uppercase tracking-wider">{selectedCameraData.name}</h3>
                      <p className="text-xs text-surface-500 font-mono">
                        {selectedCameraData.camera_type.toUpperCase()} • Device Camera
                      </p>
                    </div>
                    <div className="h-8 w-px bg-surface-800" />
                    <div className="text-sm">
                      <span className="text-surface-400 uppercase tracking-wider text-xs">Resolution: </span>
                      <span className="text-white font-mono">
                        {selectedCameraData.width || selectedCameraData.resolution?.width}x{selectedCameraData.height || selectedCameraData.resolution?.height}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="text-surface-400 uppercase tracking-wider text-xs">FPS: </span>
                      <span className="text-white font-mono">{selectedCameraData.fps}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm">
                      <span className="text-surface-400 uppercase tracking-wider text-xs">Detections: </span>
                      <span className="text-lynx-400 font-semibold font-mono">
                        {detectionDataList.length}
                      </span>
                    </div>
                    {selectedCameraData.status === 'active' ? (
                      <button
                        onClick={() => handleStopStream(selectedCameraData.id)}
                        className="btn-danger text-sm py-1.5 uppercase tracking-wider"
                      >
                        Stop Stream
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartStream(selectedCameraData.id)}
                        className="btn-primary text-sm py-1.5 uppercase tracking-wider"
                      >
                        Start Stream
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : !showBrowserCamera ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-12 text-center aspect-video flex flex-col items-center justify-center"
            >
              <VideoCameraIcon className="h-20 w-20 text-surface-600" />
              <h3 className="mt-4 text-xl font-semibold text-white uppercase tracking-wider">
                Select a Camera
              </h3>
              <p className="mt-2 text-surface-400 max-w-md">
                Choose a camera from the list to start viewing the live feed
                with real-time face detection overlays
              </p>
              <div className="mt-6 flex items-center gap-3">
                <button
                  onClick={() => setShowBrowserCamera(true)}
                  className="btn-primary flex items-center gap-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span className="uppercase tracking-wider">Add Browser Camera</span>
                </button>
              </div>
            </motion.div>
          ) : null}
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
              <div className="text-2xl font-bold text-white font-mono">
                {Array.from(detections.values()).flat().length}
              </div>
              <div className="text-xs text-surface-400 uppercase tracking-wider">Active Detections</div>
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
              <div className="text-2xl font-bold text-white font-mono">
                {Array.from(detections.values()).flat().filter(d => d.classification === 'known').length}
              </div>
              <div className="text-xs text-surface-400 uppercase tracking-wider">Known Faces</div>
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
              <div className="text-2xl font-bold text-white font-mono">
                {Array.from(detections.values()).flat().filter(d => d.classification === 'unknown').length}
              </div>
              <div className="text-xs text-surface-400 uppercase tracking-wider">Unknown Faces</div>
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
              <div className="text-2xl font-bold text-white font-mono">
                {Array.from(detections.values()).flat().filter(d => d.classification === 'flagged').length}
              </div>
              <div className="text-xs text-surface-400 uppercase tracking-wider">Flagged Alerts</div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
