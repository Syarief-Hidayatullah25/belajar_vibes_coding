import { useState } from 'react'
import { api } from '../../../lib/api'
import { angka, rupiah } from '../../../lib/format'
import { usePolling } from '../../../hooks/usePolling'
import { Alert, Empty, Spinner } from '../../../components/ui'

function TrendChart({ rows }) {
  const max = Math.max(...rows.map((row) => Number(row.omzet)), 1)

  return (
    <div className="chart">
      {rows.map((row) => (
        <div key={row.date} className="chart__col" title={`${row.date}: ${rupiah(row.omzet)}`}>
          <div className="chart__bars">
            <div className="chart__bar chart__bar--omzet" style={{ height: `${(Number(row.omzet) / max) * 100}%` }} />
            <div className="chart__bar chart__bar--hpp" style={{ height: `${(Number(row.hpp) / max) * 100}%` }} />
          </div>
          <span className="chart__label">{row.date.slice(8)}</span>
        </div>
      ))}
    </div>
  )
}

export function AdminDashboardPage() {
  const { data, error, loading } = usePolling(() => api.dashboard(), { intervalMs: 15000 })
  const [showDetail, setShowDetail] = useState(false)

  if (loading && !data) return <Spinner label="Menghitung analitik…" />

  if (error) return <Alert>{error.message}</Alert>

  const summary = data.summary
  const split = Object.entries(data.payment_split)

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Dashboard</h1>
          <p className="muted small">
            Periode {data.period.from} → {data.period.to} · hanya transaksi lunas
          </p>
        </div>
        <button type="button" className="button" onClick={() => setShowDetail((value) => !value)}>
          {showDetail ? 'Sembunyikan detail' : 'Lihat detail'}
        </button>
      </header>

      <div className="stat-row">
        <div className="stat stat--hero">
          <span className="muted small">Omzet</span>
          <strong>{rupiah(summary.omzet)}</strong>
          <span className="muted small">{angka(summary.orders_count)} transaksi lunas</span>
        </div>
        <div className="stat">
          <span className="muted small">HPP</span>
          <strong>{rupiah(summary.hpp_total)}</strong>
        </div>
        <div className="stat">
          <span className="muted small">Laba bersih</span>
          <strong>{rupiah(summary.net_profit)}</strong>
        </div>
        <div className="stat">
          <span className="muted small">Margin</span>
          <strong>{summary.margin_percent}%</strong>
        </div>
      </div>

      {showDetail && (
        <div className="stat-row">
          <div className="stat">
            <span className="muted small">Penjualan kotor (tanpa pajak)</span>
            <strong>{rupiah(summary.gross_sales)}</strong>
          </div>
          <div className="stat">
            <span className="muted small">Total pajak</span>
            <strong>{rupiah(summary.tax_total)}</strong>
          </div>
        </div>
      )}

      <section className="panel">
        <header className="panel__head">
          <h2>Tren 14 hari</h2>
          <div className="legend">
            <span className="legend__item legend__item--omzet">Omzet</span>
            <span className="legend__item legend__item--hpp">HPP</span>
          </div>
        </header>
        <TrendChart rows={data.trend_14_days} />
      </section>

      <div className="split">
        <section className="panel">
          <h2>Metode pembayaran</h2>
          {split.length === 0 ? (
            <Empty>Belum ada transaksi.</Empty>
          ) : (
            split.map(([method, value]) => (
              <div key={method} className="progress-row">
                <span>{method === 'qris' ? 'QRIS' : 'Tunai'}</span>
                <div className="progress">
                  <div className="progress__fill" style={{ width: `${value.percentage}%` }} />
                </div>
                <span className="small">
                  {rupiah(value.total)} · {value.percentage}%
                </span>
              </div>
            ))
          )}
        </section>

        <section className="panel">
          <h2>Top menu</h2>
          {data.top_menus.length === 0 ? (
            <Empty>Belum ada penjualan.</Empty>
          ) : (
            <ol className="ranked">
              {data.top_menus.map((menu) => (
                <li key={menu.menu_name}>
                  <span>{menu.menu_name}</span>
                  <strong>
                    {menu.quantity_sold} porsi · {rupiah(menu.revenue)}
                  </strong>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
