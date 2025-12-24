import { useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  UserGroupIcon,
  VideoCameraIcon,
  EyeIcon,
  ExclamationTriangleIcon,
  CircleStackIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { StatCard, ActivityChart, StorageChart, ProfilesChart } from '@/components'
import { sdk } from '@/sdk'
import type { DashboardStats, ActivityChart as ActivityChartType } from '@/types'
import { useFetch } from '@/hooks'
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

  const { setDashboardStats } = useStore()

  useEffect(() => {
    if (stats) {
      setDashboardStats(stats)
    }
  }, [stats, setDashboardStats])

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
          subtitle={`${stats?.known_profiles ?? 0} known`}
          icon={UserGroupIcon}
        />
        <StatCard
          title="Active Cameras"
          value={statsLoading ? '—' : stats?.active_cameras ?? 0}
          subtitle={stats?.recording_active ? 'Recording active' : 'Standby'}
          icon={VideoCameraIcon}
          variant={stats?.recording_active ? 'success' : 'default'}
        />
        <StatCard
          title="Sightings Today"
          value={statsLoading ? '—' : stats?.total_sightings_today ?? 0}
          subtitle={`${stats?.total_sightings_week ?? 0} this week`}
          icon={EyeIcon}
        />
        <StatCard
          title="Flagged Profiles"
          value={statsLoading ? '—' : stats?.flagged_profiles ?? 0}
          subtitle="Requires attention"
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
              <h2 className="text-lg font-semibold text-white">
                Detection Activity
              </h2>
              <p className="text-sm text-surface-400">
                Sightings by classification over the past week
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-surface-500" />
              <span className="text-sm text-surface-500">Last 7 days</span>
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
              <div className="h-full flex items-center justify-center text-surface-500">
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
            <h2 className="text-lg font-semibold text-white">Storage</h2>
            <p className="text-sm text-surface-400">
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
            <span className="text-sm text-surface-500">
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
            <h2 className="text-lg font-semibold text-white">
              Profiles by Classification
            </h2>
            <p className="text-sm text-surface-400">
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
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-emerald-400">
                {stats?.known_profiles ?? 0}
              </div>
              <div className="text-xs text-surface-500">Known</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-surface-400">
                {stats?.unknown_profiles ?? 0}
              </div>
              <div className="text-xs text-surface-500">Unknown</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-red-400">
                {stats?.flagged_profiles ?? 0}
              </div>
              <div className="text-xs text-surface-500">Flagged</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="card p-6"
        >
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Quick Actions</h2>
            <p className="text-sm text-surface-400">
              Frequently used operations
            </p>
          </div>
          <div className="space-y-3">
            <button className="w-full btn-secondary justify-start">
              <VideoCameraIcon className="h-5 w-5" />
              Add New Camera
            </button>
            <button className="w-full btn-secondary justify-start">
              <UserGroupIcon className="h-5 w-5" />
              Import Known Faces
            </button>
            <button className="w-full btn-secondary justify-start">
              <ExclamationTriangleIcon className="h-5 w-5" />
              Review Flagged Profiles
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
