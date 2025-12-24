import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Generic response type for API calls
 * Compatible with SDK responses: { data: T }
 * 
 * @restriction NEVER use axios - uses native fetch only
 */
interface ApiResponseLike<T> {
  data: T
}

interface FetchState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

/**
 * React hook for fetching data from the API
 * 
 * @param fetcher - Function that returns a Promise with { data: T }
 * @param deps - Dependencies array for re-fetching
 * @returns State object with data, loading, error, and refetch function
 * 
 * @example
 * ```typescript
 * import { sdk } from '@/sdk'
 * 
 * const { data: cameras, loading, error, refetch } = useFetch(
 *   () => sdk.cameras.list(),
 *   []
 * )
 * ```
 */
export function useFetch<T>(
  fetcher: () => Promise<ApiResponseLike<T>>,
  deps: unknown[] = []
): FetchState<T> & { refetch: () => void } {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    loading: true,
    error: null,
  })

  const isMounted = useRef(true)

  const fetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }))
    try {
      const response = await fetcher()
      if (isMounted.current) {
        setState({ data: response.data, loading: false, error: null })
      }
    } catch (error) {
      if (isMounted.current) {
        setState({ data: null, loading: false, error: error as Error })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    isMounted.current = true
    fetch()
    return () => {
      isMounted.current = false
    }
  }, [fetch])

  return { ...state, refetch: fetch }
}
