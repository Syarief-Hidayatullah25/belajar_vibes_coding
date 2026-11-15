import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { api } from '../../lib/api'
import { durasi, jam, rupiah, LABEL } from '../../lib/format'
import { usePolling } from '../../hooks/usePolling'
import { useRealtime } from '../../lib/realtime'
import { Alert, LiveBadge, Spinner, StatusBadge } from '../../components/ui'

const STEPS = [
  { key: 'pending', label: 'Menunggu Bayar' },
  { key: 'paid', label: 'Pembayaran Diterima' },
  { key: 'cooking', label: 'Sedang Dimasak' },
  { key: 'ready', label: 'Siap Disajikan' },
]

function stepIndex(order) {
  if (order.payment_status === 'expired') return -1
  if (order.payment_status !== 'paid') return 0
  if (order.kitchen_status === 'served' || order.kitchen_status === 'ready') return 3
  if (order.kitchen_status === 'cooking') return 2

  return 1
}

export function OrderStatusPage() {
  const { orderNumber } = useParams()
  const refreshRef = useRef(null)
  const [pollMs, setPollMs] = useState(4000)

  const { data: order, error, loading, refresh } = usePolling(() => api.getOrder(orderNumber), {
    intervalMs: pollMs,
    deps: [orderNumber],
  })

  refreshRef.current = refresh

  // Cukup channel pesanan ini saja: backend memancarkan event ke `orders` dan
  // `order.{id}`, dan berlangganan keduanya akan memproses event dua kali.
  const realtime = useRealtime(
    order ? [`order.${order.id}`] : [],
    {
      OrderPaid: () => refreshRef.current?.({ silent: true }),
      OrderStatusUpdated: () => refreshRef.current?.({ silent: true }),
    },
    Boolean(order),
  )

  // Saat WebSocket tersambung, polling dilonggarkan jadi jaring pengaman saja.
  useEffect(() => {
    setPollMs(realtime === 'connected' ? 30000 : 4000)
  }, [realtime])

  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [remaining, setRemaining] = useState(null)
  const checkFired = useRef(false)

  // Render QRIS payload menjadi QR asli (mock gateway mengirim JSON biasa).
  useEffect(() => {
    if (!order?.qris_payload) {
      setQrDataUrl(null)
      return
    }

    QRCode.toDataURL(order.qris_payload, { margin: 1, width: 260 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null))
  }, [order?.qris_payload])

  // Countdown lokal dari expires_at, disinkronkan tiap respons server.
  useEffect(() => {
    if (!order?.expires_at) {
      setRemaining(null)
      return
    }

    const tick = () => {
      const seconds = Math.max(0, Math.round((new Date(order.expires_at).getTime() - Date.now()) / 1000))
      setRemaining(seconds)

      if (seconds === 0 && order.payment_status === 'pending' && !checkFired.current) {
        checkFired.current = true
        refresh({ silent: true })
      }
    }

    tick()
    const timer = setInterval(tick, 1000)

    return () => clearInterval(timer)
  }, [order?.expires_at, order?.payment_status, refresh])

  const currentStep = useMemo(() => (order ? stepIndex(order) : 0), [order])

  if (loading && !order) return <Spinner label="Memuat status pesanan…" />

  if (error && !order) {
    return (
      <div className="customer">
        <Alert>{error.message}</Alert>
        <Link className="button" to="/">
          Kembali
        </Link>
      </div>
    )
  }

  if (!order) return null

  const isExpired = order.payment_status === 'expired'
  const isPendingQris = order.payment_status === 'pending' && order.payment_method === 'qris'
  const isPendingCash = order.payment_status === 'pending' && order.payment_method === 'cash'

  return (
    <div className="customer">
      <header className="customer__header">
        <div>
          <p className="muted small">
            {order.table ? `Meja ${order.table.table_number}` : ''} · {order.session_code}
          </p>
          <h1>{order.order_number}</h1>
        </div>
        <StatusBadge kind="payment_status" value={order.payment_status} />
      </header>

      <p className="muted small">
        <LiveBadge state={realtime} />{' '}
        {realtime === 'connected'
          ? 'Status diperbarui real-time.'
          : 'Status diperbarui otomatis tiap 4 detik.'}
      </p>

      {isExpired && (
        <Alert>
          Pesanan dibatalkan otomatis karena melewati batas waktu pembayaran. Silakan pesan ulang.
        </Alert>
      )}

      <section className="panel">
        <ol className="tracker">
          {STEPS.map((step, index) => {
            const state = index < currentStep ? 'done' : index === currentStep ? 'active' : 'todo'

            return (
              <li key={step.key} className={`tracker__step tracker__step--${state}`}>
                <span className="tracker__dot" />
                {step.label}
              </li>
            )
          })}
        </ol>
      </section>

      {isPendingQris && (
        <section className="panel panel--center">
          <h2>Pindai untuk membayar</h2>
          {qrDataUrl ? (
            <img className="qris" src={qrDataUrl} alt="Kode QRIS pesanan" width={260} height={260} />
          ) : (
            <p className="muted small">QRIS tidak tersedia.</p>
          )}
          <p className="countdown">{remaining === null ? '—' : durasi(remaining)}</p>
          <p className="muted small">
            Selesaikan pembayaran sebelum waktu habis. Status akan berubah otomatis setelah pembayaran
            terkonfirmasi.
          </p>
        </section>
      )}

      {isPendingCash && (
        <section className="panel panel--center">
          <h2>Tunjukkan nomor ini ke kasir</h2>
          <p className="queue-number">{order.order_number}</p>
          <p className="muted small">
            Bayar tunai di kasir. Pesanan baru masuk ke dapur setelah kasir mengonfirmasi pembayaran.
          </p>
          <p className="countdown">{remaining === null ? '—' : durasi(remaining)}</p>
        </section>
      )}

      <section className="panel">
        <h2>Rincian pesanan</h2>
        <ul className="line-list">
          {order.items.map((item, index) => (
            <li key={`${item.menu_id}-${index}`} className="line">
              <div className="line__head">
                <strong>
                  {item.quantity}× {item.menu_name}
                </strong>
                <span>{rupiah(item.subtotal_price)}</span>
              </div>
              {item.notes && <em className="muted small">“{item.notes}”</em>}
            </li>
          ))}
        </ul>

        <dl className="totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{rupiah(order.subtotal)}</dd>
          </div>
          <div>
            <dt>Pajak</dt>
            <dd>{rupiah(order.tax_amount)}</dd>
          </div>
          <div className="totals__grand">
            <dt>Total</dt>
            <dd>{rupiah(order.grand_total)}</dd>
          </div>
        </dl>

        <p className="muted small">
          Metode: {LABEL.payment_method[order.payment_method]} · Status dapur:{' '}
          {LABEL.kitchen_status[order.kitchen_status]}
        </p>
      </section>

      {order.timeline?.length > 0 && (
        <section className="panel">
          <h2>Riwayat status</h2>
          <ul className="timeline">
            {order.timeline.map((entry, index) => (
              <li key={`${entry.type}-${index}`}>
                <span className="muted small">{jam(entry.at)}</span>
                <span>
                  {LABEL[`${entry.type}_status`]?.[entry.value] ?? entry.value}
                  {entry.notes ? ` — ${entry.notes}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="muted small center">
        Halaman ini memperbarui status otomatis {realtime === 'connected' ? 'lewat WebSocket' : 'setiap 4 detik'}.
      </p>
    </div>
  )
}
