/**
 * Safelynx SDK - Recordings API
 * 
 * Video recording management.
 * Matches Rust backend: Recording, RecordingStatus
 */

import { httpClient, type ApiResponse } from './client'
import type { Recording } from '@/types'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7889'

export interface RecordingQuery {
  camera_id?: string
  status?: 'recording' | 'completed' | 'error'
  limit?: number
  offset?: number
}

/**
 * Recordings SDK
 */
export const recordingsSdk = {
  /**
   * List recordings with optional filters
   */
  async list(query?: RecordingQuery): Promise<ApiResponse<Recording[]>> {
    return httpClient.get<Recording[]>('/recordings', {
      params: query as Record<string, string | number | boolean | undefined>,
    })
  },

  /**
   * Get a single recording by ID
   */
  async get(id: string): Promise<ApiResponse<Recording>> {
    return httpClient.get<Recording>(`/recordings/${id}`)
  },

  /**
   * Delete a recording
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete(`/recordings/${id}`)
  },

  /**
   * Get the playback URL for a recording
   */
  getPlayUrl(id: string): string {
    return `${API_BASE}/api/v1/recordings/${id}/play`
  },
}
