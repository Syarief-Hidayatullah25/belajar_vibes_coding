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
