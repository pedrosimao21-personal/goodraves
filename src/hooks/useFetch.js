import { useState, useCallback, useRef } from 'react'

/**
 * Generic data fetching hook with loading/error/data state.
 * Cancels previous calls if a new one is triggered.
 */
export function useFetch(fetchFn) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const abortRef = useRef(null)

  const execute = useCallback(
    async (...args) => {
      setLoading(true)
      setError(null)
      try {
        const result = await fetchFn(...args)
        setData(result)
        return result
      } catch (err) {
        setError(err)
        return null
      } finally {
        setLoading(false)
      }
    },
    [fetchFn]
  )

  return { data, loading, error, execute }
}

/** Debounce a value by N ms */
export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  const timerRef = useRef(null)

  const update = useCallback(
    (val) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setDebounced(val), delay)
    },
    [delay]
  )

  return [debounced, update]
}
