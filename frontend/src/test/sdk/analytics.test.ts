/**
 * Analytics SDK Tests
 * 
 * Tests the analytics API module
 * 
 * @restriction NEVER use axios - uses native fetch only
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { analyticsSdk } from '@/sdk/analytics'
import { mockResponse } from '../utils'

describe('analyticsSdk', () => {
  const mockFetch = vi.fn()
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = mockFetch
    mockFetch.mockReset()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('getDashboard', () => {
    it('should fetch dashboard statistics', async () => {
      const mockStats = {
        total_profiles: 150,
        known_profiles: 80,
        unknown_profiles: 50,
        flagged_profiles: 20,
        total_sightings_today: 45,
        total_sightings_week: 320,
        active_cameras: 5,
        recording_active: true,
        storage_used_bytes: 1073741824,
        storage_used_human: '1 GB',
        storage_total_bytes: 10737418240,
        storage_percent_used: 10,
      }

      mockFetch.mockResolvedValueOnce(mockResponse(mockStats))

      const result = await analyticsSdk.getDashboard()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/analytics/dashboard'),
        expect.any(Object)
      )
      expect(result.data.total_profiles).toBe(150)
      expect(result.data.active_cameras).toBe(5)
      expect(result.data.recording_active).toBe(true)
    })
  })

  describe('getTimeline', () => {
    it('should fetch timeline with default params', async () => {
      const mockTimeline = [
        {
          timestamp: '2024-01-01T12:00:00Z',
          event_type: 'face_detected',
          profile_id: '123',
          profile_name: 'John',
          camera_id: 'cam1',
          camera_name: 'Front Door',
          thumbnail_url: '/thumb.jpg',
        },
      ]

      mockFetch.mockResolvedValueOnce(mockResponse(mockTimeline))

      const result = await analyticsSdk.getTimeline()

      expect(result.data).toHaveLength(1)
      expect(result.data[0].event_type).toBe('face_detected')
    })

    it('should fetch timeline with custom date range', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse([]))

      await analyticsSdk.getTimeline({
        start: '2024-01-01T00:00:00Z',
        end: '2024-01-02T00:00:00Z',
        limit: 50,
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/start=.*&end=.*&limit=50/),
        expect.any(Object)
      )
    })
  })

  describe('getActivityChart', () => {
    it('should fetch activity chart data', async () => {
      const mockChartData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
        datasets: [
          {
            label: 'Detections',
            data: [10, 25, 15, 30, 20],
            color: '#6366f1',
          },
        ],
      }

      mockFetch.mockResolvedValueOnce(mockResponse(mockChartData))

      const result = await analyticsSdk.getActivityChart('week', 'day')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/period=week&group_by=day/),
        expect.any(Object)
      )
      expect(result.data.labels).toHaveLength(5)
      expect(result.data.datasets[0].data).toEqual([10, 25, 15, 30, 20])
    })
  })

  describe('getStorage', () => {
    it('should fetch storage statistics', async () => {
      const mockStorage = {
        total_bytes: 10737418240,
        used_bytes: 5368709120,
        available_bytes: 5368709120,
        recordings_count: 100,
        recordings_bytes: 4294967296,
        snapshots_count: 5000,
        snapshots_bytes: 1073741824,
        breakdown_by_camera: [
          {
            camera_id: 'cam1',
            camera_name: 'Front Door',
            bytes_used: 2147483648,
            recordings_count: 50,
          },
          {
            camera_id: 'cam2',
            camera_name: 'Back Door',
            bytes_used: 2147483648,
            recordings_count: 50,
          },
        ],
      }

      mockFetch.mockResolvedValueOnce(mockResponse(mockStorage))

      const result = await analyticsSdk.getStorage()

      expect(result.data.total_bytes).toBe(10737418240)
      expect(result.data.breakdown_by_camera).toHaveLength(2)
      expect(result.data.recordings_count).toBe(100)
    })
  })
})
