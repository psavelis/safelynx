/**
 * Safelynx SDK - Sightings API
 * 
 * Face sighting events and detection history.
 * Matches Rust backend: Sighting, SightingQuery
 */

import { httpClient, type ApiResponse } from './client'
import type { Sighting } from '@/types'

export interface SightingQuery {
  start?: string
  end?: string
  camera_id?: string
  profile_id?: string
  limit?: number
  offset?: number
}

/**
 * Sightings SDK
 */
export const sightingsSdk = {
  /**
   * List sightings with optional filters
   */
  async list(query?: SightingQuery): Promise<ApiResponse<Sighting[]>> {
    return httpClient.get<Sighting[]>('/sightings', {
      params: query as Record<string, string | number | boolean | undefined>,
    })
  },

  /**
   * Get a single sighting by ID
   */
  async get(id: string): Promise<ApiResponse<Sighting>> {
    return httpClient.get<Sighting>(`/sightings/${id}`)
  },
}
