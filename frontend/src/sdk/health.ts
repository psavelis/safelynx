/**
 * Safelynx SDK - Health API
 * 
 * Server health and status checks.
 */

import { httpClient, type ApiResponse } from './client'

export interface HealthResponse {
  status: string
  version: string
}

/**
 * Health SDK
 */
export const healthSdk = {
  /**
   * Check server health
   */
  async check(): Promise<ApiResponse<HealthResponse>> {
    return httpClient.get<HealthResponse>('/health')
  },
}
