import { NavLink, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import clsx from 'clsx'
import {
  HomeIcon,
  VideoCameraIcon,
  UserGroupIcon,
  ClockIcon,
  FilmIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  SignalIcon,
  EyeIcon,
  MapPinIcon,
} from '@heroicons/react/24/outline'
import { useStore } from '@/store'

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Live View', href: '/live', icon: EyeIcon },
  { name: 'Cameras', href: '/cameras', icon: VideoCameraIcon },
  { name: 'Profiles', href: '/profiles', icon: UserGroupIcon },
  { name: 'Timeline', href: '/timeline', icon: ClockIcon },
  { name: 'Recordings', href: '/recordings', icon: FilmIcon },
  { name: 'Maps', href: '/maps', icon: MapPinIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { wsConnected, cameras, streamingCameras } = useStore()

  // Calculate active camera count for sidebar
  const deviceActive = cameras.filter(c => c.status === 'active').length
  const browserActive = Array.from(streamingCameras.values()).filter(c => c.source === 'browser').length
  const totalActive = deviceActive + browserActive

  return (
    <div className="flex h-screen bg-surface-950">
      <aside className="hidden lg:flex lg:flex-shrink-0">
        <div className="flex w-64 flex-col">
          <div className="flex min-h-0 flex-1 flex-col glass border-r border-surface-800">
            <div className="flex flex-1 flex-col overflow-y-auto pb-4">
              {/* Logo - x.AI style */}
              <div className="flex items-center gap-3 px-6 py-5 border-b border-surface-800">
                <div className="relative">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-lynx-500 to-lynx-700 shadow-lg shadow-lynx-600/30">
                    <ShieldCheckIcon className="h-6 w-6 text-white" />
                  </div>
                  <div
                    className={clsx(
                      'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-surface-900',
                      wsConnected ? 'bg-emerald-500' : 'bg-surface-500'
                    )}
                  />
                </div>
                <div>
                  <h1 className="text-lg font-bold gradient-text font-mono tracking-tight">SAFELYNX</h1>
                  <div className="flex items-center gap-1.5">
                    <SignalIcon
                      className={clsx(
                        'h-3 w-3',
                        wsConnected ? 'text-emerald-500' : 'text-surface-500'
                      )}
                    />
                    <span className="text-xs text-surface-500 font-mono uppercase tracking-wider">
                      {wsConnected ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <nav className="mt-4 flex-1 space-y-1 px-3">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href
                  const showBadge = item.name === 'Cameras' && totalActive > 0
                  
                  return (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={clsx(
                        'nav-link relative',
                        isActive && 'nav-link-active'
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeNav"
                          className="absolute inset-0 rounded-lg bg-lynx-600/20"
                          transition={{
                            type: 'spring',
                            stiffness: 380,
                            damping: 30,
                          }}
                        />
                      )}
                      <item.icon className="relative z-10 h-5 w-5" />
                      <span className="relative z-10 uppercase tracking-wider text-sm font-semibold">{item.name}</span>
                      
                      {/* Active cameras badge */}
                      {showBadge && (
                        <span className="relative z-10 ml-auto flex items-center gap-1">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                          <span className="text-xs font-mono text-emerald-400">{totalActive}</span>
                        </span>
                      )}
                    </NavLink>
                  )
                })}
              </nav>
            </div>

            {/* Footer */}
            <div className="flex flex-shrink-0 border-t border-surface-800 p-4">
              <div className="text-xs text-surface-500 font-mono">
                <p className="uppercase tracking-wider">Safelynx v1.0.0</p>
                <p className="mt-0.5 text-surface-600">Face Recognition Security</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <main className="relative flex-1 overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
