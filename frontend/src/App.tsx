import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { LiveView } from './pages/LiveView'
import { Cameras } from './pages/Cameras'
import { Profiles } from './pages/Profiles'
import { Timeline } from './pages/Timeline'
import { Recordings } from './pages/Recordings'
import { Settings } from './pages/Settings'
import { useWebSocket } from './hooks/useWebSocket'

export default function App() {
  useWebSocket()

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/live" element={<LiveView />} />
        <Route path="/cameras" element={<Cameras />} />
        <Route path="/profiles" element={<Profiles />} />
        <Route path="/timeline" element={<Timeline />} />
        <Route path="/recordings" element={<Recordings />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Layout>
  )
}
