import { motion } from 'framer-motion'
import clsx from 'clsx'

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: React.ComponentType<{ className?: string }>
  trend?: {
    value: number
    positive?: boolean
  }
  variant?: 'default' | 'success' | 'warning' | 'danger'
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={clsx(
        'relative overflow-hidden rounded-2xl p-6',
        'bg-gradient-to-br border border-surface-800',
        variants[variant]
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-surface-400">{title}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          {subtitle && (
            <p className="mt-1 text-sm text-surface-500">{subtitle}</p>
          )}
          {trend && (
            <p
              className={clsx(
                'mt-2 text-sm font-medium',
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
