/**
 * Safelynx SDK - Analytics API
 * 
 * Dashboard statistics, timeline, and storage analytics.
 * Matches Rust backend: DashboardStats, TimelineEntry, StorageStats
 */

import { httpClient, type ApiResponse } from './client'
import type { DashboardStats, TimelineEntry, ActivityChart, StorageStats } from '@/types'

// Backend response types (matching Rust structs)
export interface DashboardStatsResponse {
  total_profiles: number
  known_profiles: number
  unknown_profiles: number
  flagged_profiles: number
  total_sightings_today: number
  total_sightings_week: number
  active_cameras: number
  recording_active: boolean
  storage_used_bytes: number
  storage_used_human: string
  storage_total_bytes: number
  storage_percent_used: number
}

export interface TimelineEntryResponse {
  timestamp: string
  event_type: string
  profile_id: string | null
  profile_name: string | null
  camera_id: string
  camera_name: string
  thumbnail_url: string | null
}

export interface TimelineQuery {
  start?: string
  end?: string
  limit?: number
  camera_id?: string
  profile_id?: string
}

export interface ActivityChartResponse {
  labels: string[]
  datasets: ActivityDatasetResponse[]
}

export interface ActivityDatasetResponse {
  label: string
  data: number[]
  color: string
}

export interface StorageStatsResponse {
  total_bytes: number
  used_bytes: number
  available_bytes: number
  recordings_count: number
  recordings_bytes: number
  snapshots_count: number
  snapshots_bytes: number
  breakdown_by_camera: CameraStorageResponse[]
}

export interface CameraStorageResponse {
  camera_id: string
  camera_name: string
  bytes_used: number
  recordings_count: number
}

/**
 * Analytics SDK
 */
export const analyticsSdk = {
  /**
   * Get dashboard statistics
   */
  async getDashboard(): Promise<ApiResponse<DashboardStats>> {
    return httpClient.get<DashboardStats>('/analytics/dashboard')
  },

  /**
   * Get activity timeline
   */
  async getTimeline(query?: TimelineQuery): Promise<ApiResponse<TimelineEntry[]>> {
    return httpClient.get<TimelineEntry[]>('/analytics/timeline', {
      params: query as Record<string, string | number | boolean | undefined>,
    })
  },

  /**
   * Get activity chart data
   */
  async getActivityChart(period?: string, groupBy?: string): Promise<ApiResponse<ActivityChart>> {
    return httpClient.get<ActivityChart>('/analytics/activity-chart', {
      params: { period, group_by: groupBy },
    })
  },

  /**
   * Get storage statistics
   */
  async getStorage(): Promise<ApiResponse<StorageStats>> {
    return httpClient.get<StorageStats>('/analytics/storage')
  },
}
