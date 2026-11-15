import { useCallback, useEffect, useState } from 'react'
import { api, getToken } from '../../../lib/api'
import { rupiah, todayInput, LABEL } from '../../../lib/format'
import { Alert, Empty, Spinner, StatusBadge } from '../../../components/ui'

function firstOfMonth() {
  const now = new Date()

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export function AdminReportsPage() {
  const [filters, setFilters] = useState({ from: firstOfMonth(), to: todayInput(), payment_method: '', payment_status: 'paid' })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [downloading, setDownloading] = useState(false)

  const query = useCallback(() => {
    const params = new URLSearchParams()
    if (filters.from) params.set('from', filters.from)
    if (filters.to) params.set('to', filters.to)
    if (filters.payment_method) params.set('payment_method', filters.payment_method)
    if (filters.payment_status) params.set('payment_status', filters.payment_status)

    return `?${params.toString()}`
  }, [filters])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      setData(await api.reports(query()))
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [query])

  useEffect(() => {
    load()
  }, [load])

  /**
   * Ekspor CSV butuh header Authorization, jadi diunduh lewat fetch lalu
   * dipaksa menjadi file — bukan sekadar <a href>.
   */
  async function handleExport() {
    setDownloading(true)
    setError(null)

    try {
      const response = await fetch(api.reportExportUrl(query()), {
        headers: { Authorization: `Bearer ${getToken()}`, Accept: 'text/csv' },
      })

      if (!response.ok) throw new Error(`Ekspor gagal (HTTP ${response.status})`)

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `microdine-report-${filters.from}-${filters.to}.csv`
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Laporan Transaksi</h1>
          <p className="muted small">HPP & laba per transaksi dihitung dari snapshot saat pesanan dibuat.</p>
        </div>
        <button type="button" className="button button--primary" onClick={handleExport} disabled={downloading}>
          {downloading ? 'Menyiapkan…' : 'Unduh CSV'}
        </button>
      </header>

      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}

      <div className="filters">
        <label className="field">
          <span>Dari</span>
          <input
            className="input"
            type="date"
            value={filters.from}
            onChange={(event) => setFilters({ ...filters, from: event.target.value })}
          />
        </label>
        <label className="field">
          <span>Sampai</span>
          <input
            className="input"
            type="date"
            value={filters.to}
            onChange={(event) => setFilters({ ...filters, to: event.target.value })}
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
      ) : !data || data.transactions.length === 0 ? (
        <Empty>Tidak ada transaksi pada rentang ini.</Empty>
      ) : (
        <>
          <div className="stat-row">
            <div className="stat">
              <span className="muted small">Transaksi</span>
              <strong>{data.totals.transactions}</strong>
            </div>
            <div className="stat">
              <span className="muted small">Omzet</span>
              <strong>{rupiah(data.totals.omzet)}</strong>
            </div>
            <div className="stat">
              <span className="muted small">HPP</span>
              <strong>{rupiah(data.totals.hpp)}</strong>
            </div>
            <div className="stat">
              <span className="muted small">Laba</span>
              <strong>{rupiah(data.totals.net_profit)}</strong>
            </div>
          </div>

          <div className="panel panel--flush">
            <table className="table">
              <thead>
                <tr>
                  <th>Nomor</th>
                  <th>Waktu</th>
                  <th>Meja</th>
                  <th>Metode</th>
                  <th>Status</th>
                  <th className="text-right">Kotor</th>
                  <th className="text-right">Pajak</th>
                  <th className="text-right">Total</th>
                  <th className="text-right">HPP</th>
                  <th className="text-right">Laba</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((row) => (
                  <tr key={row.order_number}>
                    <td>
                      <strong>{row.order_number}</strong>
                      <div className="muted small">{LABEL.source[row.source]}</div>
                    </td>
                    <td className="small">{new Date(row.created_at).toLocaleString('id-ID')}</td>
                    <td>{row.table_number ?? '—'}</td>
                    <td>{LABEL.payment_method[row.payment_method]}</td>
                    <td>
                      <StatusBadge value={row.payment_status} />
                    </td>
                    <td className="text-right">{rupiah(row.gross_sales)}</td>
                    <td className="text-right">{rupiah(row.tax_amount)}</td>
                    <td className="text-right">{rupiah(row.grand_total)}</td>
                    <td className="text-right">{rupiah(row.hpp)}</td>
                    <td className="text-right">
                      <strong>{rupiah(row.net_profit)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
