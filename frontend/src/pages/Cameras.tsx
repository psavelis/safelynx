import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { PlusIcon, VideoCameraIcon } from '@heroicons/react/24/outline'
import { CameraPreview } from '@/components'
import { sdk } from '@/sdk'
import type { Camera } from '@/types'
import { useFetch } from '@/hooks'
import { useStore } from '@/store'

export function Cameras() {
  const { data: cameras, loading, refetch } = useFetch<Camera[]>(
    () => sdk.cameras.list(),
    []
  )

  const { setCameras, activeDetections } = useStore()

  useEffect(() => {
    if (cameras) {
      setCameras(cameras)
    }
  }, [cameras, setCameras])

  const handleStartStream = async (cameraId: string) => {
    try {
      await sdk.cameras.startStream(cameraId)
      refetch()
    } catch (error) {
      console.error('Failed to start stream:', error)
    }
  }

  const handleStopStream = async (cameraId: string) => {
    try {
      await sdk.cameras.stopStream(cameraId)
      refetch()
    } catch (error) {
      console.error('Failed to stop stream:', error)
    }
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cameras</h1>
          <p className="mt-1 text-surface-400">
            Manage and monitor connected cameras
          </p>
        </div>
        <button className="btn-primary">
          <PlusIcon className="h-5 w-5" />
          Add Camera
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-lynx-500 border-t-transparent rounded-full" />
        </div>
      ) : cameras?.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-12 text-center"
        >
          <VideoCameraIcon className="h-16 w-16 mx-auto text-surface-600" />
          <h3 className="mt-4 text-lg font-semibold text-white">
            No cameras configured
          </h3>
          <p className="mt-2 text-surface-400">
            Add your first camera to start monitoring
          </p>
          <button className="mt-6 btn-primary">
            <PlusIcon className="h-5 w-5" />
            Add Camera
          </button>
        </motion.div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {cameras?.map((camera) => (
            <CameraPreview
              key={camera.id}
              camera={camera}
              detection={activeDetections.get(camera.id)}
              showControls
              onClick={() => {
                if (camera.streaming) {
                  handleStopStream(camera.id)
                } else {
                  handleStartStream(camera.id)
                }
              }}
            />
          ))}
        </motion.div>
      )}
    </div>
  )
}
