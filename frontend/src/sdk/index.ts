/**
 * Safelynx SDK
 * 
 * TypeScript SDK for the Safelynx backend API.
 * 
 * @restriction NEVER use axios - uses native fetch only
 * @reason Native fetch is built into all modern browsers and Node.js 18+
 * 
 * @example
 * ```typescript
 * import { sdk } from '@/sdk'
 * 
 * // List all profiles
 * const { data: profiles } = await sdk.profiles.list()
 * 
 * // Get dashboard stats
 * const { data: stats } = await sdk.analytics.getDashboard()
 * 
 * // Start camera streaming
 * await sdk.cameras.startStream('camera-id')
 * ```
 */

// Import modules
import { httpClient, HttpClient, SafelynxApiError } from './client'
import type { ApiResponse, ApiError, RequestConfig } from './client'

import { profilesSdk } from './profiles'
import type { 
  ProfileListResponse, 
  ProfileResponse, 
  ProfileStatsResponse, 
  UpdateProfileRequest 
} from './profiles'

import { camerasSdk } from './cameras'
import type { 
  CameraResponse, 
  CreateCameraRequest, 
  UpdateCameraRequest, 
  AvailableCameraResponse 
} from './cameras'

import { analyticsSdk } from './analytics'
import type { 
  DashboardStatsResponse, 
  TimelineEntryResponse, 
  TimelineQuery,
  ActivityChartResponse, 
  StorageStatsResponse 
} from './analytics'

import { sightingsSdk } from './sightings'
import type { SightingQuery } from './sightings'

import { recordingsSdk } from './recordings'
import type { RecordingQuery } from './recordings'

import { settingsSdk } from './settings'
import type { UpdateSettingsRequest } from './settings'

import { healthSdk } from './health'
import type { HealthResponse } from './health'

// Re-export everything
export { httpClient, HttpClient, SafelynxApiError }
export type { ApiResponse, ApiError, RequestConfig }
export { profilesSdk }
export type { ProfileListResponse, ProfileResponse, ProfileStatsResponse, UpdateProfileRequest }
export { camerasSdk }
export type { CameraResponse, CreateCameraRequest, UpdateCameraRequest, AvailableCameraResponse }
export { analyticsSdk }
export type { DashboardStatsResponse, TimelineEntryResponse, TimelineQuery, ActivityChartResponse, StorageStatsResponse }
export { sightingsSdk }
export type { SightingQuery }
export { recordingsSdk }
export type { RecordingQuery }
export { settingsSdk }
export type { UpdateSettingsRequest }
export { healthSdk }
export type { HealthResponse }

/**
 * Main SDK instance with all modules
 */
export const sdk = {
  profiles: profilesSdk,
  cameras: camerasSdk,
  analytics: analyticsSdk,
  sightings: sightingsSdk,
  recordings: recordingsSdk,
  settings: settingsSdk,
  health: healthSdk,
} as const

export default sdk
