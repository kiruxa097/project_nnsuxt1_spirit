import { useCallback, useEffect, useRef, useState } from 'react'
import { errorText } from './api'

type State<T> = { data: T | null; error: string | null; loading: boolean; updatedAt: Date | null }


export function useAutoRefresh<T>(fetcher: () => Promise<T>, intervalMs = 5000) {
  const fetcherRef = useRef(fetcher)
  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const [state, setState] = useState<State<T>>({
    data: null,
    error: null,
    loading: true,
    updatedAt: null,
  })

  const reload = useCallback(async () => {
    try {
      const data = await fetcherRef.current()
      setState({ data, error: null, loading: false, updatedAt: new Date() })
    } catch (e) {
      setState((prev) => ({ ...prev, error: errorText(e), loading: false }))
    }
  }, [])

  useEffect(() => {
    void reload()
    const timer = setInterval(() => {
      if (!document.hidden) void reload()
    }, intervalMs)
    return () => clearInterval(timer)
  }, [reload, intervalMs])

  return { ...state, reload }
}
