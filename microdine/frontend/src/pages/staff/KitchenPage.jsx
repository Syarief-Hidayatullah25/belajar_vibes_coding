import { useState } from 'react'
import { api } from '../../lib/api'
import { jam, waktuLalu, LABEL } from '../../lib/format'
import { usePolling } from '../../hooks/usePolling'
import { Alert, Empty, Spinner } from '../../components/ui'

const COLUMNS = [
  { key: 'waiting', title: 'Antrean Baru', action: 'cooking', actionLabel: 'Mulai Masak' },
  { key: 'cooking', title: 'Sedang Dimasak', action: 'ready', actionLabel: 'Selesai Masak' },
  { key: 'ready', title: 'Siap Disajikan', action: 'served', actionLabel: 'Sudah Diantar' },
]

export function KitchenPage() {
  const { data, error, loading, refresh } = usePolling(() => api.queue('kitchen'), { intervalMs: 3000 })
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function advance(order, status) {
    setBusyId(order.id)
    setActionError(null)

    try {
      await api.updateKitchenStatus(order.id, status)
      await refresh({ silent: true })
    } catch (err) {
      setActionError(err.message)
    } finally {
      setBusyId(null)
    }
  }

  if (loading && !data) return <Spinner label="Memuat pesanan dapur…" />

  const columns = data?.columns ?? { waiting: [], cooking: [], ready: [] }

  return (
    <div className="kitchen">
      <header className="kitchen__head">
        <h1>Kitchen Display</h1>
        <p className="muted small">Hanya pesanan lunas. Diperbarui tiap 3 detik.</p>
      </header>

      {error && <Alert>{error.message}</Alert>}
      {actionError && <Alert onClose={() => setActionError(null)}>{actionError}</Alert>}

      <div className="kitchen__grid">
        {COLUMNS.map((column) => (
          <section key={column.key} className="kitchen__col">
            <header className="kitchen__col-head">
              <h2>{column.title}</h2>
              <span className="badge badge--subtle">{columns[column.key].length}</span>
            </header>

            {columns[column.key].length === 0 ? (
              <Empty>-</Empty>
            ) : (
              columns[column.key].map((order) => (
                <article key={order.id} className="kds-card">
                  <header>
                    <strong>{order.order_number}</strong>
                    <span>Meja {order.table_number ?? '—'}</span>
                  </header>

                  <p className="muted small">
                    {jam(order.created_at)} · {waktuLalu(order.created_at)}
                  </p>

                  <ul>
                    {order.items.map((item, index) => (
                      <li key={`${item.menu_name}-${index}`}>
                        <strong>{item.quantity}×</strong> {item.menu_name}
                        {item.notes && <em className="kds-card__note">“{item.notes}”</em>}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    className="button button--primary button--block"
                    onClick={() => advance(order, column.action)}
                    disabled={busyId === order.id}
                  >
                    {busyId === order.id ? 'Menyimpan…' : column.actionLabel}
                  </button>
                </article>
              ))
            )}
          </section>
        ))}
      </div>

      <p className="muted small center">
        Status dapur: {LABEL.kitchen_status.waiting} → {LABEL.kitchen_status.cooking} →{' '}
        {LABEL.kitchen_status.ready} → {LABEL.kitchen_status.served}
      </p>
    </div>
  )
}
