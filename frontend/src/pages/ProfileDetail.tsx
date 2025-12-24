import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeftIcon,
  UserIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
  CameraIcon,
  EyeIcon,
  CheckIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { format, formatDistanceToNow } from 'date-fns'
import clsx from 'clsx'
import type { Profile, Sighting, Camera } from '@/types'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7889'

interface ProfileDetailData extends Profile {
  recent_sightings?: Sighting[]
}

export function ProfileDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [profile, setProfile] = useState<ProfileDetailData | null>(null)
  const [sightings, setSightings] = useState<Sighting[]>([])
  const [cameras, setCameras] = useState<Camera[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editClassification, setEditClassification] = useState<Profile['classification']>('unknown')

  useEffect(() => {
    if (id) {
      fetchProfile()
      fetchSightings()
      fetchCameras()
    }
  }, [id])

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/profiles/${id}`)
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        setEditName(data.name || data.display_name || '')
        setEditNotes(data.notes || '')
        setEditClassification(data.classification)
      }
    } catch (error) {
      console.error('Error fetching profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchSightings = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/profiles/${id}/sightings?limit=50`)
      if (res.ok) {
        const data = await res.json()
        setSightings(data.sightings || [])
      }
    } catch (error) {
      console.error('Error fetching sightings:', error)
    }
  }

  const fetchCameras = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/cameras`)
      if (res.ok) {
        const data = await res.json()
        setCameras(data.cameras || [])
      }
    } catch (error) {
      console.error('Error fetching cameras:', error)
    }
  }

  const handleSave = async () => {
    try {
      const res = await fetch(`${API_URL}/api/v1/profiles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editName || null,
          notes: editNotes || null,
          classification: editClassification,
        }),
      })
      if (res.ok) {
        await fetchProfile()
        setEditing(false)
      }
    } catch (error) {
      console.error('Error updating profile:', error)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this profile? This action cannot be undone.')) {
      return
    }
    try {
      const res = await fetch(`${API_URL}/api/v1/profiles/${id}`, {
        method: 'DELETE',
      })
      if (res.ok) {
        navigate('/profiles')
      }
    } catch (error) {
      console.error('Error deleting profile:', error)
    }
  }

  const getCameraName = (cameraId: string) => {
    const camera = cameras.find((c) => c.id === cameraId)
    return camera?.name || 'Unknown Camera'
  }

  const classificationOptions = [
    { value: 'unknown', label: 'Unknown', icon: EyeIcon, color: 'text-blue-400' },
    { value: 'known', label: 'Known', icon: CheckIcon, color: 'text-emerald-400' },
    { value: 'trusted', label: 'Trusted', icon: ShieldCheckIcon, color: 'text-emerald-400' },
    { value: 'flagged', label: 'Flagged', icon: ExclamationTriangleIcon, color: 'text-red-400' },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-accent-500"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <UserIcon className="h-16 w-16 text-surface-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Profile Not Found</h2>
        <p className="text-surface-400 mb-4">The profile you're looking for doesn't exist.</p>
        <button onClick={() => navigate('/profiles')} className="btn-primary">
          Back to Profiles
        </button>
      </div>
    )
  }

  const thumbnailUrl = profile.thumbnail_url ? `${API_URL}${profile.thumbnail_url}` : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/profiles')}
          className="p-2 rounded-lg hover:bg-surface-800 transition-colors"
        >
          <ArrowLeftIcon className="h-5 w-5 text-surface-400" />
        </button>
        <h1 className="text-2xl font-bold text-white">Profile Details</h1>
      </div>

      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="card p-6"
      >
        <div className="flex flex-col md:flex-row gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={profile.name || profile.display_name}
                className="h-32 w-32 rounded-2xl object-cover border-2 border-surface-700"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                  e.currentTarget.nextElementSibling?.classList.remove('hidden')
                }}
              />
            ) : null}
            <div className={clsx(
              "h-32 w-32 rounded-2xl bg-surface-800 flex items-center justify-center border-2 border-surface-700",
              thumbnailUrl ? "hidden" : ""
            )}>
              <UserIcon className="h-16 w-16 text-surface-500" />
            </div>
          </div>

          {/* Details */}
          <div className="flex-1">
            {editing ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-surface-400 mb-1">Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Enter a name for this person"
                    className="input w-full max-w-md"
                  />
                </div>
                <div>
                  <label className="block text-sm text-surface-400 mb-1">Classification</label>
                  <div className="flex flex-wrap gap-2">
                    {classificationOptions.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => setEditClassification(opt.value as Profile['classification'])}
                        className={clsx(
                          'flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors',
                          editClassification === opt.value
                            ? 'border-accent-500 bg-accent-500/10'
                            : 'border-surface-700 hover:border-surface-600'
                        )}
                      >
                        <opt.icon className={clsx('h-4 w-4', opt.color)} />
                        <span className="text-sm">{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-surface-400 mb-1">Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Add notes about this person..."
                    rows={3}
                    className="input w-full"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={handleSave} className="btn-primary">
                    <CheckIcon className="h-4 w-4 mr-2" />
                    Save
                  </button>
                  <button onClick={() => setEditing(false)} className="btn-secondary">
                    <XMarkIcon className="h-4 w-4 mr-2" />
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {profile.name || profile.display_name}
                    </h2>
                    <div className="flex items-center gap-3 mt-2">
                      <span
                        className={clsx('badge', {
                          'badge-success': profile.classification === 'known' || profile.classification === 'trusted',
                          'badge-info': profile.classification === 'unknown',
                          'badge-danger': profile.classification === 'flagged',
                        })}
                      >
                        {profile.classification.charAt(0).toUpperCase() + profile.classification.slice(1)}
                      </span>
                      {profile.is_active && (
                        <span className="badge badge-success">Active</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(true)}
                      className="btn-secondary"
                    >
                      <PencilIcon className="h-4 w-4 mr-2" />
                      Edit
                    </button>
                    <button onClick={handleDelete} className="btn-danger">
                      <TrashIcon className="h-4 w-4 mr-2" />
                      Delete
                    </button>
                  </div>
                </div>

                {profile.notes && (
                  <p className="mt-4 text-surface-300">{profile.notes}</p>
                )}

                {profile.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {profile.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-3 py-1 text-sm rounded-full bg-surface-800 text-surface-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-surface-700">
          <div className="text-center">
            <div className="text-2xl font-bold text-white">{profile.sighting_count}</div>
            <div className="text-sm text-surface-400">Total Sightings</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-white">
              {format(new Date(profile.first_seen_at), 'MMM d, yyyy')}
            </div>
            <div className="text-sm text-surface-400">First Seen</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-white">
              {formatDistanceToNow(new Date(profile.last_seen_at), { addSuffix: true })}
            </div>
            <div className="text-sm text-surface-400">Last Seen</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-medium text-white">
              {new Set(sightings.map((s) => s.camera_id)).size}
            </div>
            <div className="text-sm text-surface-400">Cameras</div>
          </div>
        </div>
      </motion.div>

      {/* Recent Sightings */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Sightings</h3>
        {sightings.length === 0 ? (
          <p className="text-surface-400 text-center py-8">No sightings recorded yet.</p>
        ) : (
          <div className="space-y-4">
            {sightings.slice(0, 10).map((sighting) => (
              <motion.div
                key={sighting.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-4 p-4 rounded-lg bg-surface-800/50"
              >
                {sighting.snapshot_path ? (
                  <img
                    src={`${API_URL}/files/snapshots/${sighting.snapshot_path.split('/').pop()}`}
                    alt="Sighting"
                    className="h-16 w-16 rounded-lg object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="h-16 w-16 rounded-lg bg-surface-700 flex items-center justify-center">
                    <UserIcon className="h-8 w-8 text-surface-500" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm">
                    <CameraIcon className="h-4 w-4 text-surface-400" />
                    <span className="text-white">{getCameraName(sighting.camera_id)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm mt-1">
                    <ClockIcon className="h-4 w-4 text-surface-400" />
                    <span className="text-surface-400">
                      {format(new Date(sighting.detected_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-white">
                    {Math.round(sighting.confidence * 100)}%
                  </div>
                  <div className="text-xs text-surface-400">Confidence</div>
                </div>
              </motion.div>
            ))}
            {sightings.length > 10 && (
              <p className="text-center text-surface-400 text-sm pt-4">
                Showing 10 of {sightings.length} sightings
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
