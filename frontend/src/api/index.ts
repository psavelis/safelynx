/**
 * Safelynx API
 * 
 * Re-exports from the SDK for backward compatibility.
 * 
 * @deprecated Import directly from '@/sdk' instead
 * @restriction NEVER use axios - uses native fetch only
 */

import { sdk, type ApiResponse } from '@/sdk'
import type { UpdateProfileRequest, UpdateCameraRequest, CreateCameraRequest } from '@/sdk'
import type { Settings } from '@/types'

// Wrapper to match old useFetch interface { data: T }
type LegacyResponse<T> = { data: T }

async function wrapResponse<T>(promise: Promise<ApiResponse<T>>): Promise<LegacyResponse<T>> {
  const response = await promise
  return { data: response.data }
}

/**
 * @deprecated Use sdk.profiles instead
 */
export const profilesApi = {
  list: (limit = 100, _offset = 0) => wrapResponse(sdk.profiles.list(limit, _offset)),
  get: (id: string) => wrapResponse(sdk.profiles.get(id)),
  update: (id: string, data: UpdateProfileRequest) => wrapResponse(sdk.profiles.update(id, data)),
  delete: (id: string) => wrapResponse(sdk.profiles.delete(id)),
  getSightings: (id: string, limit = 50) => wrapResponse(sdk.profiles.getSightings(id, limit)),
}

/**
 * @deprecated Use sdk.cameras instead
 */
export const camerasApi = {
  list: () => wrapResponse(sdk.cameras.list()),
  get: (id: string) => wrapResponse(sdk.cameras.get(id)),
  create: (data: CreateCameraRequest) => wrapResponse(sdk.cameras.create(data)),
  update: (id: string, data: UpdateCameraRequest) => wrapResponse(sdk.cameras.update(id, data)),
  delete: (id: string) => wrapResponse(sdk.cameras.delete(id)),
  startStream: (id: string) => wrapResponse(sdk.cameras.startStream(id)),
  stopStream: (id: string) => wrapResponse(sdk.cameras.stopStream(id)),
  listAvailable: () => wrapResponse(sdk.cameras.listAvailable()),
}

/**
 * @deprecated Use sdk.sightings instead
 */
export const sightingsApi = {
  list: (params?: { start?: string; end?: string; camera_id?: string; profile_id?: string }) => 
    wrapResponse(sdk.sightings.list(params)),
  get: (id: string) => wrapResponse(sdk.sightings.get(id)),
}

/**
 * @deprecated Use sdk.recordings instead
 */
export const recordingsApi = {
  list: (params?: { camera_id?: string; status?: string }) => 
    wrapResponse(sdk.recordings.list(params as Parameters<typeof sdk.recordings.list>[0])),
  get: (id: string) => wrapResponse(sdk.recordings.get(id)),
  delete: (id: string) => wrapResponse(sdk.recordings.delete(id)),
  getPlayUrl: (id: string) => sdk.recordings.getPlayUrl(id),
}

/**
 * @deprecated Use sdk.settings instead
 */
export const settingsApi = {
  get: () => wrapResponse(sdk.settings.get()),
  update: (data: Partial<Settings>) => wrapResponse(sdk.settings.update(data)),
}

/**
 * @deprecated Use sdk.analytics instead
 */
export const analyticsApi = {
  getDashboard: () => wrapResponse(sdk.analytics.getDashboard()),
  getTimeline: (params?: { start?: string; end?: string; limit?: number }) => 
    wrapResponse(sdk.analytics.getTimeline(params)),
  getActivityChart: (period?: string, groupBy?: string) => 
    wrapResponse(sdk.analytics.getActivityChart(period, groupBy)),
  getStorage: () => wrapResponse(sdk.analytics.getStorage()),
}

/**
 * @deprecated Use sdk.health instead
 */
export const healthApi = {
  check: () => wrapResponse(sdk.health.check()),
}

// Re-export SDK as default
export { sdk }
export default sdk
