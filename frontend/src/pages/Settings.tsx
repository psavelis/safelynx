import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Switch } from '@headlessui/react'
import clsx from 'clsx'
import {
  EyeIcon,
  FilmIcon,
  BellIcon,
  PaintBrushIcon,
} from '@heroicons/react/24/outline'
import { sdk } from '@/sdk'
import { useFetch } from '@/hooks'
import { useStore } from '@/store'
import type { Settings } from '@/types'

type Section = 'detection' | 'recording' | 'notification' | 'display'

export function Settings() {
  const [activeSection, setActiveSection] = useState<Section>('detection')
  const [localSettings, setLocalSettings] = useState<Settings | null>(null)
  const [saving, setSaving] = useState(false)

  const { data: settings, loading, refetch } = useFetch<Settings>(
    () => sdk.settings.get(),
    []
  )

  const { setSettings } = useStore()

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings)
      setSettings(settings)
    }
  }, [settings, setSettings])

  const handleSave = async () => {
    if (!localSettings) return

    setSaving(true)
    try {
      await sdk.settings.update(localSettings)
      toast.success('Settings saved successfully')
      refetch()
    } catch (error) {
      toast.error('Failed to save settings')
      console.error('Failed to save settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const updateSetting = <K extends keyof Settings>(
    section: K,
    key: keyof Settings[K],
    value: Settings[K][keyof Settings[K]]
  ) => {
    if (!localSettings) return

    setLocalSettings({
      ...localSettings,
      [section]: {
        ...localSettings[section],
        [key]: value,
      },
    })
  }

  const sections = [
    { key: 'detection', label: 'Detection', icon: EyeIcon },
    { key: 'recording', label: 'Recording', icon: FilmIcon },
    { key: 'notification', label: 'Notifications', icon: BellIcon },
    { key: 'display', label: 'Display', icon: PaintBrushIcon },
  ] as const

  if (loading || !localSettings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-lynx-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="mt-1 text-surface-400">
            Configure detection, recording, and display preferences
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <nav className="space-y-1">
          {sections.map((section) => (
            <button
              key={section.key}
              onClick={() => setActiveSection(section.key)}
              className={clsx(
                'w-full nav-link',
                activeSection === section.key && 'nav-link-active'
              )}
            >
              <section.icon className="h-5 w-5" />
              {section.label}
            </button>
          ))}
        </nav>

        <motion.div
          key={activeSection}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-3 card p-6"
        >
          {activeSection === 'detection' && (
            <DetectionSettings
              settings={localSettings.detection}
              onChange={(key, value) =>
                updateSetting('detection', key, value)
              }
            />
          )}
          {activeSection === 'recording' && (
            <RecordingSettings
              settings={localSettings.recording}
              onChange={(key, value) =>
                updateSetting('recording', key, value)
              }
            />
          )}
          {activeSection === 'notification' && (
            <NotificationSettings
              settings={localSettings.notification}
              onChange={(key, value) =>
                updateSetting('notification', key, value)
              }
            />
          )}
          {activeSection === 'display' && (
            <DisplaySettings
              settings={localSettings.display}
              onChange={(key, value) =>
                updateSetting('display', key, value)
              }
            />
          )}
        </motion.div>
      </div>
    </div>
  )
}

interface SwitchRowProps {
  label: string
  description: string
  enabled: boolean
  onChange: (enabled: boolean) => void
}

function SwitchRow({ label, description, enabled, onChange }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between py-4 border-b border-surface-800 last:border-0">
      <div>
        <h4 className="text-sm font-medium text-white">{label}</h4>
        <p className="text-sm text-surface-400">{description}</p>
      </div>
      <Switch
        checked={enabled}
        onChange={onChange}
        className={clsx(
          'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
          enabled ? 'bg-lynx-600' : 'bg-surface-700'
        )}
      >
        <span
          className={clsx(
            'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
            enabled ? 'translate-x-6' : 'translate-x-1'
          )}
        />
      </Switch>
    </div>
  )
}

interface SliderRowProps {
  label: string
  description: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (value: number) => void
}

function SliderRow({
  label,
  description,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
}: SliderRowProps) {
  return (
    <div className="py-4 border-b border-surface-800 last:border-0">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h4 className="text-sm font-medium text-white">{label}</h4>
          <p className="text-sm text-surface-400">{description}</p>
        </div>
        <span className="text-sm font-medium text-lynx-400">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-surface-700 rounded-lg appearance-none cursor-pointer accent-lynx-500"
      />
    </div>
  )
}

interface DetectionSettingsProps {
  settings: Settings['detection']
  onChange: <K extends keyof Settings['detection']>(
    key: K,
    value: Settings['detection'][K]
  ) => void
}

function DetectionSettings({ settings, onChange }: DetectionSettingsProps) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-lynx-600/20">
          <EyeIcon className="h-6 w-6 text-lynx-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Detection Settings</h3>
          <p className="text-sm text-surface-400">
            Configure face detection sensitivity and thresholds
          </p>
        </div>
      </div>

      <SliderRow
        label="Minimum Confidence"
        description="Minimum confidence score for face detection"
        value={settings.min_confidence}
        min={0.1}
        max={1}
        step={0.05}
        onChange={(v) => onChange('min_confidence', v)}
      />

      <SliderRow
        label="Match Threshold"
        description="Similarity threshold for matching faces to profiles"
        value={settings.match_threshold}
        min={0.3}
        max={0.9}
        step={0.05}
        onChange={(v) => onChange('match_threshold', v)}
      />

      <SliderRow
        label="Sighting Cooldown"
        description="Minimum time between sightings of the same person"
        value={settings.sighting_cooldown_secs}
        min={5}
        max={300}
        step={5}
        unit="s"
        onChange={(v) => onChange('sighting_cooldown_secs', v)}
      />

      <SwitchRow
        label="Motion Detection"
        description="Enable motion-based detection trigger"
        enabled={settings.motion_detection_enabled}
        onChange={(v) => onChange('motion_detection_enabled', v)}
      />

      {settings.motion_detection_enabled && (
        <SliderRow
          label="Motion Sensitivity"
          description="Sensitivity of motion detection"
          value={settings.motion_sensitivity}
          min={0.1}
          max={1}
          step={0.1}
          onChange={(v) => onChange('motion_sensitivity', v)}
        />
      )}
    </div>
  )
}

interface RecordingSettingsProps {
  settings: Settings['recording']
  onChange: <K extends keyof Settings['recording']>(
    key: K,
    value: Settings['recording'][K]
  ) => void
}

function RecordingSettings({ settings, onChange }: RecordingSettingsProps) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-red-600/20">
          <FilmIcon className="h-6 w-6 text-red-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Recording Settings</h3>
          <p className="text-sm text-surface-400">
            Configure video recording behavior and storage
          </p>
        </div>
      </div>

      <SwitchRow
        label="Detection-Triggered Recording"
        description="Automatically record when faces are detected"
        enabled={settings.detection_triggered}
        onChange={(v) => onChange('detection_triggered', v)}
      />

      <SliderRow
        label="Pre-Trigger Buffer"
        description="Seconds to record before the trigger event"
        value={settings.pre_trigger_buffer_secs}
        min={0}
        max={30}
        step={5}
        unit="s"
        onChange={(v) => onChange('pre_trigger_buffer_secs', v)}
      />

      <SliderRow
        label="Post-Trigger Buffer"
        description="Seconds to record after the trigger event"
        value={settings.post_trigger_buffer_secs}
        min={5}
        max={120}
        step={5}
        unit="s"
        onChange={(v) => onChange('post_trigger_buffer_secs', v)}
      />

      <SliderRow
        label="Max Segment Duration"
        description="Maximum duration of a single recording segment"
        value={settings.max_segment_duration_secs}
        min={60}
        max={3600}
        step={60}
        unit="s"
        onChange={(v) => onChange('max_segment_duration_secs', v)}
      />

      <div className="py-4 border-b border-surface-800">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h4 className="text-sm font-medium text-white">Max Storage</h4>
            <p className="text-sm text-surface-400">
              Maximum storage space for recordings
            </p>
          </div>
          <span className="text-sm font-medium text-lynx-400">
            {settings.max_storage_human}
          </span>
        </div>
      </div>

      <SwitchRow
        label="Auto Cleanup"
        description="Automatically delete old recordings when storage is full"
        enabled={settings.auto_cleanup_enabled}
        onChange={(v) => onChange('auto_cleanup_enabled', v)}
      />
    </div>
  )
}

interface NotificationSettingsProps {
  settings: Settings['notification']
  onChange: <K extends keyof Settings['notification']>(
    key: K,
    value: Settings['notification'][K]
  ) => void
}

function NotificationSettings({ settings, onChange }: NotificationSettingsProps) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-amber-600/20">
          <BellIcon className="h-6 w-6 text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Notification Settings</h3>
          <p className="text-sm text-surface-400">
            Configure when and how you receive alerts
          </p>
        </div>
      </div>

      <SwitchRow
        label="Desktop Notifications"
        description="Show desktop notifications for events"
        enabled={settings.desktop_notifications}
        onChange={(v) => onChange('desktop_notifications', v)}
      />

      <SwitchRow
        label="New Profile Alerts"
        description="Notify when a new face is detected"
        enabled={settings.notify_new_profile}
        onChange={(v) => onChange('notify_new_profile', v)}
      />

      <SwitchRow
        label="Flagged Person Alerts"
        description="Notify when a flagged person is detected"
        enabled={settings.notify_flagged}
        onChange={(v) => onChange('notify_flagged', v)}
      />

      <SwitchRow
        label="Unknown Person Alerts"
        description="Notify when an unknown person is detected"
        enabled={settings.notify_unknown}
        onChange={(v) => onChange('notify_unknown', v)}
      />
    </div>
  )
}

interface DisplaySettingsProps {
  settings: Settings['display']
  onChange: <K extends keyof Settings['display']>(
    key: K,
    value: Settings['display'][K]
  ) => void
}

function DisplaySettings({ settings, onChange }: DisplaySettingsProps) {
  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-purple-600/20">
          <PaintBrushIcon className="h-6 w-6 text-purple-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">Display Settings</h3>
          <p className="text-sm text-surface-400">
            Customize the appearance of the interface
          </p>
        </div>
      </div>

      <SwitchRow
        label="Show Bounding Boxes"
        description="Display face detection boxes on camera preview"
        enabled={settings.show_bounding_boxes}
        onChange={(v) => onChange('show_bounding_boxes', v)}
      />

      <SwitchRow
        label="Show Confidence"
        description="Display confidence percentage on detections"
        enabled={settings.show_confidence}
        onChange={(v) => onChange('show_confidence', v)}
      />

      <SwitchRow
        label="Show Names"
        description="Display profile names on detections"
        enabled={settings.show_names}
        onChange={(v) => onChange('show_names', v)}
      />

      <SwitchRow
        label="Dark Mode"
        description="Use dark color scheme"
        enabled={settings.dark_mode}
        onChange={(v) => onChange('dark_mode', v)}
      />
    </div>
  )
}
