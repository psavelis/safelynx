import { motion, AnimatePresence } from 'framer-motion'
import clsx from 'clsx'
import {
  UserIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

export interface DetectionData {
  id: string
  x: number
  y: number
  width: number
  height: number
  confidence: number
  profile_id?: string
  profile_name?: string
  classification?: 'known' | 'unknown' | 'flagged' | 'trusted'
  landmarks?: { x: number; y: number }[]
}

interface DetectionPolygonProps {
  detection: DetectionData
  showLabels?: boolean
  showLandmarks?: boolean
  showConfidence?: boolean
  animated?: boolean
  variant?: 'default' | 'minimal' | 'futuristic'
}

export function DetectionPolygon({
  detection,
  showLabels = true,
  showLandmarks = true,
  showConfidence = true,
  animated = true,
  variant = 'futuristic',
}: DetectionPolygonProps) {
  const getClassificationColor = () => {
    switch (detection.classification) {
      case 'flagged':
        return {
          border: 'border-red-500',
          bg: 'bg-red-500/10',
          label: 'bg-red-500',
          text: 'text-white',
          glow: 'shadow-red-500/50',
          gradient: 'from-red-500 to-red-700',
          accent: 'text-red-400',
        }
      case 'known':
        return {
          border: 'border-emerald-500',
          bg: 'bg-emerald-500/10',
          label: 'bg-emerald-500',
          text: 'text-white',
          glow: 'shadow-emerald-500/50',
          gradient: 'from-emerald-500 to-emerald-700',
          accent: 'text-emerald-400',
        }
      case 'trusted':
        return {
          border: 'border-blue-500',
          bg: 'bg-blue-500/10',
          label: 'bg-blue-500',
          text: 'text-white',
          glow: 'shadow-blue-500/50',
          gradient: 'from-blue-500 to-blue-700',
          accent: 'text-blue-400',
        }
      default:
        return {
          border: 'border-amber-500',
          bg: 'bg-amber-500/10',
          label: 'bg-amber-500',
          text: 'text-black',
          glow: 'shadow-amber-500/50',
          gradient: 'from-amber-500 to-amber-700',
          accent: 'text-amber-400',
        }
    }
  }

  const getIcon = () => {
    switch (detection.classification) {
      case 'flagged':
        return <ExclamationTriangleIcon className="h-3 w-3" />
      case 'known':
        return <CheckCircleIcon className="h-3 w-3" />
      case 'trusted':
        return <ShieldCheckIcon className="h-3 w-3" />
      default:
        return <UserIcon className="h-3 w-3" />
    }
  }

  const colors = getClassificationColor()

  const content = (
    <div
      className={clsx(
        'absolute border-2 rounded-lg transition-all duration-150',
        colors.border,
        colors.bg,
        detection.classification === 'flagged' && 'animate-pulse',
        animated && 'shadow-lg',
        animated && colors.glow
      )}
      style={{
        left: `${detection.x * 100}%`,
        top: `${detection.y * 100}%`,
        width: `${detection.width * 100}%`,
        height: `${detection.height * 100}%`,
      }}
    >
      {/* Detection Label */}
      {showLabels && (
        <div
          className={clsx(
            'absolute -top-7 left-0 flex items-center gap-1.5 px-2 py-1 rounded text-xs font-semibold whitespace-nowrap shadow-lg',
            colors.label,
            colors.text
          )}
        >
          {getIcon()}
          <span className="font-mono uppercase tracking-wider">
            {detection.profile_name || 'UNKNOWN'}
          </span>
          {showConfidence && (
            <span className="opacity-80 font-mono">
              {Math.round(detection.confidence * 100)}%
            </span>
          )}
        </div>
      )}

      {/* Corner brackets - tech look */}
      <div className={clsx('absolute -top-0.5 -left-0.5 w-4 h-4 border-t-2 border-l-2 rounded-tl-sm', colors.border)} />
      <div className={clsx('absolute -top-0.5 -right-0.5 w-4 h-4 border-t-2 border-r-2 rounded-tr-sm', colors.border)} />
      <div className={clsx('absolute -bottom-0.5 -left-0.5 w-4 h-4 border-b-2 border-l-2 rounded-bl-sm', colors.border)} />
      <div className={clsx('absolute -bottom-0.5 -right-0.5 w-4 h-4 border-b-2 border-r-2 rounded-br-sm', colors.border)} />

      {/* Crosshair center for futuristic variant */}
      {variant === 'futuristic' && (
        <>
          {/* Horizontal line */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-40" />
          {/* Vertical line */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-px h-8 bg-gradient-to-b from-transparent via-current to-transparent opacity-40" />
          {/* Center dot */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-current opacity-60" />
        </>
      )}

      {/* Scan line effect for active detection */}
      {animated && (
        <div className="absolute inset-0 overflow-hidden rounded-md">
          <div className={clsx(
            'absolute inset-x-0 h-px bg-gradient-to-r from-transparent to-transparent opacity-50 animate-scan',
            colors.accent
          )} style={{ backgroundImage: `linear-gradient(to right, transparent, currentColor, transparent)` }} />
        </div>
      )}

      {/* Pulsing border effect for flagged */}
      {detection.classification === 'flagged' && (
        <div className="absolute inset-0 rounded-lg border-2 border-red-500 animate-ping opacity-30" />
      )}

      {/* Facial landmarks overlay */}
      {showLandmarks && detection.landmarks && detection.landmarks.length > 0 && (
        <svg className="absolute inset-0 w-full h-full overflow-visible">
          {/* Landmark points */}
          {detection.landmarks.map((point, i) => (
            <circle
              key={i}
              cx={`${((point.x - detection.x) / detection.width) * 100}%`}
              cy={`${((point.y - detection.y) / detection.height) * 100}%`}
              r="3"
              className={clsx('fill-current opacity-80', colors.accent)}
            />
          ))}
          {/* Connect landmarks with lines for face mesh effect */}
          {detection.landmarks.length >= 5 && (
            <polyline
              points={detection.landmarks
                .map(p => `${((p.x - detection.x) / detection.width) * 100},${((p.y - detection.y) / detection.height) * 100}`)
                .join(' ')}
              className={clsx('stroke-current fill-none opacity-40', colors.accent)}
              strokeWidth="1"
              strokeLinejoin="round"
            />
          )}
        </svg>
      )}

      {/* Confidence bar */}
      {showConfidence && (
        <div className="absolute -bottom-3 left-0 right-0 h-1.5 bg-surface-800/80 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${detection.confidence * 100}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={clsx(
              'h-full',
              detection.confidence > 0.8 ? 'bg-emerald-500' :
              detection.confidence > 0.6 ? 'bg-amber-500' : 'bg-red-500'
            )}
          />
        </div>
      )}

      {/* ID badge in corner */}
      {variant === 'futuristic' && (
        <div className="absolute -bottom-1 -right-1 px-1 py-0.5 rounded text-[8px] font-mono bg-surface-900/80 text-surface-400 uppercase">
          {detection.id.slice(-6)}
        </div>
      )}
    </div>
  )

  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.15 }}
      >
        {content}
      </motion.div>
    )
  }

  return content
}

interface DetectionOverlayProps {
  detections: DetectionData[]
  showLabels?: boolean
  showLandmarks?: boolean
  showConfidence?: boolean
  animated?: boolean
  variant?: 'default' | 'minimal' | 'futuristic'
}

export function DetectionOverlay({
  detections,
  showLabels = true,
  showLandmarks = false,
  showConfidence = true,
  animated = true,
  variant = 'futuristic',
}: DetectionOverlayProps) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <AnimatePresence>
        {detections.map((detection) => (
          <DetectionPolygon
            key={detection.id}
            detection={detection}
            showLabels={showLabels}
            showLandmarks={showLandmarks}
            showConfidence={showConfidence}
            animated={animated}
            variant={variant}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
