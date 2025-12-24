/**
 * Safelynx SDK - Cameras API
 * 
 * Manages camera configuration and streaming.
 * Matches Rust backend: CameraResponse, CameraType, CameraStatus
 */

import { httpClient, type ApiResponse } from './client'
import type { Camera, GeoLocation } from '@/types'

// Backend response types (matching Rust structs)
export interface CameraResponse {
  id: string
  name: string
  camera_type: 'builtin' | 'usb' | 'rtsp'
  device_id: string
  rtsp_url: string | null
  location: LocationResponse | null
  status: 'active' | 'inactive' | 'error'
  resolution: ResolutionResponse
  fps: number
  is_enabled: boolean
  last_frame_at: string | null
  created_at: string
}

export interface LocationResponse {
  latitude: number
  longitude: number
  name: string | null
}

export interface ResolutionResponse {
  width: number
  height: number
}

export interface CreateCameraRequest {
  name: string
  camera_type: 'builtin' | 'usb' | 'rtsp'
  device_id: string
  rtsp_url?: string
  location?: {
    latitude: number
    longitude: number
    name?: string
  }
}

export interface UpdateCameraRequest {
  name?: string
  location?: {
    latitude: number
    longitude: number
    name?: string
  }
  resolution?: {
    width: number
    height: number
  }
  fps?: number
  enabled?: boolean
}

export interface AvailableCameraResponse {
  index: number
  name: string
  description: string
}

// Transform backend response to frontend Camera type
function toCamera(response: CameraResponse): Camera {
  return {
    id: response.id,
    name: response.name,
    camera_type: response.camera_type,
    device_id: response.device_id,
    rtsp_url: response.rtsp_url,
    status: response.status,
    streaming: response.status === 'active',
    resolution: response.resolution,
    width: response.resolution.width,
    height: response.resolution.height,
    fps: response.fps,
    is_enabled: response.is_enabled,
    location: response.location as GeoLocation | null,
    last_frame_at: response.last_frame_at,
    created_at: response.created_at,
  }
}

/**
 * Cameras SDK
 */
export const camerasSdk = {
  /**
   * List all cameras
   */
  async list(): Promise<ApiResponse<Camera[]>> {
    const response = await httpClient.get<CameraResponse[]>('/cameras')
    return {
      ...response,
      data: response.data.map(toCamera),
    }
  },

  /**
   * Get a single camera by ID
   */
  async get(id: string): Promise<ApiResponse<Camera>> {
    const response = await httpClient.get<CameraResponse>(`/cameras/${id}`)
    return {
      ...response,
      data: toCamera(response.data),
    }
  },

  /**
   * Create a new camera
   */
  async create(data: CreateCameraRequest): Promise<ApiResponse<Camera>> {
    const response = await httpClient.post<CameraResponse>('/cameras', data)
    return {
      ...response,
      data: toCamera(response.data),
    }
  },

  /**
   * Update a camera
   */
  async update(id: string, data: UpdateCameraRequest): Promise<ApiResponse<Camera>> {
    const response = await httpClient.put<CameraResponse>(`/cameras/${id}`, data)
    return {
      ...response,
      data: toCamera(response.data),
    }
  },

  /**
   * Delete a camera
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete(`/cameras/${id}`)
  },

  /**
   * Start camera streaming
   */
  async startStream(id: string): Promise<ApiResponse<void>> {
    return httpClient.post(`/cameras/${id}/stream/start`)
  },

  /**
   * Stop camera streaming
   */
  async stopStream(id: string): Promise<ApiResponse<void>> {
    return httpClient.post(`/cameras/${id}/stream/stop`)
  },

  /**
   * List available system cameras
   */
  async listAvailable(): Promise<ApiResponse<AvailableCameraResponse[]>> {
    return httpClient.get<AvailableCameraResponse[]>('/cameras/available')
  },
}
