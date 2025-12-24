import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { PermissionDialog, usePermissions } from './components/PermissionDialog'
import { Dashboard } from './pages/Dashboard'
import { LiveView } from './pages/LiveView'
import { Cameras } from './pages/Cameras'
import { Profiles } from './pages/Profiles'
import { ProfileDetail } from './pages/ProfileDetail'
import { Timeline } from './pages/Timeline'
import { Recordings } from './pages/Recordings'
import { Settings } from './pages/Settings'
import { Maps } from './pages/Maps'
import { useWebSocket } from './hooks/useWebSocket'

export default function App() {
  useWebSocket()
  const { showDialog, closeDialog, handlePermissionsChange } = usePermissions()

  return (
    <>
      <PermissionDialog
        isOpen={showDialog}
        onClose={closeDialog}
        onPermissionsChange={handlePermissionsChange}
      />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/live" element={<LiveView />} />
          <Route path="/cameras" element={<Cameras />} />
          <Route path="/profiles" element={<Profiles />} />
          <Route path="/profiles/:id" element={<ProfileDetail />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/recordings" element={<Recordings />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/maps" element={<Maps />} />
        </Routes>
      </Layout>
    </>
  )
}
