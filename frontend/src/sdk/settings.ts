/**
 * Safelynx SDK - Settings API
 * 
 * Application settings management.
 * Matches Rust backend: Settings, DetectionSettings, etc.
 */

import { httpClient, type ApiResponse } from './client'
import type { Settings } from '@/types'

export interface UpdateSettingsRequest {
  detection?: Partial<{
    min_confidence: number
    match_threshold: number
    sighting_cooldown_secs: number
    motion_detection_enabled: boolean
    motion_sensitivity: number
  }>
  recording?: Partial<{
    detection_triggered: boolean
    pre_trigger_buffer_secs: number
    post_trigger_buffer_secs: number
    max_segment_duration_secs: number
    max_storage_bytes: number
    auto_cleanup_enabled: boolean
  }>
  notification?: Partial<{
    desktop_notifications: boolean
    notify_new_profile: boolean
    notify_flagged: boolean
    notify_unknown: boolean
  }>
  display?: Partial<{
    show_bounding_boxes: boolean
    show_confidence: boolean
    show_names: boolean
    dark_mode: boolean
  }>
}

/**
 * Settings SDK
 */
export const settingsSdk = {
  /**
   * Get current settings
   */
  async get(): Promise<ApiResponse<Settings>> {
    return httpClient.get<Settings>('/settings')
  },

  /**
   * Update settings (partial update supported)
   */
  async update(data: UpdateSettingsRequest): Promise<ApiResponse<Settings>> {
    return httpClient.put<Settings>('/settings', data)
  },
}
