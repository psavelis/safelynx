import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  UserIcon,
} from '@heroicons/react/24/outline'
import { ProfileCard } from '@/components'
import { sdk } from '@/sdk'
import { useFetch } from '@/hooks'
import { useStore } from '@/store'
import type { Profile } from '@/types'

type FilterType = 'all' | 'known' | 'unknown' | 'flagged'

export function Profiles() {
  const [filter, setFilter] = useState<FilterType>('all')
  const [search, setSearch] = useState('')

  const { data: profiles, loading } = useFetch<Profile[]>(
    () => sdk.profiles.list(200),
    []
  )

  const { setProfiles } = useStore()

  useEffect(() => {
    if (profiles) {
      setProfiles(profiles)
    }
  }, [profiles, setProfiles])

  const filteredProfiles = profiles?.filter((profile: Profile) => {
    const matchesFilter = filter === 'all' || profile.classification === filter
    const matchesSearch =
      !search ||
      profile.name?.toLowerCase().includes(search.toLowerCase()) ||
      profile.tags.some((tag) =>
        tag.toLowerCase().includes(search.toLowerCase())
      )
    return matchesFilter && matchesSearch
  })

  const filterOptions: { key: FilterType; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: profiles?.length ?? 0 },
    {
      key: 'known',
      label: 'Known',
      count: profiles?.filter((p) => p.classification === 'known').length ?? 0,
    },
    {
      key: 'unknown',
      label: 'Unknown',
      count: profiles?.filter((p) => p.classification === 'unknown').length ?? 0,
    },
    {
      key: 'flagged',
      label: 'Flagged',
      count: profiles?.filter((p) => p.classification === 'flagged').length ?? 0,
    },
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
        <h1 className="text-2xl font-bold text-white">Profiles</h1>
        <p className="mt-1 text-surface-400">
          View and manage detected faces
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-surface-500" />
          <input
            type="text"
            placeholder="Search by name or tag..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          <FunnelIcon className="h-5 w-5 text-surface-500 flex-shrink-0" />
          {filterOptions.map((option) => (
            <button
              key={option.key}
              onClick={() => setFilter(option.key)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors',
                filter === option.key
                  ? 'bg-lynx-600 text-white'
                  : 'bg-surface-800 text-surface-400 hover:text-white hover:bg-surface-700'
              )}
            >
              {option.label}
              <span className="ml-1.5 text-xs opacity-70">({option.count})</span>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-lynx-500 border-t-transparent rounded-full" />
        </div>
      ) : filteredProfiles?.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-12 text-center"
        >
          <UserIcon className="h-16 w-16 mx-auto text-surface-600" />
          <h3 className="mt-4 text-lg font-semibold text-white">
            No profiles found
          </h3>
          <p className="mt-2 text-surface-400">
            {search
              ? 'Try a different search term'
              : 'Profiles will appear here when faces are detected'}
          </p>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filteredProfiles?.map((profile) => (
            <ProfileCard key={profile.id} profile={profile} />
          ))}
        </motion.div>
      )}
    </div>
  )
}
