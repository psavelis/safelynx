import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MapPinIcon,
  CircleStackIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ServerIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'

// Camera is handled by backend (macOS/nokhwa), not browser
export type PermissionType = 'backend' | 'location' | 'storage'

export interface PermissionStatus {
  backend: 'granted' | 'denied' | 'checking' | 'unsupported'
  location: PermissionState | 'unsupported'
  storage: PermissionState | 'unsupported'
}

interface PermissionDialogProps {
  isOpen: boolean
  onClose: () => void
  onPermissionsChange?: (status: PermissionStatus) => void
}

const permissionConfig = {
  backend: {
    title: 'Backend Camera Access',
    description: 'Camera is controlled by the backend service (macOS system permissions)',
    icon: ServerIcon,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    autoCheck: true, // Backend permissions are system-level, not browser-level
  },
  location: {
    title: 'Location Access',
    description: 'Optional - enables location tagging for detections',
    icon: MapPinIcon,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    autoCheck: false,
  },
  storage: {
    title: 'Storage Access',
    description: 'Required for saving recordings and snapshots',
    icon: CircleStackIcon,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    autoCheck: false,
  },
}

export function PermissionDialog({ isOpen, onClose, onPermissionsChange }: PermissionDialogProps) {
  const [permissions, setPermissions] = useState<PermissionStatus>({
    backend: 'checking',
    location: 'prompt',
    storage: 'prompt',
  })
  const [requesting, setRequesting] = useState<PermissionType | null>(null)

  const checkPermissions = useCallback(async () => {
    const status: PermissionStatus = {
      backend: 'checking',
      location: 'prompt',
      storage: 'prompt',
    }

    // Check backend camera status by calling the API
    // Camera permission is handled by macOS at the system level when the backend starts
    try {
      const response = await fetch('http://127.0.0.1:7889/api/v1/cameras')
      if (response.ok) {
        const cameras = await response.json()
        // If we have cameras and at least one is active, backend has camera access
        status.backend = cameras.length > 0 ? 'granted' : 'denied'
      } else {
        status.backend = 'denied'
      }
    } catch {
      // Backend not reachable
      status.backend = 'denied'
    }

    // Check location permission (optional browser feature)
    try {
      if (navigator.permissions) {
        const locationResult = await navigator.permissions.query({ name: 'geolocation' })
        status.location = locationResult.state
      }
    } catch {
      status.location = 'unsupported'
    }

    // Storage API (Persistent storage)
    try {
      if (navigator.storage && navigator.storage.persisted) {
        const isPersisted = await navigator.storage.persisted()
        status.storage = isPersisted ? 'granted' : 'prompt'
      } else {
        status.storage = 'unsupported'
      }
    } catch {
      status.storage = 'unsupported'
    }

    setPermissions(status)
    onPermissionsChange?.(status)
  }, [onPermissionsChange])

  useEffect(() => {
    if (isOpen) {
      checkPermissions()
    }
  }, [isOpen, checkPermissions])

  const requestPermission = async (type: PermissionType) => {
    setRequesting(type)

    try {
      switch (type) {
        case 'backend':
          // Backend camera permission is granted at macOS system level
          // We can only check if it's working, not request it from browser
          await checkPermissions()
          break

        case 'location':
          await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              enableHighAccuracy: false,
            })
          })
          setPermissions(prev => ({ ...prev, location: 'granted' }))
          break

        case 'storage':
          if (navigator.storage && navigator.storage.persist) {
            const granted = await navigator.storage.persist()
            setPermissions(prev => ({ ...prev, storage: granted ? 'granted' : 'denied' }))
          }
          break
      }
    } catch (error) {
      console.error(`Failed to request ${type} permission:`, error)
      if (type !== 'backend') {
        setPermissions(prev => ({ ...prev, [type]: 'denied' }))
      }
    } finally {
      setRequesting(null)
      await checkPermissions()
    }
  }

  const getStatusIcon = (status: PermissionState | 'unsupported' | 'checking') => {
    switch (status) {
      case 'granted':
        return <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
      case 'denied':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
      case 'unsupported':
        return <XMarkIcon className="h-5 w-5 text-surface-500" />
      case 'checking':
        return (
          <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )
      default:
        return null
    }
  }

  const getStatusLabel = (status: PermissionState | 'unsupported' | 'checking') => {
    switch (status) {
      case 'granted':
        return 'Connected'
      case 'denied':
        return 'Not available'
      case 'prompt':
        return 'Not requested'
      case 'unsupported':
        return 'Not supported'
      case 'checking':
        return 'Checking...'
    }
  }

  const allGranted = permissions.backend === 'granted' && permissions.storage !== 'denied'

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-surface-950/80 backdrop-blur-sm"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="w-full max-w-lg bg-surface-900 rounded-2xl shadow-2xl border border-surface-700 overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-surface-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">System Status</h2>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-surface-800 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5 text-surface-400" />
                </button>
              </div>
              <p className="mt-2 text-surface-400">
                Safelynx checks the backend service and optional browser permissions.
              </p>
            </div>

            {/* Permission List */}
            <div className="p-4 space-y-3">
              {(Object.keys(permissionConfig) as PermissionType[]).map((type) => {
                const config = permissionConfig[type]
                const status = permissions[type]
                const isRequesting = requesting === type
                const isAutoCheck = config.autoCheck

                return (
                  <motion.div
                    key={type}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 p-4 rounded-xl bg-surface-800/50"
                  >
                    <div className={clsx('p-3 rounded-xl', config.bgColor)}>
                      <config.icon className={clsx('h-6 w-6', config.color)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-white">{config.title}</h3>
                      <p className="text-sm text-surface-400">{config.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {getStatusIcon(status)}
                      {!isAutoCheck && status === 'prompt' ? (
                        <button
                          onClick={() => requestPermission(type)}
                          disabled={isRequesting}
                          className={clsx(
                            'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                            isRequesting
                              ? 'bg-surface-700 text-surface-400'
                              : 'bg-accent-500 text-white hover:bg-accent-600'
                          )}
                        >
                          {isRequesting ? 'Requesting...' : 'Allow'}
                        </button>
                      ) : (
                        <span
                          className={clsx(
                            'text-sm font-medium',
                            status === 'granted' && 'text-emerald-400',
                            (status === 'denied' || status === 'unsupported') && 'text-red-400',
                            status === 'checking' && 'text-blue-400',
                            status === 'prompt' && 'text-surface-400'
                          )}
                        >
                          {getStatusLabel(status)}
                        </span>
                      )}
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-surface-700 bg-surface-800/30">
              <div className="flex items-center justify-between">
                <p className="text-sm text-surface-400">
                  {allGranted
                    ? '✓ All required permissions granted'
                    : 'Some permissions are still needed'}
                </p>
                <button
                  onClick={onClose}
                  className={clsx(
                    'px-6 py-2 rounded-lg font-medium transition-colors',
                    allGranted
                      ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                      : 'bg-surface-700 text-surface-300 hover:bg-surface-600'
                  )}
                >
                  {allGranted ? 'Continue' : 'Skip for now'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Hook to check if permissions dialog should be shown
export function usePermissions() {
  const [showDialog, setShowDialog] = useState(false)
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null)

  useEffect(() => {
    // Check if we've already asked for permissions
    const hasAsked = localStorage.getItem('safelynx-permissions-asked')
    if (!hasAsked) {
      // Show dialog on first visit
      setShowDialog(true)
    }
  }, [])

  const handleClose = () => {
    localStorage.setItem('safelynx-permissions-asked', 'true')
    setShowDialog(false)
  }

  const handlePermissionsChange = (status: PermissionStatus) => {
    setPermissions(status)
  }

  return {
    showDialog,
    permissions,
    openDialog: () => setShowDialog(true),
    closeDialog: handleClose,
    handlePermissionsChange,
  }
}
