import { useState } from 'react'
import { api } from '../../lib/api'
import { rupiah, jam, waktuLalu, LABEL } from '../../lib/format'
import { usePolling } from '../../hooks/usePolling'
import { Alert, Empty, Spinner } from '../../components/ui'

const COLUMNS = [
  { key: 'waiting_payment', title: 'Menunggu Pembayaran' },
  { key: 'processing', title: 'Diproses' },
  { key: 'ready', title: 'Siap / Selesai' },
]

function CashModal({ order, onClose, onPaid }) {
  const total = Number(order.grand_total)
  const suggestions = [total, Math.ceil(total / 5000) * 5000, Math.ceil(total / 10000) * 10000, Math.ceil(total / 50000) * 50000]
  const uniqueSuggestions = [...new Set(suggestions)].filter((value) => value >= total)

  const [received, setReceived] = useState(String(uniqueSuggestions[0] ?? total))
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [change, setChange] = useState(null)

  const receivedNumber = Number(received || 0)
  const changePreview = receivedNumber - total

  async function handleConfirm() {
    setLoading(true)
    setError(null)

    try {
      const result = await api.confirmCash(order.id, receivedNumber)
      setChange(result.change_due)
      setTimeout(() => {
        onPaid?.()
        onClose()
      }, 1200)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__card">
        <header className="modal__head">
          <h2>Terima Tunai · {order.order_number}</h2>
          <button type="button" className="button button--ghost" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </header>

        {error && <Alert>{error}</Alert>}

        <dl className="totals">
          <div className="totals__grand">
            <dt>Total tagihan</dt>
            <dd>{rupiah(total)}</dd>
          </div>
        </dl>

        <label className="field">
          <span>Uang diterima</span>
          <input
            className="input input--large"
            type="number"
            min={0}
            inputMode="numeric"
            value={received}
            onChange={(event) => setReceived(event.target.value)}
          />
        </label>

        <div className="chips">
          {uniqueSuggestions.map((value) => (
            <button key={value} type="button" className="chip" onClick={() => setReceived(String(value))}>
              {rupiah(value)}
            </button>
          ))}
        </div>

        {change === null ? (
          <p className={changePreview < 0 ? 'alert alert--error' : 'muted'}>
            {changePreview < 0
              ? `Kurang ${rupiah(Math.abs(changePreview))}`
              : `Kembalian: ${rupiah(changePreview)}`}
          </p>
        ) : (
          <p className="alert alert--success">Pembayaran diterima. Kembalian {rupiah(change)}</p>
        )}

        <button
          type="button"
          className="button button--primary button--block"
          onClick={handleConfirm}
          disabled={loading || changePreview < 0 || change !== null}
        >
          {loading ? 'Memproses…' : 'Konfirmasi Pembayaran'}
        </button>
      </div>
    </div>
  )
}

function OrderCard({ order, onAcceptCash, onKitchenStatus, busy }) {
  return (
    <article className="ticket">
      <header className="ticket__head">
        <strong>{order.order_number}</strong>
        <span className="muted small">Meja {order.table_number ?? '—'}</span>
      </header>

      <p className="muted small">
        {order.source === 'qr_customer' ? 'Scan Meja' : 'Kasir'} · {jam(order.created_at)} ·{' '}
        {waktuLalu(order.created_at)}
      </p>

      <ul className="ticket__items">
        {order.items.map((item, index) => (
          <li key={`${item.menu_name}-${index}`}>
            <span>
              {item.quantity}× {item.menu_name}
            </span>
            {item.notes && <em className="muted small">“{item.notes}”</em>}
          </li>
        ))}
      </ul>

      <footer className="ticket__foot">
        <div>
          <strong>{rupiah(order.grand_total)}</strong>
          <span className="muted small"> · {LABEL.payment_method[order.payment_method]}</span>
        </div>
        <span className="badge badge--subtle">{LABEL.kitchen_status[order.kitchen_status]}</span>
      </footer>

      <div className="ticket__actions">
        {order.payment_status === 'pending' && order.payment_method === 'cash' && (
          <button type="button" className="button button--primary" onClick={() => onAcceptCash(order)}>
            Terima Tunai
          </button>
        )}
        {order.payment_status === 'pending' && order.payment_method === 'qris' && (
          <span className="muted small">Menunggu pembayaran QRIS…</span>
        )}

        {order.payment_status === 'paid' && order.kitchen_status === 'waiting' && (
          <button type="button" className="button" onClick={() => onKitchenStatus(order, 'cooking')} disabled={busy}>
            Mulai Masak
          </button>
        )}
        {order.kitchen_status === 'cooking' && (
          <button type="button" className="button" onClick={() => onKitchenStatus(order, 'ready')} disabled={busy}>
            Tandai Siap
          </button>
        )}
        {order.kitchen_status === 'ready' && (
          <button type="button" className="button" onClick={() => onKitchenStatus(order, 'served')} disabled={busy}>
            Sudah Disajikan
          </button>
        )}
      </div>
    </article>
  )
}

export function KasirQueuePage() {
  const { data, error, loading, refresh } = usePolling(() => api.queue('kasir'), { intervalMs: 4000 })
  const [cashOrder, setCashOrder] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function handleKitchenStatus(order, status) {
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

  if (loading && !data) return <Spinner label="Memuat antrean…" />

  const columns = data?.columns ?? { waiting_payment: [], processing: [], ready: [] }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Antrean Kasir</h1>
          <p className="muted small">Diperbarui otomatis setiap 4 detik.</p>
        </div>
        <button type="button" className="button" onClick={() => refresh()}>
          Muat ulang
        </button>
      </header>

      {error && <Alert>{error.message}</Alert>}
      {actionError && <Alert onClose={() => setActionError(null)}>{actionError}</Alert>}

      <div className="kanban">
        {COLUMNS.map((column) => (
          <section key={column.key} className="kanban__col">
            <header className="kanban__head">
              <h2>{column.title}</h2>
              <span className="badge badge--subtle">{columns[column.key].length}</span>
            </header>

            {columns[column.key].length === 0 ? (
              <Empty>Tidak ada pesanan.</Empty>
            ) : (
              columns[column.key].map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onAcceptCash={setCashOrder}
                  onKitchenStatus={handleKitchenStatus}
                  busy={busyId === order.id}
                />
              ))
            )}
          </section>
        ))}
      </div>

      {cashOrder && (
        <CashModal order={cashOrder} onClose={() => setCashOrder(null)} onPaid={() => refresh({ silent: true })} />
      )}
    </div>
  )
}
