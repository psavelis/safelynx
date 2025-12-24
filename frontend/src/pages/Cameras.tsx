import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import { PlusIcon, VideoCameraIcon, GlobeAltIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline'
import { CameraPreview, Pagination, BrowserCamera } from '@/components'
import { sdk } from '@/sdk'
import type { Camera } from '@/types'
import { useFetch } from '@/hooks'
import { useStore } from '@/store'

type ViewMode = 'local' | 'browser'

export function Cameras() {
  const [currentPage, setCurrentPage] = useState(1)
  const [viewMode, setViewMode] = useState<ViewMode>('local')

  const { data: cameras, loading, refetch } = useFetch<Camera[]>(
    () => sdk.cameras.list(),
    []
  )

  const { setCameras, activeDetections, pageSize, setPageSize } = useStore()

  useEffect(() => {
    if (cameras) {
      setCameras(cameras)
    }
  }, [cameras, setCameras])

  useEffect(() => {
    setCurrentPage(1)
  }, [])

  const cameraList = cameras || []
  const totalPages = Math.ceil(cameraList.length / pageSize)
  const paginatedCameras = cameraList.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Cameras</h1>
          <p className="mt-1 text-surface-400">
            Manage local and remote cameras
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex rounded-lg border border-surface-700 overflow-hidden">
            <button
              onClick={() => setViewMode('local')}
              className={clsx(
                'px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2 menu-item',
                viewMode === 'local'
                  ? 'bg-lynx-600 text-white'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              <ComputerDesktopIcon className="h-4 w-4" />
              Local
            </button>
            <button
              onClick={() => setViewMode('browser')}
              className={clsx(
                'px-4 py-2 text-sm font-semibold transition-colors flex items-center gap-2 menu-item',
                viewMode === 'browser'
                  ? 'bg-lynx-600 text-white'
                  : 'text-surface-400 hover:text-white'
              )}
            >
              <GlobeAltIcon className="h-4 w-4" />
              Remote / Browser
            </button>
          </div>
          <button className="btn-primary menu-item">
            <PlusIcon className="h-5 w-5" />
            Add Camera
          </button>
        </div>
      </div>

      {viewMode === 'browser' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <BrowserCamera
            onCameraRegistered={(id) => {
              console.log('Camera registered:', id)
              refetch()
            }}
            onDetection={(detection) => {
              console.log('Detection:', detection)
            }}
          />
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-white uppercase tracking-wider mb-4">
              Remote Access Setup
            </h3>
            <div className="space-y-4 text-surface-400 text-sm">
              <p>
                Use <span className="text-lynx-400 font-mono">ngrok</span> to expose your Safelynx server for remote camera access:
              </p>
              <div className="bg-surface-800 rounded-lg p-4 font-mono text-xs">
                <p className="text-surface-500"># Install ngrok</p>
                <p className="text-emerald-400">brew install ngrok</p>
                <p className="text-surface-500 mt-3"># Start tunnel to backend</p>
                <p className="text-emerald-400">ngrok http 7889</p>
                <p className="text-surface-500 mt-3"># Start tunnel to frontend</p>
                <p className="text-emerald-400">ngrok http 7900</p>
              </div>
              <p>
                Then update <span className="text-lynx-400 font-mono">VITE_API_URL</span> in your environment to point to the ngrok URL.
              </p>
              <div className="bg-surface-800 rounded-lg p-4 font-mono text-xs">
                <p className="text-surface-500"># Set API URL (replace with your ngrok URL)</p>
                <p className="text-emerald-400">export VITE_API_URL=https://abc123.ngrok.io</p>
              </div>
              <p className="text-amber-400">
                Note: For HTTPS cameras, the browser requires a secure context. Use ngrok's HTTPS URLs.
              </p>
            </div>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-2 border-lynx-500 border-t-transparent rounded-full" />
        </div>
      ) : cameraList.length === 0 ? (
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
            Add your first camera or use remote browser access
          </p>
          <div className="mt-6 flex gap-3 justify-center">
            <button className="btn-primary menu-item">
              <PlusIcon className="h-5 w-5" />
              Add Local Camera
            </button>
            <button 
              onClick={() => setViewMode('browser')}
              className="btn-secondary menu-item"
            >
              <GlobeAltIcon className="h-5 w-5" />
              Add Browser Camera
            </button>
          </div>
        </motion.div>
      ) : (
        <>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {paginatedCameras.map((camera) => (
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

          {totalPages > 1 && (
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
              totalItems={cameraList.length}
            />
          )}
        </>
      )}
    </div>
  )
}
