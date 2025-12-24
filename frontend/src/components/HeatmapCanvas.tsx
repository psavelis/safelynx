import { useRef, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'

interface HeatPoint {
  x: number
  y: number
  value: number
  label?: string
}

interface HeatmapCanvasProps {
  points: HeatPoint[]
  width: number
  height: number
  radius?: number
  blur?: number
  maxOpacity?: number
  minOpacity?: number // Show points even with 0 value
  gradient?: { [key: number]: string }
  showEmptyPoints?: boolean // Whether to show camera positions with 0 activity
}

export function HeatmapCanvas({
  points,
  width,
  height,
  radius = 40,
  blur = 15,
  maxOpacity = 0.8,
  minOpacity = 0.15, // Minimum visibility for 0-value points
  gradient = {
    0.0: 'rgba(0, 0, 255, 0)',
    0.2: 'rgba(0, 255, 255, 0.5)',
    0.4: 'rgba(0, 255, 0, 0.7)',
    0.6: 'rgba(255, 255, 0, 0.8)',
    0.8: 'rgba(255, 128, 0, 0.9)',
    1.0: 'rgba(255, 0, 0, 1)',
  },
  showEmptyPoints = true,
}: HeatmapCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const maxValue = useMemo(() => {
    return Math.max(...points.map(p => p.value), 1)
  }, [points])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, width, height)

    // If no points, exit early
    if (points.length === 0) return

    // Create gradient for the heatmap
    const gradientCanvas = document.createElement('canvas')
    gradientCanvas.width = 256
    gradientCanvas.height = 1
    const gradCtx = gradientCanvas.getContext('2d')!
    const grd = gradCtx.createLinearGradient(0, 0, 256, 0)
    
    Object.entries(gradient).forEach(([stop, color]) => {
      grd.addColorStop(parseFloat(stop), color)
    })
    
    gradCtx.fillStyle = grd
    gradCtx.fillRect(0, 0, 256, 1)
    const gradientData = gradCtx.getImageData(0, 0, 256, 1).data

    // Draw heatmap points
    const alphaCanvas = document.createElement('canvas')
    alphaCanvas.width = width
    alphaCanvas.height = height
    const alphaCtx = alphaCanvas.getContext('2d')!

    points.forEach(point => {
      // Calculate intensity - use minOpacity for 0-value points if showEmptyPoints is true
      let intensity = point.value / maxValue
      
      // Ensure minimum visibility for empty points
      if (showEmptyPoints && point.value === 0) {
        intensity = minOpacity / maxOpacity
      }
      
      const x = point.x * width
      const y = point.y * height

      // Create radial gradient for each point
      const radGrad = alphaCtx.createRadialGradient(x, y, 0, x, y, radius)
      radGrad.addColorStop(0, `rgba(0, 0, 0, ${intensity * maxOpacity})`)
      radGrad.addColorStop(1, 'rgba(0, 0, 0, 0)')

      alphaCtx.beginPath()
      alphaCtx.arc(x, y, radius, 0, Math.PI * 2)
      alphaCtx.fillStyle = radGrad
      alphaCtx.fill()
    })

    // Apply blur
    ctx.filter = `blur(${blur}px)`
    ctx.drawImage(alphaCanvas, 0, 0)
    ctx.filter = 'none'

    // Colorize based on gradient
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3]
      if (alpha > 0) {
        const gradientIndex = Math.min(255, Math.floor((alpha / 255) * 255))
        data[i] = gradientData[gradientIndex * 4]
        data[i + 1] = gradientData[gradientIndex * 4 + 1]
        data[i + 2] = gradientData[gradientIndex * 4 + 2]
        data[i + 3] = gradientData[gradientIndex * 4 + 3] * (alpha / 255)
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }, [points, width, height, radius, blur, maxOpacity, minOpacity, gradient, maxValue, showEmptyPoints])

  return (
    <motion.canvas
      ref={canvasRef}
      width={width}
      height={height}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="absolute inset-0 pointer-events-none"
    />
  )
}

interface HeatmapLegendProps {
  min?: number
  max: number
  label?: string
  showNoActivity?: boolean
}

export function HeatmapLegend({ min = 0, max, label = 'Activity', showNoActivity = false }: HeatmapLegendProps) {
  return (
    <div className="absolute bottom-4 left-4 bg-surface-900/90 backdrop-blur-sm rounded-lg p-4">
      <p className="text-xs text-surface-400 mb-2 uppercase tracking-wider font-semibold">
        {label}
      </p>
      <div className="flex items-center gap-2">
        <span className="text-xs text-surface-500">{min}</span>
        <div
          className="w-24 h-3 rounded-full"
          style={{
            background: 'linear-gradient(to right, rgba(59,130,246,0.5), rgba(34,197,94,0.7), rgba(234,179,8,0.8), rgba(249,115,22,0.9), rgba(239,68,68,1))'
          }}
        />
        <span className="text-xs text-surface-500">{max}+</span>
      </div>
      {showNoActivity && (
        <p className="text-xs text-surface-500 mt-2 italic">
          Camera positions shown (no activity yet)
        </p>
      )}
    </div>
  )
}
