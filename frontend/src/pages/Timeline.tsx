import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { format } from 'date-fns'
import {
  CalendarIcon,
  ClockIcon,
  UserIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline'
import { sdk } from '@/sdk'
import { useFetch } from '@/hooks'
import type { TimelineEntry } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7889'

export function Timeline() {
  const navigate = useNavigate()
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('24h')

  const getTimeRange = () => {
    const now = new Date()
    const start = new Date()

    switch (period) {
      case '24h':
        start.setHours(now.getHours() - 24)
        break
      case '7d':
        start.setDate(now.getDate() - 7)
        break
      case '30d':
        start.setDate(now.getDate() - 30)
        break
    }

    return {
      start: start.toISOString(),
      end: now.toISOString(),
    }
  }

  const { start, end } = getTimeRange()

  const { data: timeline, loading } = useFetch<TimelineEntry[]>(
    () => sdk.analytics.getTimeline({ start, end, limit: 100 }),
    [period]
  )

  const groupedEvents = timeline?.reduce(
    (groups: Record<string, TimelineEntry[]>, event) => {
      const date = format(new Date(event.timestamp), 'yyyy-MM-dd')
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(event)
      return groups
    },
    {}
  )

  const periodOptions = [
    { key: '24h', label: 'Last 24 Hours' },
    { key: '7d', label: 'Last 7 Days' },
    { key: '30d', label: 'Last 30 Days' },
  ] as const

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Timeline</h1>
          <p className="mt-1 text-surface-400">
            Chronological view of all detections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-surface-500" />
          {periodOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => setPeriod(option.key)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                period === option.key
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
      ) : !timeline || timeline.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-12 text-center"
        >
          <ClockIcon className="h-16 w-16 mx-auto text-surface-600" />
          <h3 className="mt-4 text-lg font-semibold text-white">
            No events in this period
          </h3>
          <p className="mt-2 text-surface-400">
            Detection events will appear here as they occur
          </p>
        </motion.div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedEvents || {}).map(([date, events]) => (
            <motion.div
              key={date}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="text-sm font-semibold text-white">
                  {format(new Date(date), 'EEEE, MMMM d, yyyy')}
                </div>
                <div className="flex-1 h-px bg-surface-800" />
                <div className="text-xs text-surface-500">
                  {events.length} events
                </div>
              </div>

              <div className="space-y-3">
                {events.map((event, index) => (
                  <motion.div
                    key={`${event.timestamp}-${index}`}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="card p-4"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-shrink-0">
                        {event.thumbnail_url ? (
                          <img
                            src={`${API_URL}${event.thumbnail_url}`}
                            alt=""
                            className="h-12 w-12 rounded-lg object-cover border border-surface-700"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none'
                              e.currentTarget.nextElementSibling?.classList.remove('hidden')
                            }}
                          />
                        ) : null}
                        <div className={clsx(
                          "h-12 w-12 rounded-lg bg-surface-800 flex items-center justify-center border border-surface-700",
                          event.thumbnail_url ? "hidden" : ""
                        )}>
                          <UserIcon className="h-6 w-6 text-surface-500" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <button
                              onClick={() => event.profile_id && navigate(`/profiles/${event.profile_id}`)}
                              className={clsx(
                                "font-medium text-white",
                                event.profile_id && "hover:text-accent-400 transition-colors"
                              )}
                            >
                              {event.profile_name || 'Unknown Person'}
                            </button>
                            <span className="text-surface-500 mx-2">•</span>
                            <span className="text-surface-400">
                              {event.event_type === 'sighting'
                                ? 'Detected'
                                : event.event_type}
                            </span>
                          </div>
                          <span className="text-xs text-surface-500 whitespace-nowrap">
                            {format(new Date(event.timestamp), 'HH:mm:ss')}
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-2 text-sm text-surface-400">
                          <VideoCameraIcon className="h-4 w-4" />
                          <span>{event.camera_name}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
