import { motion } from 'framer-motion'
import clsx from 'clsx'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string | React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
  trend?: {
    value: number
    positive?: boolean
  }
  variant?: 'default' | 'success' | 'warning' | 'danger'
  breakdown?: {
    label: string
    value: number
    color?: string
  }[]
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  breakdown,
}: StatCardProps) {
  const variants = {
    default: 'from-surface-800 to-surface-900',
    success: 'from-emerald-900/30 to-surface-900',
    warning: 'from-amber-900/30 to-surface-900',
    danger: 'from-red-900/30 to-surface-900',
  }

  const iconColors = {
    default: 'text-lynx-500',
    success: 'text-emerald-500',
    warning: 'text-amber-500',
    danger: 'text-red-500',
  }

  const accentColors = {
    default: 'border-lynx-500/30',
    success: 'border-emerald-500/30',
    warning: 'border-amber-500/30',
    danger: 'border-red-500/30',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'relative overflow-hidden rounded-2xl p-6',
        'bg-gradient-to-br border',
        variants[variant],
        accentColors[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* x.AI style: uppercase, tracking-wider, monospace */}
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-[0.2em] font-mono">
            {title}
          </p>
          <p className="mt-3 text-4xl font-bold text-white font-mono tracking-tight">
            {value}
          </p>
          {subtitle && (
            <div className="mt-2 text-sm text-surface-500 font-mono">
              {subtitle}
            </div>
          )}
          {breakdown && breakdown.length > 0 && (
            <div className="mt-3 flex items-center gap-3 text-xs font-mono">
              {breakdown.map((item, i) => (
                <span key={i} className="flex items-center gap-1.5">
                  <span className={clsx(
                    'w-1.5 h-1.5 rounded-full',
                    item.color || 'bg-lynx-500'
                  )} />
                  <span className="text-surface-400 uppercase tracking-wider">
                    {item.value} {item.label}
                  </span>
                </span>
              ))}
            </div>
          )}
          {trend && (
            <p
              className={clsx(
                'mt-2 text-sm font-mono font-medium',
                trend.positive ? 'text-emerald-400' : 'text-red-400'
              )}
            >
              {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {Icon && (
          <div
            className={clsx(
              'rounded-xl p-3 bg-surface-800/50',
              iconColors[variant]
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="absolute -right-4 -bottom-4 opacity-5">
        {Icon && <Icon className="h-32 w-32" />}
      </div>
    </motion.div>
  )
}
