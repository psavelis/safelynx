import { motion } from 'framer-motion'
import clsx from 'clsx'
import { VideoCameraIcon, SignalIcon } from '@heroicons/react/24/outline'
import type { Camera, FaceDetectedPayload } from '@/types'

interface CameraPreviewProps {
  camera: Camera
  detection?: FaceDetectedPayload
  onClick?: () => void
  showControls?: boolean
}

export function CameraPreview({
  camera,
  detection,
  onClick,
  showControls = false,
}: CameraPreviewProps) {
  const isOnline = camera.status === 'active'
  const isStreaming = camera.streaming || camera.status === 'active'
  const width = camera.width || camera.resolution?.width || 0
  const height = camera.height || camera.resolution?.height || 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      className="card card-hover overflow-hidden cursor-pointer"
      onClick={onClick}
    >
      <div className="relative aspect-video bg-surface-900">
        {isStreaming ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-surface-500">
              <VideoCameraIcon className="h-12 w-12 mx-auto mb-2 animate-pulse" />
              <p className="text-sm">Camera Feed</p>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-surface-600">
              <VideoCameraIcon className="h-12 w-12 mx-auto mb-2" />
              <p className="text-sm">Camera Offline</p>
            </div>
          </div>
        )}

        {detection && (
          <div
            className={clsx(
              'detection-overlay',
              detection.profile_id
                ? 'detection-known'
                : 'detection-unknown'
            )}
            style={{
              left: `${detection.bounding_box.x * 100}%`,
              top: `${detection.bounding_box.y * 100}%`,
              width: `${detection.bounding_box.width * 100}%`,
              height: `${detection.bounding_box.height * 100}%`,
            }}
          >
            <div className="absolute -top-6 left-0 text-xs font-medium text-white bg-surface-900/80 px-2 py-1 rounded">
              {detection.profile_name || 'Unknown'}{' '}
              <span className="text-surface-400">
                {Math.round(detection.confidence * 100)}%
              </span>
            </div>
          </div>
        )}

        <div className="absolute top-3 left-3">
          <div
            className={clsx(
              'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
              isOnline
                ? 'bg-emerald-500/20 text-emerald-400'
                : 'bg-surface-700/80 text-surface-400'
            )}
          >
            <span
              className={clsx(
                'h-2 w-2 rounded-full',
                isOnline ? 'bg-emerald-500' : 'bg-surface-500'
              )}
            />
            {isOnline ? 'Live' : 'Offline'}
          </div>
        </div>

        {isStreaming && (
          <div className="absolute top-3 right-3">
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
              <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              REC
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">{camera.name}</h3>
            <p className="text-sm text-surface-400">
              {camera.camera_type.toUpperCase()} • {width}x{height}
            </p>
          </div>
          <div className="flex items-center gap-1 text-surface-500">
            <SignalIcon className="h-4 w-4" />
            <span className="text-xs">{camera.fps} FPS</span>
          </div>
        </div>

        {showControls && (
          <div className="mt-4 flex gap-2">
            <button className="btn-primary flex-1 text-sm py-2">
              {isStreaming ? 'Stop' : 'Start'} Stream
            </button>
            <button className="btn-secondary text-sm py-2 px-3">
              Configure
            </button>
          </div>
        )}
      </div>
    </motion.div>
  )
}
