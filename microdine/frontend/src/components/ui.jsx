import { LABEL } from '../lib/format'

export function StatusBadge({ kind = 'payment_status', value }) {
  const label = LABEL[kind]?.[value] ?? value

  return <span className={`badge badge--${value}`}>{label}</span>
}

export function Alert({ tone = 'error', children, onClose }) {
  if (!children) return null

  return (
    <div className={`alert alert--${tone}`} role="alert">
      <span>{children}</span>
      {onClose && (
        <button type="button" className="alert__close" onClick={onClose} aria-label="Tutup">
          ×
        </button>
      )}
    </div>
  )
}

export function Spinner({ label = 'Memuat…' }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__dot" />
      {label}
    </div>
  )
}

export function Empty({ children }) {
  return <p className="empty">{children}</p>
}

const LIVE_LABEL = {
  connected: 'Live',
  connecting: 'Menyambung…',
  disconnected: 'Terputus',
  disabled: 'Polling',
  unavailable: 'Polling',
}

/** Indikator status WebSocket: Live = real-time, Polling = fallback. */
export function LiveBadge({ state }) {
  const label = LIVE_LABEL[state] ?? 'Polling'
  const tone = state === 'connected' ? 'live' : state === 'connecting' || state === 'disconnected' ? 'warn' : 'subtle'

  return (
    <span className={`badge badge--${tone}`} title={`Status realtime: ${state}`}>
      {label}
    </span>
  )
}
