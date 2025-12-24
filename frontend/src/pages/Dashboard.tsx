import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  UserGroupIcon,
  VideoCameraIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  CircleStackIcon,
  ClockIcon,
  ComputerDesktopIcon,
  DevicePhoneMobileIcon,
} from '@heroicons/react/24/outline'
import { StatCard, ActivityChart, StorageChart, ProfilesChart } from '@/components'
import { sdk } from '@/sdk'
import type { DashboardStats, ActivityChart as ActivityChartType, Camera } from '@/types'
import { useFetch, useCameraSync } from '@/hooks'
import { useStore } from '@/store'

export function Dashboard() {
  const { data: stats, loading: statsLoading } = useFetch<DashboardStats>(
    () => sdk.analytics.getDashboard(),
    []
  )

  const { data: chartData, loading: chartLoading } = useFetch<ActivityChartType>(
    () => sdk.analytics.getActivityChart('week', 'day'),
    []
  )

  const { data: cameras } = useFetch<Camera[]>(
    () => sdk.cameras.list(),
    []
  )

  const { setDashboardStats, streamingCameras } = useStore()

  // Sync backend/device cameras to global store
  useCameraSync(cameras)

  useEffect(() => {
    if (stats) {
      setDashboardStats(stats)
    }
  }, [stats, setDashboardStats])

  // Calculate active cameras breakdown
  const cameraStats = useMemo(() => {
    const cameraList = cameras || []
    
    // Device cameras: status === 'active' (backend-managed)
    const deviceActive = cameraList.filter(c => c.status === 'active').length
    
    // Browser cameras: tracked in client state via streamingCameras
    const browserActive = Array.from(streamingCameras.values()).filter(c => c.source === 'browser').length
    
    // Count recording cameras
    const deviceRecording = cameraList.filter(c => c.status === 'active').length
    const browserRecording = Array.from(streamingCameras.values()).filter(c => c.source === 'browser' && c.isRecording).length
    
    // Total active
    const total = deviceActive + browserActive
    
    // Check if any camera is actually recording
    const isRecording = (stats?.recording_active ?? false) || browserRecording > 0 || deviceRecording > 0

    return {
      total,
      deviceActive,
      browserActive,
      deviceRecording,
      browserRecording,
      isRecording,
      totalConfigured: cameraList.length,
    }
  }, [cameras, streamingCameras, stats?.recording_active])

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-surface-400">
          Real-time security monitoring and analytics
        </p>
      </div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          title="Total Profiles"
          value={statsLoading ? '—' : stats?.total_profiles ?? 0}
          subtitle={
            <span className="flex items-center gap-1">
              <span className="text-emerald-400">{stats?.known_profiles ?? 0}</span>
              <span>known</span>
              <span className="mx-1">·</span>
              <span className="text-surface-400">{stats?.unknown_profiles ?? 0}</span>
              <span>unknown</span>
            </span>
          }
          icon={UserGroupIcon}
        />
        <StatCard
          title="Active Cameras"
          value={statsLoading ? '—' : cameraStats.total}
          subtitle={
            cameraStats.total === 0 ? (
              <span className="text-surface-500 uppercase tracking-wider">No active feeds</span>
            ) : cameraStats.isRecording ? (
              <span className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-emerald-400 uppercase tracking-wider">Recording</span>
              </span>
            ) : (
              <span className="text-surface-500 uppercase tracking-wider">Standby</span>
            )
          }
          icon={VideoCameraIcon}
          variant={cameraStats.total > 0 ? 'success' : 'default'}
          breakdown={cameraStats.total > 0 ? [
            { label: 'device', value: cameraStats.deviceActive, color: 'bg-blue-500' },
            { label: 'browser', value: cameraStats.browserActive, color: 'bg-purple-500' },
          ] : undefined}
        />
        <StatCard
          title="Sightings Today"
          value={statsLoading ? '—' : stats?.total_sightings_today ?? 0}
          subtitle={
            <span>
              <span className="text-surface-400">{stats?.total_sightings_week ?? 0}</span>
              <span> this week</span>
            </span>
          }
          icon={EyeIcon}
        />
        <StatCard
          title="Flagged Profiles"
          value={statsLoading ? '—' : stats?.flagged_profiles ?? 0}
          subtitle={
            <span className="uppercase tracking-wider">
              {stats?.flagged_profiles ? 'Requires attention' : 'All clear'}
            </span>
          }
          icon={ExclamationTriangleIcon}
          variant={stats?.flagged_profiles ? 'danger' : 'default'}
        />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-2 card p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-white uppercase tracking-wider">
                Detection Activity
              </h2>
              <p className="text-sm text-surface-400 font-mono">
                Sightings by classification over the past week
              </p>
            </div>
            <div className="flex items-center gap-2 text-surface-500">
              <ClockIcon className="h-4 w-4" />
              <span className="text-sm font-mono uppercase tracking-wider">Last 7 days</span>
            </div>
          </div>
          <div className="h-64">
            {chartLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-lynx-500 border-t-transparent rounded-full" />
              </div>
            ) : chartData ? (
              <ActivityChart
                labels={chartData.labels}
                datasets={chartData.datasets}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-surface-500 font-mono uppercase tracking-wider">
                No data available
              </div>
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card p-6"
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white uppercase tracking-wider">Storage</h2>
            <p className="text-sm text-surface-400 font-mono">
              {stats?.storage_used_human ?? '0 GB'} of{' '}
              {Math.round((stats?.storage_total_bytes ?? 0) / 1024 / 1024 / 1024)} GB used
            </p>
          </div>
          <div className="h-48 flex items-center justify-center">
            {statsLoading ? (
              <div className="animate-spin h-8 w-8 border-2 border-lynx-500 border-t-transparent rounded-full" />
            ) : (
              <StorageChart
                used={stats?.storage_used_bytes ?? 0}
                total={stats?.storage_total_bytes ?? 1}
              />
            )}
          </div>
          <div className="mt-4 flex items-center justify-center gap-2">
            <CircleStackIcon className="h-4 w-4 text-surface-500" />
            <span className="text-sm text-surface-500 font-mono uppercase tracking-wider">
              {stats?.storage_percent_used?.toFixed(1) ?? 0}% capacity
            </span>
          </div>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="card p-6"
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white uppercase tracking-wider">
              Profiles by Classification
            </h2>
            <p className="text-sm text-surface-400 font-mono">
              Distribution of identified faces
            </p>
          </div>
          <div className="h-32">
            {statsLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="animate-spin h-8 w-8 border-2 border-lynx-500 border-t-transparent rounded-full" />
              </div>
            ) : (
              <ProfilesChart
                known={stats?.known_profiles ?? 0}
                unknown={stats?.unknown_profiles ?? 0}
                flagged={stats?.flagged_profiles ?? 0}
              />
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card p-6"
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white uppercase tracking-wider">
              Camera Sources
            </h2>
            <p className="text-sm text-surface-400 font-mono">
              Active feeds by source type
            </p>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/20">
                  <ComputerDesktopIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-white uppercase tracking-wider text-sm">Device</p>
                  <p className="text-xs text-surface-400 font-mono">Backend-managed cameras</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white font-mono">{cameraStats.deviceActive}</p>
                <p className="text-xs text-surface-500 font-mono uppercase tracking-wider">Active</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20">
                  <DevicePhoneMobileIcon className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="font-semibold text-white uppercase tracking-wider text-sm">Browser</p>
                  <p className="text-xs text-surface-400 font-mono">Remote client feeds</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white font-mono">{cameraStats.browserActive}</p>
                <p className="text-xs text-surface-500 font-mono uppercase tracking-wider">Active</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
