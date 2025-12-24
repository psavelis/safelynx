/**
 * Safelynx SDK - HTTP Client
 * 
 * Native fetch-based HTTP client with full TypeScript support.
 * NO AXIOS - Uses native fetch API only.
 * 
 * @restriction NEVER use axios or any third-party HTTP library
 * @reason Native fetch is built into all modern browsers and Node.js 18+
 */

export interface ApiResponse<T> {
  data: T
  status: number
  ok: boolean
}

export interface ApiError {
  message: string
  status: number
  code?: string
}

export class SafelynxApiError extends Error {
  public readonly status: number
  public readonly code?: string

  constructor(message: string, status: number, code?: string) {
    super(message)
    this.name = 'SafelynxApiError'
    this.status = status
    this.code = code
  }
}

export interface RequestConfig {
  headers?: Record<string, string>
  params?: Record<string, string | number | boolean | undefined>
  signal?: AbortSignal
}

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:7889'

/**
 * Safelynx HTTP Client using native fetch
 */
export class HttpClient {
  private baseUrl: string
  private defaultHeaders: Record<string, string>

  constructor(baseUrl: string = `${API_BASE}/api/v1`) {
    this.baseUrl = baseUrl
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    }
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
    const url = new URL(`${this.baseUrl}${path}`)
    
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value))
        }
      })
    }
    
    return url.toString()
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    config?: RequestConfig
  ): Promise<ApiResponse<T>> {
    const url = this.buildUrl(path, config?.params)
    
    const headers = {
      ...this.defaultHeaders,
      ...config?.headers,
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
      signal: config?.signal,
    }

    if (body !== undefined && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body)
    }

    try {
      const response = await fetch(url, fetchOptions)
      
      // Handle no content responses
      if (response.status === 204) {
        return {
          data: undefined as T,
          status: response.status,
          ok: response.ok,
        }
      }

      const contentType = response.headers.get('content-type')
      let data: T

      if (contentType?.includes('application/json')) {
        data = await response.json()
      } else {
        data = await response.text() as T
      }

      if (!response.ok) {
        const errorMessage = typeof data === 'object' && data !== null && 'error' in data
          ? (data as { error: string }).error
          : `HTTP Error ${response.status}`
        throw new SafelynxApiError(errorMessage, response.status)
      }

      return {
        data,
        status: response.status,
        ok: response.ok,
      }
    } catch (error) {
      if (error instanceof SafelynxApiError) {
        throw error
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new SafelynxApiError('Network error: Unable to connect to server', 0, 'NETWORK_ERROR')
      }
      throw new SafelynxApiError(
        error instanceof Error ? error.message : 'Unknown error',
        0,
        'UNKNOWN_ERROR'
      )
    }
  }

  async get<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, undefined, config)
  }

  async post<T>(path: string, body?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, body, config)
  }

  async put<T>(path: string, body?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, body, config)
  }

  async patch<T>(path: string, body?: unknown, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('PATCH', path, body, config)
  }

  async delete<T>(path: string, config?: RequestConfig): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path, undefined, config)
  }
}

// Singleton instance
export const httpClient = new HttpClient()
