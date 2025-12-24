/**
 * Cameras SDK Tests
 * 
 * Tests the cameras API module
 * 
 * @restriction NEVER use axios - uses native fetch only
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { camerasSdk } from '@/sdk/cameras'
import { mockResponse, mockNoContentResponse } from '../utils'

describe('camerasSdk', () => {
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
    it('should fetch all cameras', async () => {
      const mockCameras = [
        {
          id: 'cam1',
          name: 'Front Door',
          camera_type: 'usb',
          device_id: '/dev/video0',
          rtsp_url: null,
          status: 'active',
          resolution: { width: 1920, height: 1080 },
          fps: 30,
          is_enabled: true,
          location: null,
          last_frame_at: '2024-01-01T12:00:00Z',
          created_at: '2024-01-01T00:00:00Z',
        },
      ]

      mockFetch.mockResolvedValueOnce(mockResponse(mockCameras))

      const result = await camerasSdk.list()

      expect(result.data).toHaveLength(1)
      expect(result.data[0].name).toBe('Front Door')
      expect(result.data[0].status).toBe('active')
    })
  })

  describe('get', () => {
    it('should fetch a single camera', async () => {
      const mockCamera = {
        id: 'cam1',
        name: 'Back Door',
        camera_type: 'rtsp',
        device_id: '',
        rtsp_url: 'rtsp://192.168.1.100:554/stream',
        status: 'inactive',
        resolution: { width: 1280, height: 720 },
        fps: 25,
        is_enabled: true,
        location: { latitude: 40.7128, longitude: -74.006, name: 'NYC' },
        last_frame_at: null,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockFetch.mockResolvedValueOnce(mockResponse(mockCamera))

      const result = await camerasSdk.get('cam1')

      expect(result.data.rtsp_url).toBe('rtsp://192.168.1.100:554/stream')
      expect(result.data.location?.name).toBe('NYC')
    })
  })

  describe('create', () => {
    it('should create a new camera', async () => {
      const newCamera = {
        name: 'New Camera',
        camera_type: 'usb' as const,
        device_id: '/dev/video1',
        fps: 30,
        is_enabled: true,
      }

      const returnData = {
        id: 'new-cam',
        ...newCamera,
        rtsp_url: null,
        status: 'inactive',
        resolution: { width: 640, height: 480 },
        location: null,
        last_frame_at: null,
        created_at: '2024-01-01T00:00:00Z',
      }

      mockFetch.mockResolvedValueOnce(mockResponse(returnData, 201))

      const result = await camerasSdk.create(newCamera)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/cameras'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newCamera),
        })
      )
      expect(result.data.id).toBe('new-cam')
    })
  })

  describe('update', () => {
    it('should update a camera', async () => {
      const updateData = {
        name: 'Updated Camera Name',
        fps: 25,
      }

      mockFetch.mockResolvedValueOnce(mockResponse({
        id: 'cam1',
        ...updateData,
        camera_type: 'usb',
        device_id: '/dev/video0',
        rtsp_url: null,
        status: 'active',
        resolution: { width: 1920, height: 1080 },
        is_enabled: true,
        location: null,
        last_frame_at: null,
        created_at: '2024-01-01T00:00:00Z',
      }))

      const result = await camerasSdk.update('cam1', updateData)

      expect(result.data.name).toBe('Updated Camera Name')
      expect(result.data.fps).toBe(25)
    })
  })

  describe('delete', () => {
    it('should delete a camera', async () => {
      mockFetch.mockResolvedValueOnce(mockNoContentResponse())

      await camerasSdk.delete('cam1')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/cameras/cam1'),
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('startStream', () => {
    it('should start camera streaming', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        id: 'cam1',
        name: 'Camera',
        status: 'active',
        camera_type: 'usb',
        device_id: '/dev/video0',
        rtsp_url: null,
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        is_enabled: true,
        location: null,
        last_frame_at: '2024-01-01T12:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      }))

      const result = await camerasSdk.startStream('cam1')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/cameras/cam1/stream/start'),
        expect.objectContaining({
          method: 'POST',
        })
      )
      expect(result.data.status).toBe('active')
    })
  })

  describe('stopStream', () => {
    it('should stop camera streaming', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({
        id: 'cam1',
        name: 'Camera',
        status: 'inactive',
        camera_type: 'usb',
        device_id: '/dev/video0',
        rtsp_url: null,
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        is_enabled: true,
        location: null,
        last_frame_at: '2024-01-01T12:00:00Z',
        created_at: '2024-01-01T00:00:00Z',
      }))

      const result = await camerasSdk.stopStream('cam1')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/cameras/cam1/stream/stop'),
        expect.objectContaining({
          method: 'POST',
        })
      )
      expect(result.data.status).toBe('inactive')
    })
  })

  describe('listAvailable', () => {
    it('should list available camera devices', async () => {
      const mockDevices = [
        {
          device_id: '/dev/video0',
          name: 'USB Camera',
          camera_type: 'usb',
          available_resolutions: [
            { width: 640, height: 480 },
            { width: 1280, height: 720 },
            { width: 1920, height: 1080 },
          ],
        },
      ]

      mockFetch.mockResolvedValueOnce(mockResponse(mockDevices))

      const result = await camerasSdk.listAvailable()

      expect(result.data).toHaveLength(1)
      expect(result.data[0].available_resolutions).toHaveLength(3)
    })
  })
})
