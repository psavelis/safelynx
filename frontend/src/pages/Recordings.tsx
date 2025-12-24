import { useState } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { format, formatDuration, intervalToDuration } from 'date-fns'
import {
  FilmIcon,
  PlayIcon,
  TrashIcon,
  VideoCameraIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { sdk } from '@/sdk'
import { useFetch } from '@/hooks'
import type { Recording } from '@/types'

type FilterStatus = 'all' | 'recording' | 'completed' | 'error'

export function Recordings() {
  const [filter, setFilter] = useState<FilterStatus>('all')

  const { data: recordings, loading, refetch } = useFetch<Recording[]>(
    () => sdk.recordings.list(),
    []
  )

  const filteredRecordings = recordings?.filter(
    (r: Recording) => filter === 'all' || r.status === filter
  )

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this recording?')) {
      try {
        await sdk.recordings.delete(id)
        refetch()
      } catch (error) {
        console.error('Failed to delete recording:', error)
      }
    }
  }

  const handlePlay = (id: string) => {
    window.open(sdk.recordings.getPlayUrl(id), '_blank')
  }

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '—'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / 1024 / 1024).toFixed(1)} MB`
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
  }

  const formatRecordingDuration = (secs: number | null) => {
    if (!secs) return '—'
    const duration = intervalToDuration({ start: 0, end: secs * 1000 })
    return formatDuration(duration, { format: ['hours', 'minutes', 'seconds'] })
  }

  const statusColors = {
    recording: 'badge-danger',
    completed: 'badge-success',
    error: 'badge-warning',
  }

  const filterOptions: { key: FilterStatus; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'recording', label: 'Recording' },
    { key: 'completed', label: 'Completed' },
    { key: 'error', label: 'Error' },
  ]

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Recordings</h1>
          <p className="mt-1 text-surface-400">
            View and manage recorded video segments
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FunnelIcon className="h-5 w-5 text-surface-500" />
          {filterOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => setFilter(option.key)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                filter === option.key
                  ? 'bg-lynx-600 text-white'
                  : 'bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-lynx-500 border-t-transparent rounded-full" />
        </div>
      ) : !filteredRecordings || filteredRecordings.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-12 text-center"
        >
          <FilmIcon className="h-16 w-16 mx-auto text-surface-600" />
          <h3 className="mt-4 text-lg font-semibold text-white">
            No recordings found
          </h3>
          <p className="mt-2 text-surface-400">
            Recordings will appear here when detection-triggered recording is
            active
          </p>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="space-y-3"
        >
          {filteredRecordings.map((recording, index) => (
            <motion.div
              key={recording.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className="card p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-32 h-20 bg-surface-800 rounded-lg flex items-center justify-center border border-surface-700">
                  <VideoCameraIcon className="h-8 w-8 text-surface-600" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-white truncate">
                        Recording {format(new Date(recording.started_at), 'PPp')}
                      </h3>
                      <div className="mt-1 flex items-center gap-4 text-sm text-surface-400">
                        <span className="flex items-center gap-1.5">
                          <VideoCameraIcon className="h-4 w-4" />
                          Camera ID: {recording.camera_id.slice(0, 8)}...
                        </span>
                        <span>
                          Trigger: {recording.trigger_type}
                        </span>
                      </div>
                    </div>
                    <span
                      className={clsx('badge', statusColors[recording.status])}
                    >
                      {recording.status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-6 text-sm">
                    <div>
                      <span className="text-surface-500">Duration:</span>{' '}
                      <span className="text-white">
                        {formatRecordingDuration(recording.duration_secs)}
                      </span>
                    </div>
                    <div>
                      <span className="text-surface-500">Size:</span>{' '}
                      <span className="text-white">
                        {formatFileSize(recording.file_size_bytes)}
                      </span>
                    </div>
                    {recording.ended_at && (
                      <div>
                        <span className="text-surface-500">Ended:</span>{' '}
                        <span className="text-white">
                          {format(new Date(recording.ended_at), 'PPp')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {recording.status === 'completed' && (
                    <button
                      onClick={() => handlePlay(recording.id)}
                      className="btn-primary py-2 px-3"
                    >
                      <PlayIcon className="h-5 w-5" />
                      Play
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(recording.id)}
                    className="btn-danger py-2 px-3"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  )
}
