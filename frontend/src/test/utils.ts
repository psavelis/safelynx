/**
 * Test utilities for SDK tests
 * 
 * @restriction NEVER use axios - uses native fetch only
 */

/**
 * Helper to create mock fetch response with proper structure
 */
export function mockResponse(data: unknown, status = 200, ok?: boolean) {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    headers: {
      get: (name: string) => name === 'content-type' ? 'application/json' : null,
    },
    json: async () => data,
    text: async () => JSON.stringify(data),
  }
}

/**
 * Helper to create a 204 No Content response
 */
export function mockNoContentResponse() {
  return {
    ok: true,
    status: 204,
    headers: { get: () => null },
    json: async () => ({}),
    text: async () => '',
  }
}

/**
 * Helper to create an error response
 */
export function mockErrorResponse(error: string, status: number) {
  return mockResponse({ error }, status, false)
}

/**
 * Setup mock fetch and return cleanup function
 */
export function setupMockFetch() {
  const mockFetch = vi.fn()
  const originalFetch = global.fetch
  global.fetch = mockFetch
  
  return {
    mockFetch,
    cleanup: () => {
      global.fetch = originalFetch
    },
    reset: () => {
      mockFetch.mockReset()
    },
  }
}
