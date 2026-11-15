import { useCallback, useEffect, useState } from 'react'
import { api } from '../../../lib/api'
import { angka, rupiah } from '../../../lib/format'
import { Alert, Spinner } from '../../../components/ui'

function currentMonth() {
  const now = new Date()

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function AdminTargetsPage() {
  const [month, setMonth] = useState(currentMonth())
  const [data, setData] = useState(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await api.targets(month)
      setData(result)
      setAmount(result.target_amount ? String(Math.round(result.target_amount)) : '')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit(event) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setNotice(null)

    try {
      const result = await api.saveTarget({ month_year: month, monthly_target_amount: Number(amount) })
      setData(result)
      setNotice('Target disimpan.')
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const progress = data?.progress
  const achievement = Math.min(100, data?.achievement_percent ?? 0)

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Target Penjualan</h1>
          <p className="muted small">Realisasi, proyeksi, dan kebutuhan omzet harian.</p>
        </div>
        <label className="field field--inline">
          <span>Bulan</span>
          <input className="input" type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </header>

      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {notice && (
        <Alert tone="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <form className="inline-form" onSubmit={handleSubmit}>
        <input
          className="input"
          type="number"
          min={0}
          placeholder="Target bulanan (Rp)"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
        <button type="submit" className="button button--primary" disabled={saving}>
          {saving ? 'Menyimpan…' : 'Simpan target'}
        </button>
      </form>

      {loading ? (
        <Spinner />
      ) : (
        data && (
          <>
            <div className="stat-row">
              <div className="stat stat--hero">
                <span className="muted small">Realisasi</span>
                <strong>{rupiah(data.realization)}</strong>
                <span className="muted small">dari target {rupiah(data.target_amount)}</span>
              </div>
              <div className="stat">
                <span className="muted small">Sisa target</span>
                <strong>{rupiah(data.remaining_amount)}</strong>
              </div>
              <div className="stat">
                <span className="muted small">Capaian</span>
                <strong>{data.achievement_percent}%</strong>
              </div>
              <div className={progress.on_track ? 'stat stat--ok' : 'stat stat--warn'}>
                <span className="muted small">Proyeksi akhir bulan</span>
                <strong>{rupiah(progress.projected_month_end)}</strong>
                <span className="muted small">{progress.on_track ? 'Sesuai jalur' : 'Di bawah target'}</span>
              </div>
            </div>

            <section className="panel">
              <h2>Progress</h2>
              <div className="progress progress--tall">
                <div className="progress__fill" style={{ width: `${achievement}%` }} />
              </div>
              <p className="muted small">
                Hari berjalan {progress.elapsed_days}/{progress.days_in_month} · sisa {progress.remaining_days} hari
              </p>

              <dl className="totals">
                <div>
                  <dt>Rata-rata omzet harian</dt>
                  <dd>{rupiah(progress.daily_average)}</dd>
                </div>
                <div>
                  <dt>Kebutuhan omzet per hari tersisa</dt>
                  <dd>{rupiah(progress.required_daily_omzet)}</dd>
                </div>
                <div>
                  <dt>Transaksi lunas bulan ini</dt>
                  <dd>{angka(data.summary.orders_count)}</dd>
                </div>
                <div>
                  <dt>Laba bersih bulan ini</dt>
                  <dd>{rupiah(data.summary.net_profit)}</dd>
                </div>
              </dl>
            </section>
          </>
        )
      )}
    </div>
  )
}
