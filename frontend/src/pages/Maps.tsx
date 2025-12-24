import { useState, useEffect, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  MapPinIcon,
  CameraIcon,
  UserGroupIcon,
  FireIcon,
  ChevronRightIcon,
  AdjustmentsHorizontalIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { format, subHours, subDays } from 'date-fns'
import clsx from 'clsx'
import { HeatmapCanvas, HeatmapLegend } from '@/components'
import { useStore } from '@/store'
import { useCameraSync } from '@/hooks'
import type { Camera, Sighting } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7889'

interface LocationStats {
  camera_id: string
  camera_name: string
  location: { latitude: number; longitude: number; name: string | null } | null
  sighting_count: number
  unique_profiles: number
  last_activity: string | null
}

type TimeRange = '1h' | '24h' | '7d' | '30d'

export function Maps() {
  const [cameras, setCameras] = useState<Camera[]>([])
  const [locationStats, setLocationStats] = useState<LocationStats[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCamera, setSelectedCamera] = useState<string | null>(null)
  const [timeRange, setTimeRange] = useState<TimeRange>('24h')
  const [view, setView] = useState<'map' | 'heatmap'>('map')
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [mapDimensions, setMapDimensions] = useState({ width: 600, height: 400 })

  // Get streaming cameras from store (includes browser cameras)
  const { streamingCameras } = useStore()

  // Sync device cameras to global store for consistent tracking
  useCameraSync(cameras)

  useEffect(() => {
    fetchData()
  }, [timeRange])

  useEffect(() => {
    const updateDimensions = () => {
      if (mapContainerRef.current) {
        setMapDimensions({
          width: mapContainerRef.current.offsetWidth,
          height: mapContainerRef.current.offsetHeight,
        })
      }
    }
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      const camerasRes = await fetch(`${API_URL}/api/v1/cameras`)
      if (camerasRes.ok) {
        const data = await camerasRes.json()
        setCameras(data.cameras || [])
      }

      const now = new Date()
      let since: Date
      switch (timeRange) {
        case '1h': since = subHours(now, 1); break
        case '24h': since = subHours(now, 24); break
        case '7d': since = subDays(now, 7); break
        case '30d': since = subDays(now, 30); break
      }

      const sightingsRes = await fetch(
        `${API_URL}/api/v1/sightings?since=${since.toISOString()}&limit=1000`
      )
      if (sightingsRes.ok) {
        const data = await sightingsRes.json()
        const sightings: Sighting[] = data.sightings || []
        
        const statsMap = new Map<string, LocationStats & { _profiles: Set<string> }>()
        for (const sighting of sightings) {
          const existing = statsMap.get(sighting.camera_id)
          if (existing) {
            existing.sighting_count++
            existing._profiles.add(sighting.profile_id)
            existing.unique_profiles = existing._profiles.size
            if (!existing.last_activity || new Date(sighting.detected_at) > new Date(existing.last_activity)) {
              existing.last_activity = sighting.detected_at
            }
          } else {
            const camera = cameras.find((c) => c.id === sighting.camera_id)
            statsMap.set(sighting.camera_id, {
              camera_id: sighting.camera_id,
              camera_name: camera?.name || 'Unknown Camera',
              location: camera?.location || null,
              sighting_count: 1,
              unique_profiles: 1,
              last_activity: sighting.detected_at,
              _profiles: new Set([sighting.profile_id]),
            })
          }
        }
        
        setLocationStats(Array.from(statsMap.values()))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const maxSightings = useMemo(() => {
    return Math.max(...locationStats.map((s) => s.sighting_count), 1)
  }, [locationStats])

  // Combine device cameras from API with browser cameras from store
  const allCamerasForHeatmap = useMemo(() => {
    const deviceCams = cameras.map(c => ({
      id: c.id,
      name: c.name,
      source: 'device' as const,
      location: c.location,
      status: c.status,
    }))

    // Add browser cameras that aren't already in device list
    const browserCams = Array.from(streamingCameras.values())
      .filter(c => c.source === 'browser' && !cameras.some(dc => dc.id === c.cameraId))
      .map(c => ({
        id: c.cameraId,
        name: c.cameraName,
        source: 'browser' as const,
        location: c.location ? { latitude: c.location.latitude, longitude: c.location.longitude, name: c.location.name || null } : null,
        status: 'active' as const,
      }))

    return [...deviceCams, ...browserCams]
  }, [cameras, streamingCameras])

  // Check if there are no sightings (all zero values)
  const hasNoActivity = useMemo(() => {
    return locationStats.every(s => s.sighting_count === 0) || locationStats.length === 0
  }, [locationStats])

  const heatmapPoints = useMemo(() => {
    return allCamerasForHeatmap.map((camera, index) => {
      const stats = locationStats.find((s) => s.camera_id === camera.id)
      const row = Math.floor(index / 3)
      const col = index % 3
      return {
        x: (15 + col * 35) / 100,
        y: (20 + row * 30) / 100,
        value: stats?.sighting_count || 0,
        label: camera.name,
      }
    })
  }, [allCamerasForHeatmap, locationStats])

  const getIntensityColor = (count: number) => {
    const intensity = count / maxSightings
    if (intensity > 0.8) return 'bg-red-500'
    if (intensity > 0.6) return 'bg-orange-500'
    if (intensity > 0.4) return 'bg-yellow-500'
    if (intensity > 0.2) return 'bg-emerald-500'
    return 'bg-blue-500'
  }

  const timeRangeOptions: { value: TimeRange; label: string }[] = [
    { value: '1h', label: 'Last Hour' },
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
  ]

  const totalSightings = locationStats.reduce((sum, s) => sum + s.sighting_count, 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <MapPinIcon className="h-8 w-8 text-lynx-400" />
            Location Insights
          </h1>
          <p className="mt-1 text-surface-400">
            View activity distribution and heatmaps across camera locations
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-surface-700 overflow-hidden">
            <button
              onClick={() => setView('map')}
              className={clsx(
                'px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2 menu-item',
                view === 'map'
                  ? 'bg-lynx-600 text-white'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              <MapPinIcon className="h-4 w-4" />
              Map
            </button>
            <button
              onClick={() => setView('heatmap')}
              className={clsx(
                'px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2 menu-item',
                view === 'heatmap'
                  ? 'bg-lynx-600 text-white'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              <FireIcon className="h-4 w-4" />
              Heatmap
            </button>
          </div>

          {/* Time Range */}
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="input py-2"
          >
            {timeRangeOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/10">
              <CameraIcon className="h-6 w-6 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white font-mono">{cameras.length}</p>
              <p className="text-sm text-surface-400 uppercase tracking-wider">Cameras</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="card p-4"
        >
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-emerald-500/10">
              <UserGroupIcon className="h-6 w-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white font-mono">{totalSightings}</p>
              <p className="text-sm text-surface-400 uppercase tracking-wider">Detections</p>
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
            <div className="p-3 rounded-xl bg-purple-500/10">
              <FireIcon className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white font-mono">
                {locationStats.filter((s) => s.sighting_count > 0).length}
              </p>
              <p className="text-sm text-surface-400 uppercase tracking-wider">Active</p>
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
            <div className="p-3 rounded-xl bg-amber-500/10">
              <ClockIcon className="h-6 w-6 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white font-mono">
                {timeRangeOptions.find((o) => o.value === timeRange)?.label.split(' ')[1]}
              </p>
              <p className="text-sm text-surface-400 uppercase tracking-wider">Time Range</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map / Heatmap View */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="lg:col-span-2 card p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4 uppercase tracking-wider">
            {view === 'map' ? 'Camera Locations' : 'Activity Heatmap'}
          </h3>

          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-lynx-500"></div>
            </div>
          ) : cameras.length === 0 && allCamerasForHeatmap.length === 0 ? (
            <div className="h-96 flex flex-col items-center justify-center text-surface-400">
              <CameraIcon className="h-16 w-16 mb-4" />
              <p className="uppercase tracking-wider font-semibold">No cameras configured</p>
              <p className="text-sm mt-2">Add cameras to see location data</p>
            </div>
          ) : (
            <div 
              ref={mapContainerRef}
              className="relative h-96 bg-surface-800/50 rounded-xl overflow-hidden"
            >
              {/* Grid Background */}
              <div className="absolute inset-0 grid grid-cols-12 grid-rows-8 opacity-20">
                {Array.from({ length: 96 }).map((_, i) => (
                  <div key={i} className="border border-lynx-500/20" />
                ))}
              </div>

              {view === 'heatmap' && heatmapPoints.length > 0 && (
                <HeatmapCanvas
                  points={heatmapPoints}
                  width={mapDimensions.width}
                  height={mapDimensions.height}
                  radius={60}
                  blur={20}
                  maxOpacity={0.7}
                  showEmptyPoints={true}
                />
              )}

              {/* Camera Points */}
              <div className="absolute inset-4">
                {allCamerasForHeatmap.map((camera, index) => {
                  const stats = locationStats.find((s) => s.camera_id === camera.id)
                  const row = Math.floor(index / 3)
                  const col = index % 3
                  const x = 15 + col * 35
                  const y = 20 + row * 30

                  return (
                    <motion.div
                      key={camera.id}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: index * 0.1 }}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                      style={{ left: `${x}%`, top: `${y}%` }}
                      onClick={() => setSelectedCamera(camera.id === selectedCamera ? null : camera.id)}
                    >
                      <div
                        className={clsx(
                          'relative p-3 rounded-full transition-all shadow-lg',
                          selectedCamera === camera.id
                            ? 'bg-lynx-500 scale-125 ring-2 ring-lynx-400 ring-offset-2 ring-offset-surface-900'
                            : stats && stats.sighting_count > 0
                            ? getIntensityColor(stats.sighting_count)
                            : 'bg-surface-600',
                          'hover:scale-110'
                        )}
                      >
                        <CameraIcon className="h-5 w-5 text-white" />
                        {stats && stats.sighting_count > 0 && (
                          <span className="absolute -top-1 -right-1 bg-white text-surface-900 text-xs font-bold font-mono rounded-full h-5 w-5 flex items-center justify-center">
                            {stats.sighting_count > 99 ? '99+' : stats.sighting_count}
                          </span>
                        )}
                        {/* Source indicator */}
                        {camera.source === 'browser' && (
                          <span className="absolute -bottom-1 -left-1 bg-purple-500 text-white text-[8px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                            B
                          </span>
                        )}
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        <span className="bg-surface-900 px-2 py-1 rounded text-xs text-white font-semibold uppercase tracking-wider">
                          {camera.name}
                          {camera.source === 'browser' && (
                            <span className="ml-1 text-purple-400">(Browser)</span>
                          )}
                        </span>
                      </div>
                    </motion.div>
                  )
                })}
              </div>

              {/* Legend */}
              {view === 'heatmap' ? (
                <HeatmapLegend max={maxSightings} label="Detections" showNoActivity={hasNoActivity} />
              ) : (
                <div className="absolute bottom-4 left-4 bg-surface-900/90 backdrop-blur-sm rounded-lg p-3">
                  <p className="text-xs text-surface-400 mb-2 uppercase tracking-wider font-semibold">Activity Level</p>
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-orange-500" />
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                    </div>
                    <span className="text-xs text-surface-400">Low → High</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {/* Camera List / Details */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="card p-6"
        >
          <h3 className="text-lg font-semibold text-white mb-4 uppercase tracking-wider">
            {selectedCamera ? 'Camera Details' : 'All Cameras'}
          </h3>

          {selectedCamera ? (
            (() => {
              const camera = cameras.find((c) => c.id === selectedCamera)
              const stats = locationStats.find((s) => s.camera_id === selectedCamera)
              
              if (!camera) return null

              return (
                <div className="space-y-4">
                  <button
                    onClick={() => setSelectedCamera(null)}
                    className="text-sm text-lynx-400 hover:text-lynx-300 uppercase tracking-wider font-semibold"
                  >
                    ← Back to all cameras
                  </button>

                  <div className="p-4 rounded-xl bg-surface-800/50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className={clsx(
                        'p-3 rounded-full',
                        camera.status === 'active' ? 'bg-emerald-500/20' : 'bg-surface-700'
                      )}>
                        <CameraIcon className={clsx(
                          'h-6 w-6',
                          camera.status === 'active' ? 'text-emerald-400' : 'text-surface-400'
                        )} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-white uppercase tracking-wider">{camera.name}</h4>
                        <span className={clsx(
                          'text-xs uppercase tracking-wider',
                          camera.status === 'active' ? 'text-emerald-400' : 'text-surface-400'
                        )}>
                          {camera.status === 'active' ? 'Online' : 'Offline'}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-surface-400 uppercase text-xs tracking-wider">Detections</span>
                        <span className="text-white font-bold font-mono">
                          {stats?.sighting_count || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-400 uppercase text-xs tracking-wider">Unique People</span>
                        <span className="text-white font-bold font-mono">
                          {stats?.unique_profiles || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-surface-400 uppercase text-xs tracking-wider">Last Activity</span>
                        <span className="text-white font-medium text-sm font-mono">
                          {stats?.last_activity
                            ? format(new Date(stats.last_activity), 'MMM d, h:mm a')
                            : 'N/A'}
                        </span>
                      </div>
                      {camera.location && (
                        <div className="flex justify-between">
                          <span className="text-surface-400 uppercase text-xs tracking-wider">Location</span>
                          <span className="text-white font-medium">
                            {camera.location.name || 'Set location'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()
          ) : (
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {cameras.length === 0 ? (
                <p className="text-surface-400 text-center py-8 uppercase tracking-wider">No cameras configured</p>
              ) : (
                cameras.map((camera) => {
                  const stats = locationStats.find((s) => s.camera_id === camera.id)
                  
                  return (
                    <motion.button
                      key={camera.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => setSelectedCamera(camera.id)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg bg-surface-800/50 hover:bg-surface-800 transition-colors text-left"
                    >
                      <div className={clsx(
                        'p-2 rounded-full',
                        stats && stats.sighting_count > 0
                          ? getIntensityColor(stats.sighting_count) + '/20'
                          : 'bg-surface-700'
                      )}>
                        <CameraIcon className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white truncate uppercase tracking-wider text-sm">{camera.name}</p>
                        <p className="text-sm text-surface-400 font-mono">
                          {stats?.sighting_count || 0} detections
                        </p>
                      </div>
                      <ChevronRightIcon className="h-5 w-5 text-surface-500" />
                    </motion.button>
                  )
                })
              )}
            </div>
          )}
        </motion.div>
      </div>

      {/* Instructions */}
      <div className="card p-4 bg-surface-800/30 border-dashed">
        <div className="flex items-start gap-3">
          <AdjustmentsHorizontalIcon className="h-5 w-5 text-lynx-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-surface-400">
            <p className="font-semibold text-surface-300 mb-1 uppercase tracking-wider">Location Setup</p>
            <p>
              To see cameras on a real map, add GPS coordinates to each camera in Settings → Cameras.
              The visualization above shows relative activity levels at each camera location.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
