import { motion } from 'framer-motion'
import clsx from 'clsx'
import { UserIcon } from '@heroicons/react/24/outline'
import { formatDistanceToNow } from 'date-fns'
import type { Profile } from '@/types'

interface ProfileCardProps {
  profile: Profile
  onClick?: () => void
}

export function ProfileCard({ profile, onClick }: ProfileCardProps) {
  const classification = {
    trusted: { label: 'Trusted', class: 'badge-success' },
    known: { label: 'Known', class: 'badge-success' },
    unknown: { label: 'Unknown', class: 'badge-info' },
    flagged: { label: 'Flagged', class: 'badge-danger' },
  }[profile.classification]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="card card-hover p-4 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-4">
        <div className="relative flex-shrink-0">
          {profile.thumbnail_url ? (
            <img
              src={profile.thumbnail_url}
              alt={profile.name || 'Profile'}
              className="h-16 w-16 rounded-xl object-cover border border-surface-700"
            />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-surface-800 flex items-center justify-center border border-surface-700">
              <UserIcon className="h-8 w-8 text-surface-500" />
            </div>
          )}
          <div
            className={clsx(
              'absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-surface-900',
              {
                'bg-emerald-500': profile.classification === 'known' || profile.classification === 'trusted',
                'bg-surface-500': profile.classification === 'unknown',
                'bg-red-500': profile.classification === 'flagged',
              }
            )}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-white truncate">
              {profile.display_name || profile.name || 'Unknown Person'}
            </h3>
            <span className={clsx('badge', classification.class)}>
              {classification.label}
            </span>
          </div>

          <div className="mt-2 space-y-1">
            <p className="text-sm text-surface-400">
              {profile.sighting_count} sightings
            </p>
            <p className="text-xs text-surface-500">
              Last seen{' '}
              {formatDistanceToNow(new Date(profile.last_seen_at), {
                addSuffix: true,
              })}
            </p>
          </div>

          {profile.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 text-xs rounded-full bg-surface-800 text-surface-300"
                >
                  {tag}
                </span>
              ))}
              {profile.tags.length > 3 && (
                <span className="px-2 py-0.5 text-xs rounded-full bg-surface-800 text-surface-500">
                  +{profile.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
