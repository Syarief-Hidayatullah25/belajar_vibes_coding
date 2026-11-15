import Echo from 'laravel-echo'
import Pusher from 'pusher-js'
import { useEffect, useRef, useState } from 'react'

/**
 * Klien WebSocket (Laravel Reverb) untuk MICRODINE.
 *
 * Channel yang dipakai backend bersifat publik: `orders` (semua pesanan) dan
 * `order.{id}` (satu pesanan). Bila Reverb tidak dikonfigurasi
 * (VITE_REVERB_APP_KEY kosong), hook otomatis nonaktif dan halaman kembali
 * mengandalkan polling.
 */

let echoInstance = null

export function getEcho() {
  const key = import.meta.env.VITE_REVERB_APP_KEY

  if (!key) return null

  if (echoInstance === null) {
    window.Pusher = Pusher

    echoInstance = new Echo({
      broadcaster: 'reverb',
      key,
      wsHost: import.meta.env.VITE_REVERB_HOST ?? window.location.hostname,
      wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
      wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
      forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'http') === 'https',
      enabledTransports: ['ws', 'wss'],
    })
  }

  return echoInstance
}

export function isRealtimeConfigured() {
  return Boolean(import.meta.env.VITE_REVERB_APP_KEY)
}

/**
 * Berlangganan channel publik dan event broadcast.
 *
 * @param {string[]} channels nama channel, mis. ['orders']
 * @param {Record<string, (payload: unknown) => void>} handlers nama event (tanpa titik) -> callback
 * @param {boolean} enabled matikan sementara bila perlu
 * @returns {'connected'|'connecting'|'disconnected'|'unavailable'|'disabled'}
 */
export function useRealtime(channels, handlers, enabled = true) {
  const [state, setState] = useState(() => (isRealtimeConfigured() ? 'connecting' : 'disabled'))
  const handlersRef = useRef(handlers)

  handlersRef.current = handlers

  const channelKey = channels.join('|')

  useEffect(() => {
    const echo = getEcho()

    if (echo === null || !enabled) {
      setState(echo === null ? 'disabled' : 'unavailable')
      return undefined
    }

    const connection = echo.connector.pusher.connection
    const handleState = ({ current }) => setState(current)

    connection.bind('state_change', handleState)
    setState(connection.state)

    const names = channelKey.split('|').filter(Boolean)

    for (const name of names) {
      const channel = echo.channel(name)

      for (const eventName of Object.keys(handlersRef.current)) {
        channel.listen(`.${eventName}`, (payload) => handlersRef.current[eventName]?.(payload))
      }
    }

    return () => {
      connection.unbind('state_change', handleState)
      for (const name of names) echo.leave(name)
    }
  }, [channelKey, enabled])

  return state
}
