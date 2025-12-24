/**
 * Safelynx SDK - Profiles API
 * 
 * Manages face profiles and their classifications.
 * Matches Rust backend: ProfileResponse, ProfileListResponse
 */

import { httpClient, type ApiResponse } from './client'
import type { Profile, Sighting } from '@/types'

// Backend response types (matching Rust structs)
export interface ProfileListResponse {
  profiles: ProfileResponse[]
  total: number
  stats: ProfileStatsResponse
}

export interface ProfileResponse {
  id: string
  name: string | null
  display_name: string
  classification: 'known' | 'unknown' | 'flagged' | 'trusted'
  thumbnail_url: string | null
  tags: string[]
  notes: string | null
  first_seen_at: string
  last_seen_at: string
  sighting_count: number
  is_active: boolean
}

export interface ProfileStatsResponse {
  total: number
  trusted: number
  known: number
  unknown: number
  flagged: number
  total_sightings: number
}

export interface UpdateProfileRequest {
  name?: string
  classification?: 'known' | 'unknown' | 'flagged' | 'trusted'
  notes?: string
  tags_to_add?: string[]
  tags_to_remove?: string[]
}

export interface SightingResponse {
  id: string
  profile_id: string
  camera_id: string
  confidence: number
  bounding_box: {
    x: number
    y: number
    width: number
    height: number
  }
  snapshot_path: string | null
  detected_at: string
  created_at: string
}

// Transform backend response to frontend Profile type
function toProfile(response: ProfileResponse): Profile {
  return {
    id: response.id,
    name: response.name,
    display_name: response.display_name,
    classification: response.classification,
    notes: response.notes,
    tags: response.tags,
    thumbnail_url: response.thumbnail_url,
    sighting_count: response.sighting_count,
    first_seen_at: response.first_seen_at,
    last_seen_at: response.last_seen_at,
    is_active: response.is_active,
  }
}

/**
 * Profiles SDK
 */
export const profilesSdk = {
  /**
   * List all profiles with pagination
   */
  async list(limit = 100, offset = 0): Promise<ApiResponse<Profile[]>> {
    const response = await httpClient.get<ProfileListResponse>('/profiles', {
      params: { limit, offset },
    })
    return {
      ...response,
      data: response.data.profiles.map(toProfile),
    }
  },

  /**
   * Get profiles with stats
   */
  async listWithStats(limit = 100, offset = 0): Promise<ApiResponse<ProfileListResponse>> {
    return httpClient.get<ProfileListResponse>('/profiles', {
      params: { limit, offset },
    })
  },

  /**
   * Get a single profile by ID
   */
  async get(id: string): Promise<ApiResponse<Profile>> {
    const response = await httpClient.get<ProfileResponse>(`/profiles/${id}`)
    return {
      ...response,
      data: toProfile(response.data),
    }
  },

  /**
   * Update a profile
   */
  async update(id: string, data: UpdateProfileRequest): Promise<ApiResponse<Profile>> {
    const response = await httpClient.put<ProfileResponse>(`/profiles/${id}`, data)
    return {
      ...response,
      data: toProfile(response.data),
    }
  },

  /**
   * Delete a profile
   */
  async delete(id: string): Promise<ApiResponse<void>> {
    return httpClient.delete(`/profiles/${id}`)
  },

  /**
   * Get sightings for a profile
   */
  async getSightings(id: string, limit = 50): Promise<ApiResponse<Sighting[]>> {
    return httpClient.get<Sighting[]>(`/profiles/${id}/sightings`, {
      params: { limit },
    })
  },
}
