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
import { Pagination } from '@/components'
import { sdk } from '@/sdk'
import { useFetch } from '@/hooks'
import { useStore } from '@/store'
import type { Recording } from '@/types'

type FilterStatus = 'all' | 'recording' | 'completed' | 'error'

export function Recordings() {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [currentPage, setCurrentPage] = useState(1)

  const { data: recordings, loading, refetch } = useFetch<Recording[]>(
    () => sdk.recordings.list(),
    []
  )

  const { pageSize, setPageSize } = useStore()

  const filteredRecordings = recordings?.filter(
    (r: Recording) => filter === 'all' || r.status === filter
  ) ?? []

  const totalPages = Math.ceil(filteredRecordings.length / pageSize)
  const paginatedRecordings = filteredRecordings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
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
      <div>
        <h1 className="text-2xl font-bold text-white">Recordings</h1>
        <p className="mt-1 text-surface-400">
          View and manage video recordings
        </p>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <FunnelIcon className="h-5 w-5 text-surface-500 flex-shrink-0" />
        {filterOptions.map((option) => (
          <button
            key={option.key}
            onClick={() => {
              setFilter(option.key)
              setCurrentPage(1)
            }}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors menu-item',
              filter === option.key
                ? 'bg-lynx-600 text-white'
                : 'bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700'
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-lynx-500 border-t-transparent rounded-full" />
        </div>
      ) : filteredRecordings.length === 0 ? (
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
            Recordings will appear here when cameras are streaming
          </p>
        </motion.div>
      ) : (
        <>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="space-y-3"
          >
            {paginatedRecordings.map((recording) => (
              <motion.div
                key={recording.id}
                variants={{
                  hidden: { opacity: 0, y: 10 },
                  show: { opacity: 1, y: 0 },
                }}
                className="card p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 card-hover"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <VideoCameraIcon className="h-5 w-5 text-surface-500 flex-shrink-0" />
                    <h3 className="font-semibold text-white truncate">
                      Camera {recording.camera_id.slice(0, 8)}
                    </h3>
                    <span
                      className={clsx(
                        'badge',
                        statusColors[recording.status as keyof typeof statusColors]
                      )}
                    >
                      {recording.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm text-surface-400">
                    <div>
                      <span className="text-surface-500">Started:</span>
                      <p>{format(new Date(recording.started_at), 'MMM dd, HH:mm')}</p>
                    </div>
                    <div>
                      <span className="text-surface-500">Duration:</span>
                      <p>{formatRecordingDuration(recording.duration_secs)}</p>
                    </div>
                    <div>
                      <span className="text-surface-500">Size:</span>
                      <p>{formatFileSize(recording.file_size_bytes)}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {recording.status === 'completed' && (
                    <button
                      onClick={() => handlePlay(recording.id)}
                      className="btn-secondary"
                      title="Play recording"
                    >
                      <PlayIcon className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(recording.id)}
                    className="btn-danger"
                    title="Delete recording"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              totalItems={filteredRecordings.length}
            />
          )}
        </>
      )}
    </div>
  )
}
