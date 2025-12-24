/**
 * Profiles SDK Tests
 * 
 * Tests the profiles API module
 * 
 * @restriction NEVER use axios - uses native fetch only
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { profilesSdk } from '@/sdk/profiles'

// Helper to create mock fetch response
function mockResponse(data: unknown, status = 200, ok = true) {
  return {
    ok,
    status,
    headers: {
      get: (name: string) => name === 'content-type' ? 'application/json' : null,
    },
    json: async () => data,
    text: async () => JSON.stringify(data),
  }
}

describe('profilesSdk', () => {
  const mockFetch = vi.fn()
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = mockFetch
    mockFetch.mockReset()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('list', () => {
    it('should fetch profiles with pagination', async () => {
      const mockProfiles = {
        profiles: [
          {
            id: '123',
            name: 'John Doe',
            display_name: 'John',
            classification: 'known',
            thumbnail_url: null,
            tags: ['employee'],
            notes: null,
            first_seen_at: '2024-01-01T00:00:00Z',
            last_seen_at: '2024-01-02T00:00:00Z',
            sighting_count: 5,
            is_active: true,
          },
        ],
        total: 1,
        stats: {
          total: 1,
          trusted: 0,
          known: 1,
          unknown: 0,
          flagged: 0,
          total_sightings: 5,
        },
      }

      mockFetch.mockResolvedValueOnce(mockResponse(mockProfiles))

      const result = await profilesSdk.list(10, 0)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profiles'),
        expect.any(Object)
      )
      expect(result.data).toHaveLength(1)
      expect(result.data[0].id).toBe('123')
      expect(result.data[0].name).toBe('John Doe')
    })
  })

  describe('listWithStats', () => {
    it('should return profiles with stats', async () => {
      const mockData = {
        profiles: [],
        total: 0,
        stats: {
          total: 100,
          trusted: 20,
          known: 50,
          unknown: 25,
          flagged: 5,
          total_sightings: 500,
        },
      }

      mockFetch.mockResolvedValueOnce(mockResponse(mockData))

      const result = await profilesSdk.listWithStats()

      expect(result.data.stats.total).toBe(100)
      expect(result.data.stats.flagged).toBe(5)
    })
  })

  describe('get', () => {
    it('should fetch a single profile by ID', async () => {
      const mockProfile = {
        id: '123',
        name: 'Jane Doe',
        display_name: 'Jane',
        classification: 'trusted',
        thumbnail_url: '/thumbnails/123.jpg',
        tags: ['admin'],
        notes: 'Important person',
        first_seen_at: '2024-01-01T00:00:00Z',
        last_seen_at: '2024-01-03T00:00:00Z',
        sighting_count: 10,
        is_active: true,
      }

      mockFetch.mockResolvedValueOnce(mockResponse(mockProfile))

      const result = await profilesSdk.get('123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profiles/123'),
        expect.any(Object)
      )
      expect(result.data.id).toBe('123')
      expect(result.data.classification).toBe('trusted')
    })
  })

  describe('update', () => {
    it('should update a profile', async () => {
      const updateData = {
        name: 'Updated Name',
        classification: 'known' as const,
      }

      const mockReturn = {
        id: '123',
        name: 'Updated Name',
        display_name: 'Updated',
        classification: 'known',
        thumbnail_url: null,
        tags: [],
        notes: null,
        first_seen_at: '2024-01-01T00:00:00Z',
        last_seen_at: '2024-01-01T00:00:00Z',
        sighting_count: 0,
        is_active: true,
      }

      mockFetch.mockResolvedValueOnce(mockResponse(mockReturn))

      const result = await profilesSdk.update('123', updateData)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profiles/123'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        })
      )
      expect(result.data.name).toBe('Updated Name')
    })
  })

  describe('delete', () => {
    it('should delete a profile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: () => null },
        json: async () => ({}),
      })

      await profilesSdk.delete('123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profiles/123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('getSightings', () => {
    it('should fetch profile sightings', async () => {
      const mockSightings = [
        {
          id: 's1',
          profile_id: '123',
          camera_id: 'c1',
          confidence: 0.95,
          bounding_box: { x: 10, y: 20, width: 100, height: 100 },
          snapshot_path: '/snapshots/s1.jpg',
          detected_at: '2024-01-01T12:00:00Z',
          created_at: '2024-01-01T12:00:00Z',
        },
      ]

      mockFetch.mockResolvedValueOnce(mockResponse(mockSightings))

      const result = await profilesSdk.getSightings('123', 50)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/profiles/123/sightings'),
        expect.any(Object)
      )
      expect(result.data).toHaveLength(1)
      expect(result.data[0].confidence).toBe(0.95)
    })
  })
})
