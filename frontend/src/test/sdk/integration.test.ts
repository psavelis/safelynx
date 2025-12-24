/**
 * SDK Integration Test
 * 
 * Tests the main SDK export and ensures all modules work together
 * 
 * @restriction NEVER use axios - uses native fetch only
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sdk } from '@/sdk'
import { mockResponse, mockErrorResponse } from '../utils'

describe('SDK Integration', () => {
  const mockFetch = vi.fn()
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = mockFetch
    mockFetch.mockReset()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('sdk structure', () => {
    it('should export all modules', () => {
      expect(sdk).toBeDefined()
      expect(sdk.profiles).toBeDefined()
      expect(sdk.cameras).toBeDefined()
      expect(sdk.analytics).toBeDefined()
      expect(sdk.sightings).toBeDefined()
      expect(sdk.recordings).toBeDefined()
      expect(sdk.settings).toBeDefined()
      expect(sdk.health).toBeDefined()
    })

    it('should have correct method signatures', () => {
      // Profiles
      expect(typeof sdk.profiles.list).toBe('function')
      expect(typeof sdk.profiles.get).toBe('function')
      expect(typeof sdk.profiles.update).toBe('function')
      expect(typeof sdk.profiles.delete).toBe('function')

      // Cameras
      expect(typeof sdk.cameras.list).toBe('function')
      expect(typeof sdk.cameras.create).toBe('function')
      expect(typeof sdk.cameras.startStream).toBe('function')
      expect(typeof sdk.cameras.stopStream).toBe('function')

      // Analytics
      expect(typeof sdk.analytics.getDashboard).toBe('function')
      expect(typeof sdk.analytics.getTimeline).toBe('function')
      expect(typeof sdk.analytics.getActivityChart).toBe('function')
      expect(typeof sdk.analytics.getStorage).toBe('function')

      // Health
      expect(typeof sdk.health.check).toBe('function')
    })
  })

  describe('health check', () => {
    it('should check API health', async () => {
      const mockHealth = {
        status: 'healthy',
        version: '1.0.0',
        database: 'connected',
        uptime_secs: 3600,
      }

      mockFetch.mockResolvedValueOnce(mockResponse(mockHealth))

      const result = await sdk.health.check()

      expect(result.data.status).toBe('healthy')
      expect(result.data.database).toBe('connected')
    })
  })

  describe('settings', () => {
    it('should get settings', async () => {
      const mockSettings = {
        detection: {
          min_confidence: 0.7,
          match_threshold: 0.6,
          sighting_cooldown_secs: 30,
          motion_detection_enabled: true,
          motion_sensitivity: 0.5,
        },
        recording: {
          detection_triggered: true,
          pre_trigger_buffer_secs: 5,
          post_trigger_buffer_secs: 10,
          max_segment_duration_secs: 300,
          max_storage_bytes: 10737418240,
          max_storage_human: '10 GB',
          auto_cleanup_enabled: true,
        },
        notification: {
          desktop_notifications: true,
          notify_new_profile: true,
          notify_flagged: true,
          notify_unknown: false,
        },
        display: {
          show_bounding_boxes: true,
          show_confidence: true,
          show_names: true,
          dark_mode: true,
        },
      }

      mockFetch.mockResolvedValueOnce(mockResponse(mockSettings))

      const result = await sdk.settings.get()

      expect(result.data.detection.min_confidence).toBe(0.7)
      expect(result.data.notification.desktop_notifications).toBe(true)
    })

    it('should update settings', async () => {
      const updateData = {
        detection: {
          min_confidence: 0.8,
        },
      }

      mockFetch.mockResolvedValueOnce(mockResponse({}))

      await sdk.settings.update(updateData)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/settings'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        })
      )
    })
  })

  describe('sightings', () => {
    it('should list sightings', async () => {
      const mockSightings = [
        {
          id: 's1',
          profile_id: 'p1',
          camera_id: 'c1',
          confidence: 0.95,
          bounding_box: { x: 0, y: 0, width: 100, height: 100 },
          snapshot_path: '/snap.jpg',
          detected_at: '2024-01-01T12:00:00Z',
          created_at: '2024-01-01T12:00:00Z',
        },
      ]

      mockFetch.mockResolvedValueOnce(mockResponse(mockSightings))

      const result = await sdk.sightings.list()

      expect(result.data).toHaveLength(1)
      expect(result.data[0].confidence).toBe(0.95)
    })

    it('should filter sightings by camera', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]))

      await sdk.sightings.list({ camera_id: 'cam1' })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('camera_id=cam1'),
        expect.any(Object)
      )
    })
  })

  describe('recordings', () => {
    it('should list recordings', async () => {
      const mockRecordings = [
        {
          id: 'r1',
          camera_id: 'c1',
          file_path: '/recordings/r1.mp4',
          started_at: '2024-01-01T12:00:00Z',
          ended_at: '2024-01-01T12:05:00Z',
          trigger_type: 'face',
          status: 'completed',
          file_size_bytes: 104857600,
          duration_secs: 300,
          created_at: '2024-01-01T12:00:00Z',
        },
      ]

      mockFetch.mockResolvedValueOnce(mockResponse(mockRecordings))

      const result = await sdk.recordings.list()

      expect(result.data).toHaveLength(1)
      expect(result.data[0].trigger_type).toBe('face')
      expect(result.data[0].status).toBe('completed')
    })

    it('should get play URL', () => {
      const url = sdk.recordings.getPlayUrl('r1')
      expect(url).toContain('/recordings/r1/play')
    })
  })

  describe('error propagation', () => {
    it('should propagate API errors correctly', async () => {
      mockFetch.mockResolvedValueOnce(mockErrorResponse('Profile not found', 404))

      await expect(sdk.profiles.get('nonexistent')).rejects.toThrow()
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network failure'))

      await expect(sdk.cameras.list()).rejects.toThrow('Network failure')
    })
  })
})
