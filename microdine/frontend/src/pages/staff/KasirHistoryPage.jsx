import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { jam, rupiah, todayInput, LABEL } from '../../lib/format'
import { Alert, Empty, Spinner, StatusBadge } from '../../components/ui'

export function KasirHistoryPage() {
  const [filters, setFilters] = useState({ date: todayInput(), payment_method: '', payment_status: '' })
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (filters.date) params.set('date', filters.date)
    if (filters.payment_method) params.set('payment_method', filters.payment_method)
    if (filters.payment_status) params.set('payment_status', filters.payment_status)

    try {
      setData(await api.history(`?${params.toString()}`))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    load()
  }, [load])

  function handlePrint() {
    window.print()
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Histori Pesanan</h1>
          <p className="muted small">Transaksi harian + cetak ulang struk.</p>
        </div>
        <button type="button" className="button" onClick={load}>
          Muat ulang
        </button>
      </header>

      {error && <Alert>{error}</Alert>}

      <div className="filters">
        <label className="field">
          <span>Tanggal</span>
          <input
            className="input"
            type="date"
            value={filters.date}
            onChange={(event) => setFilters({ ...filters, date: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Metode</span>
          <select
            className="input"
            value={filters.payment_method}
            onChange={(event) => setFilters({ ...filters, payment_method: event.target.value })}
          >
            <option value="">Semua</option>
            <option value="qris">QRIS</option>
            <option value="cash">Tunai</option>
          </select>
        </label>

        <label className="field">
          <span>Status</span>
          <select
            className="input"
            value={filters.payment_status}
            onChange={(event) => setFilters({ ...filters, payment_status: event.target.value })}
          >
            <option value="">Semua</option>
            <option value="paid">Lunas</option>
            <option value="pending">Menunggu</option>
            <option value="expired">Kedaluwarsa</option>
            <option value="failed">Gagal</option>
          </select>
        </label>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <span className="muted small">Jumlah pesanan</span>
              <strong>{data?.summary.orders_count ?? 0}</strong>
            </div>
            <div className="stat">
              <span className="muted small">Total lunas</span>
              <strong>{rupiah(data?.summary.paid_total ?? 0)}</strong>
            </div>
          </div>

          {!data || data.orders.length === 0 ? (
            <Empty>Tidak ada transaksi pada filter ini.</Empty>
          ) : (
            <div className="split">
              <div className="panel panel--flush">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nomor</th>
                      <th>Jam</th>
                      <th>Meja</th>
                      <th>Metode</th>
                      <th>Status</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.orders.map((order) => (
                      <tr
                        key={order.id}
                        className={selected?.id === order.id ? 'row--active' : ''}
                        onClick={() => setSelected(order)}
                      >
                        <td>
                          <strong>{order.order_number}</strong>
                        </td>
                        <td>{jam(order.created_at)}</td>
                        <td>{order.table_number ?? '—'}</td>
                        <td>{LABEL.payment_method[order.payment_method]}</td>
                        <td>
                          <StatusBadge value={order.payment_status} />
                        </td>
                        <td className="text-right">{rupiah(order.grand_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selected && (
                <aside className="panel">
                  <header className="panel__head">
                    <h2>{selected.order_number}</h2>
                    <button type="button" className="button button--ghost" onClick={() => setSelected(null)}>
                      ×
                    </button>
                  </header>

                  <p className="muted small">
                    {LABEL.source[selected.source]} · Meja {selected.table_number ?? '—'} ·{' '}
                    {selected.session_code}
                  </p>

                  <ul className="line-list">
                    {selected.items.map((item, index) => (
                      <li key={`${item.menu_name}-${index}`} className="line">
                        <div className="line__head">
                          <span>
                            {item.quantity}× {item.menu_name}
                          </span>
                          <span>{rupiah(item.subtotal_price)}</span>
                        </div>
                        {item.notes && <em className="muted small">“{item.notes}”</em>}
                      </li>
                    ))}
                  </ul>

                  <dl className="totals">
                    <div>
                      <dt>Subtotal</dt>
                      <dd>{rupiah(selected.subtotal)}</dd>
                    </div>
                    <div>
                      <dt>Pajak</dt>
                      <dd>{rupiah(selected.tax_amount)}</dd>
                    </div>
                    <div className="totals__grand">
                      <dt>Total</dt>
                      <dd>{rupiah(selected.grand_total)}</dd>
                    </div>
                  </dl>

                  <p className="muted small">
                    {selected.paid_at ? `Dibayar ${jam(selected.paid_at)}` : 'Belum dibayar'}
                  </p>

                  <button type="button" className="button button--primary button--block" onClick={handlePrint}>
                    Cetak Struk
                  </button>
                </aside>
              )}
            </div>
          )}
        </>
      )}

      {/* Struk hanya terlihat saat mencetak. */}
      {selected && (
        <div className="receipt">
          <h2>{selected.order_number}</h2>
          <p>
            {new Date(selected.created_at).toLocaleString('id-ID')}
            <br />
            Meja {selected.table_number ?? '—'} · {selected.session_code}
          </p>
          <hr />
          {selected.items.map((item, index) => (
            <p key={`${item.menu_name}-${index}`}>
              {item.quantity}× {item.menu_name} — {rupiah(item.subtotal_price)}
            </p>
          ))}
          <hr />
          <p>Subtotal: {rupiah(selected.subtotal)}</p>
          <p>Pajak: {rupiah(selected.tax_amount)}</p>
          <p>
            <strong>Total: {rupiah(selected.grand_total)}</strong>
          </p>
          <p>{LABEL.payment_method[selected.payment_method]}</p>
          <p>Terima kasih telah berkunjung.</p>
        </div>
      )}
    </div>
  )
}
