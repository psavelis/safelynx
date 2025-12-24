/**
 * Safelynx SDK Integration Tests
 * 
 * Tests the SDK client and all API modules to ensure they work correctly
 * with the backend API.
 * 
 * @restriction NEVER use axios - uses native fetch only
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { HttpClient, SafelynxApiError } from '@/sdk/client'

// Helper to create mock fetch response
function mockResponse(data: unknown, status = 200, ok = true) {
  return {
    ok,
    status,
    headers: {
      get: (name: string) => name === 'content-type' ? 'application/json' : null,
    },
    json: async () => data,
    text: async () => JSON.stringify(data),
  }
}

describe('HttpClient', () => {
  let client: HttpClient
  const mockFetch = vi.fn()
  const originalFetch = global.fetch

  beforeEach(() => {
    global.fetch = mockFetch
    // Client with base URL /api (not /api/v1) for simpler testing
    client = new HttpClient('/api')
    mockFetch.mockReset()
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  describe('GET requests', () => {
    it('should make a GET request with correct URL', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ data: 'test' }))

      await client.get('/test')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/test'),
        expect.objectContaining({
          method: 'GET',
          headers: expect.any(Object),
        })
      )
    })

    it('should include query parameters in URL', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ data: [] }))

      await client.get('/profiles', { params: { limit: 10, offset: 0 } })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringMatching(/limit=10.*offset=0|offset=0.*limit=10/),
        expect.any(Object)
      )
    })

    it('should return data on successful response', async () => {
      const mockData = { id: '123', name: 'Test' }
      mockFetch.mockResolvedValueOnce(mockResponse(mockData))

      const result = await client.get('/profiles/123')

      expect(result.data).toEqual(mockData)
      expect(result.status).toBe(200)
    })
  })

  describe('POST requests', () => {
    it('should make a POST request with JSON body', async () => {
      const body = { name: 'New Camera' }
      mockFetch.mockResolvedValueOnce(mockResponse({ id: '456', ...body }, 201))

      await client.post('/cameras', body)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/cameras'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(body),
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      )
    })
  })

  describe('PUT requests', () => {
    it('should make a PUT request', async () => {
      const body = { name: 'Updated Name' }
      mockFetch.mockResolvedValueOnce(mockResponse({ id: '123', ...body }))

      await client.put('/profiles/123', body)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/profiles/123'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(body),
        })
      )
    })
  })

  describe('PATCH requests', () => {
    it('should make a PATCH request', async () => {
      const body = { classification: 'known' }
      mockFetch.mockResolvedValueOnce(mockResponse({ id: '123', ...body }))

      await client.patch('/profiles/123', body)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/profiles/123'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      )
    })
  })

  describe('DELETE requests', () => {
    it('should make a DELETE request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
        headers: { get: () => null },
        json: async () => ({}),
      })

      await client.delete('/profiles/123')

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/profiles/123'),
        expect.objectContaining({
          method: 'DELETE',
        })
      )
    })
  })

  describe('Error handling', () => {
    it('should throw SafelynxApiError on 4xx response', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Profile not found' }, 404, false))

      await expect(client.get('/profiles/999')).rejects.toThrow(SafelynxApiError)
    })

    it('should throw SafelynxApiError on 5xx response', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({ error: 'Database error' }, 500, false))

      await expect(client.get('/health')).rejects.toThrow(SafelynxApiError)
    })

    it('should throw on network error', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))

      await expect(client.get('/test')).rejects.toThrow(SafelynxApiError)
    })
  })

  describe('Custom headers', () => {
    it('should merge custom headers with defaults', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse({}))

      await client.get('/test', {
        headers: { 'X-Custom-Header': 'value' },
      })

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Custom-Header': 'value',
            'Content-Type': 'application/json',
          }),
        })
      )
    })
  })
})

describe('SafelynxApiError', () => {
  it('should create error with all properties', () => {
    const error = new SafelynxApiError('Not Found', 404, 'NOT_FOUND')

    expect(error.message).toBe('Not Found')
    expect(error.status).toBe(404)
    expect(error.code).toBe('NOT_FOUND')
    expect(error.name).toBe('SafelynxApiError')
  })

  it('should be instanceof Error', () => {
    const error = new SafelynxApiError('Server Error', 500)
    expect(error).toBeInstanceOf(Error)
  })
})
