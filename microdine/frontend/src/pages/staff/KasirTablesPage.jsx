import { useEffect, useMemo, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { api } from '../../lib/api'
import { rupiah } from '../../lib/format'
import { usePolling } from '../../hooks/usePolling'
import { useRealtime } from '../../lib/realtime'
import { Alert, Empty, LiveBadge, Spinner } from '../../components/ui'

function QrModal({ table, onClose }) {
  const [dataUrl, setDataUrl] = useState(null)
  const scanUrl = `${window.location.origin}/m/${table.qr_token}`

  useEffect(() => {
    QRCode.toDataURL(scanUrl, { margin: 1, width: 260 })
      .then(setDataUrl)
      .catch(() => setDataUrl(null))
  }, [scanUrl])

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__card modal__card--center">
        <header className="modal__head">
          <h2>QR Meja {table.table_number}</h2>
          <button type="button" className="button button--ghost" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </header>

        {dataUrl ? (
          <img src={dataUrl} alt={`QR meja ${table.table_number}`} width={260} height={260} />
        ) : (
          <p className="muted small">QR gagal dibuat.</p>
        )}

        <p className="muted small break">{scanUrl}</p>
        <p className="muted small">Barcode: {table.barcode_code}</p>
      </div>
    </div>
  )
}

function ManualOrderModal({ tables, initialTable, onClose, onDone }) {
  const [catalog, setCatalog] = useState(null)
  const [tableId, setTableId] = useState(String(initialTable?.id ?? tables[0]?.id ?? ''))
  const [barcode, setBarcode] = useState(initialTable?.barcode_code ?? '')
  const [method, setMethod] = useState('cash')
  const [customerName, setCustomerName] = useState('')
  const [items, setItems] = useState({})
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api
      .publicMenus()
      .then(setCatalog)
      .catch((err) => setError(err.message))
  }, [])

  const menus = useMemo(
    () => (catalog ? catalog.categories.flatMap((category) => category.menus) : []),
    [catalog],
  )

  const selected = Object.entries(items)
    .map(([menuId, quantity]) => {
      const menu = menus.find((item) => item.id === Number(menuId))

      return menu ? { menu, quantity } : null
    })
    .filter(Boolean)

  const subtotal = selected.reduce((total, line) => total + Number(line.menu.selling_price) * line.quantity, 0)
  const taxPercentage = catalog?.restaurant.tax.is_active ? Number(catalog.restaurant.tax.percentage) : 0
  const taxAmount = Math.round(subtotal * (taxPercentage / 100))

  function changeQuantity(menuId, delta) {
    setItems((current) => {
      const next = Math.max(0, (current[menuId] ?? 0) + delta)
      const clone = { ...current }

      if (next === 0) delete clone[menuId]
      else clone[menuId] = next

      return clone
    })
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError(null)

    if (selected.length === 0) {
      setError('Pilih minimal satu menu.')
      return
    }

    setLoading(true)
    try {
      const payload = {
        customer_name: customerName.trim() || null,
        payment_method: method,
        items: selected.map((line) => ({ menu_id: line.menu.id, quantity: line.quantity })),
      }

      if (barcode.trim()) payload.barcode_code = barcode.trim()
      else payload.table_id = Number(tableId)

      const order = await api.manualOrder(payload)
      onDone?.(order)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="modal" role="dialog" aria-modal="true">
      <div className="modal__card modal__card--wide">
        <header className="modal__head">
          <h2>Pesanan Manual</h2>
          <button type="button" className="button button--ghost" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </header>

        {error && <Alert>{error}</Alert>}

        <form onSubmit={handleSubmit} className="stack">
          <div className="grid-2">
            <label className="field">
              <span>Scan barcode meja (opsional)</span>
              <input
                className="input"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="TBL-01"
                autoFocus
              />
            </label>

            <label className="field">
              <span>atau pilih meja</span>
              <select className="input" value={tableId} onChange={(event) => setTableId(event.target.value)}>
                {tables.map((table) => (
                  <option key={table.id} value={table.id}>
                    {table.table_number} — {table.area} ({table.status})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Nama pemesan (opsional)</span>
            <input className="input" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </label>

          {!catalog ? (
            <Spinner label="Memuat menu…" />
          ) : (
            <div className="manual-menu">
              {catalog.categories.map((category) => (
                <div key={category.id}>
                  <h3 className="small muted">{category.name}</h3>
                  {category.menus.map((menu) => (
                    <div key={menu.id} className="manual-row">
                      <span>
                        {menu.name}
                        <em className="muted small"> · {rupiah(menu.selling_price)}</em>
                      </span>
                      <div className="stepper">
                        <button type="button" onClick={() => changeQuantity(menu.id, -1)} aria-label="Kurangi">
                          −
                        </button>
                        <span>{items[menu.id] ?? 0}</span>
                        <button type="button" onClick={() => changeQuantity(menu.id, 1)} aria-label="Tambah">
                          +
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          <fieldset className="field">
            <legend>Pembayaran</legend>
            <div className="chips">
              <button
                type="button"
                className={method === 'cash' ? 'chip chip--active' : 'chip'}
                onClick={() => setMethod('cash')}
              >
                Tunai
              </button>
              <button
                type="button"
                className={method === 'qris' ? 'chip chip--active' : 'chip'}
                onClick={() => setMethod('qris')}
              >
                QRIS
              </button>
            </div>
          </fieldset>

          <dl className="totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{rupiah(subtotal)}</dd>
            </div>
            <div>
              <dt>Pajak ({taxPercentage}%)</dt>
              <dd>{rupiah(taxAmount)}</dd>
            </div>
            <div className="totals__grand">
              <dt>Total</dt>
              <dd>{rupiah(subtotal + taxAmount)}</dd>
            </div>
          </dl>

          <button type="submit" className="button button--primary button--block" disabled={loading}>
            {loading ? 'Menyimpan…' : 'Buat Pesanan'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function KasirTablesPage() {
  const refreshRef = useRef(null)

  const realtime = useRealtime(['orders'], {
    OrderPaid: () => refreshRef.current?.({ silent: true }),
    OrderStatusUpdated: () => refreshRef.current?.({ silent: true }),
  })

  const { data: tables, error, loading, refresh } = usePolling(() => api.tables(), {
    intervalMs: realtime === 'connected' ? 20000 : 5000,
  })

  refreshRef.current = refresh

  const [qrTable, setQrTable] = useState(null)
  const [manualFor, setManualFor] = useState(undefined)
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState(null)

  async function handleClose(table) {
    if (!window.confirm(`Tutup sesi meja ${table.table_number}?`)) return

    setActionError(null)
    try {
      await api.closeTable(table.id)
      setNotice(`Sesi meja ${table.table_number} ditutup.`)
      await refresh({ silent: true })
    } catch (err) {
      setActionError(err.message)
    }
  }

  if (loading && !tables) return <Spinner label="Memuat meja…" />

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>
            Manajemen Meja <LiveBadge state={realtime} />
          </h1>
          <p className="muted small">Hijau = tersedia, merah = terisi. Diperbarui tiap 5 detik.</p>
        </div>
        <button type="button" className="button button--primary" onClick={() => setManualFor(null)}>
          Pesanan Manual
        </button>
      </header>

      {error && <Alert>{error.message}</Alert>}
      {actionError && <Alert onClose={() => setActionError(null)}>{actionError}</Alert>}
      {notice && (
        <Alert tone="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {!tables || tables.length === 0 ? (
        <Empty>Belum ada meja.</Empty>
      ) : (
        <div className="table-grid">
          {tables.map((table) => (
            <article key={table.id} className={`table-card table-card--${table.status}`}>
              <header>
                <strong>Meja {table.table_number}</strong>
                <span className="badge badge--subtle">{table.status === 'available' ? 'Tersedia' : 'Terisi'}</span>
              </header>

              <p className="muted small">
                {table.area} · kapasitas {table.capacity}
              </p>

              {table.session ? (
                <div className="table-card__session">
                  <p className="small">
                    Sesi {table.session.session_code} · {table.session.duration_minutes} menit
                  </p>
                  <p className="small">
                    {table.session.orders_count} pesanan · belum dibayar{' '}
                    <strong>{rupiah(table.session.unpaid_total)}</strong>
                  </p>
                </div>
              ) : (
                <p className="muted small">Belum ada sesi aktif.</p>
              )}

              <div className="table-card__actions">
                <button type="button" className="button button--ghost small" onClick={() => setQrTable(table)}>
                  QR
                </button>
                <button type="button" className="button button--ghost small" onClick={() => setManualFor(table)}>
                  Pesan
                </button>
                {table.session && (
                  <button type="button" className="button button--danger small" onClick={() => handleClose(table)}>
                    Tutup Sesi
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {qrTable && <QrModal table={qrTable} onClose={() => setQrTable(null)} />}
      {manualFor !== undefined && tables && (
        <ManualOrderModal
          tables={tables}
          initialTable={manualFor}
          onClose={() => setManualFor(undefined)}
          onDone={(order) => {
            setNotice(`Pesanan ${order.order_number} dibuat untuk meja ${order.table_number}.`)
            refresh({ silent: true })
          }}
        />
      )}
    </div>
  )
}
