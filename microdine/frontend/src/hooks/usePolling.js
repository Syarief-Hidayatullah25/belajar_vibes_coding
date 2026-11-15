import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Polling sederhana sebagai pengganti WebSocket.
 *
 * Backend sudah memancarkan event `OrderPaid` dan `OrderStatusUpdated`
 * (driver broadcast masih `log`). Saat Reverb dipasang, hook ini bisa diganti
 * listener WebSocket tanpa mengubah komponen pemakainya.
 */
export function usePolling(fetcher, { intervalMs = 5000, enabled = true, deps = [] } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(enabled)
  const timer = useRef(null)
  const mounted = useRef(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fetcher, deps)

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true)
      try {
        const result = await run()
        if (mounted.current) {
          setData(result)
          setError(null)
        }
      } catch (err) {
        if (mounted.current) setError(err)
      } finally {
        if (mounted.current && !silent) setLoading(false)
      }
    },
    [run],
  )

  useEffect(() => {
    mounted.current = true

    if (!enabled) {
      setLoading(false)
      return () => {
        mounted.current = false
      }
    }

    refresh()

    if (intervalMs > 0) {
      timer.current = setInterval(() => refresh({ silent: true }), intervalMs)
    }

    return () => {
      mounted.current = false
      if (timer.current) clearInterval(timer.current)
    }
  }, [enabled, intervalMs, refresh])

  return { data, error, loading, refresh }
}
