import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../../lib/api'
import { rupiah } from '../../lib/format'
import { useCart } from '../../context/CartContext'
import { Alert, Spinner } from '../../components/ui'

export function CheckoutPage() {
  const { qrToken } = useParams()
  const navigate = useNavigate()
  const cart = useCart()

  const [tax, setTax] = useState({ name: 'PB1', percentage: 0, is_active: false })
  const [restaurant, setRestaurant] = useState('MICRODINE')
  const [customerName, setCustomerName] = useState('')
  const [method, setMethod] = useState('qris')
  const [error, setError] = useState(null)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .publicMenus()
      .then((data) => {
        setTax(data.restaurant.tax)
        setRestaurant(data.restaurant.name)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const taxAmount = tax.is_active ? Math.round(cart.subtotal * (Number(tax.percentage) / 100)) : 0
  const grandTotal = cart.subtotal + taxAmount

  async function handleSubmit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    setErrors({})

    try {
      const order = await api.createOrder({
        qr_token: qrToken,
        customer_name: customerName.trim() || null,
        payment_method: method,
        items: cart.lines.map((line) => ({
          menu_id: line.menu_id,
          quantity: line.quantity,
          notes: line.notes.trim() || null,
        })),
      })

      cart.clear()
      navigate(`/order/${order.order_number}`, { replace: true })
    } catch (err) {
      setError(err.message)
      if (err instanceof ApiError) setErrors(err.errors ?? {})
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <Spinner label="Menghitung total…" />

  if (cart.lines.length === 0) {
    return (
      <div className="customer">
        <Alert>Keranjang masih kosong.</Alert>
        <Link className="button button--primary" to={`/m/${qrToken}`}>
          Kembali ke menu
        </Link>
      </div>
    )
  }

  return (
    <div className="customer">
      <header className="customer__header">
        <div>
          <p className="muted small">{restaurant}</p>
          <h1>Konfirmasi Pesanan</h1>
        </div>
        <Link className="button button--ghost small" to={`/m/${qrToken}`}>
          Ubah
        </Link>
      </header>

      {error && <Alert>{error}</Alert>}

      <form className="panel" onSubmit={handleSubmit}>
        <label className="field">
          <span>Nama pemesan (opsional)</span>
          <input
            className="input"
            type="text"
            value={customerName}
            onChange={(event) => setCustomerName(event.target.value)}
            placeholder="Contoh: Budi"
            maxLength={100}
          />
          {errors.customer_name && <em className="field__error">{errors.customer_name[0]}</em>}
        </label>

        <ul className="line-list">
          {cart.lines.map((line) => (
            <li key={line.menu_id} className="line">
              <div className="line__head">
                <strong>
                  {line.quantity}× {line.name}
                </strong>
                <span>{rupiah(line.selling_price * line.quantity)}</span>
              </div>
              <input
                className="input input--small"
                type="text"
                placeholder="Catatan (mis. tanpa sambal)"
                value={line.notes}
                maxLength={255}
                onChange={(event) => cart.setNotes(line.menu_id, event.target.value)}
              />
            </li>
          ))}
        </ul>

        <dl className="totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{rupiah(cart.subtotal)}</dd>
          </div>
          <div>
            <dt>
              {tax.name} ({tax.percentage}%){!tax.is_active && ' — nonaktif'}
            </dt>
            <dd>{rupiah(taxAmount)}</dd>
          </div>
          <div className="totals__grand">
            <dt>Total</dt>
            <dd>{rupiah(grandTotal)}</dd>
          </div>
        </dl>

        <fieldset className="field">
          <legend>Metode pembayaran</legend>
          <label className={method === 'qris' ? 'radio radio--active' : 'radio'}>
            <input type="radio" name="method" value="qris" checked={method === 'qris'} onChange={() => setMethod('qris')} />
            <span>
              <strong>QRIS</strong>
              <em className="muted small">Bayar sendiri lewat aplikasi e-wallet / m-banking.</em>
            </span>
          </label>
          <label className={method === 'cash' ? 'radio radio--active' : 'radio'}>
            <input type="radio" name="method" value="cash" checked={method === 'cash'} onChange={() => setMethod('cash')} />
            <span>
              <strong>Tunai di Kasir</strong>
              <em className="muted small">Tunjukkan nomor antrean ke kasir.</em>
            </span>
          </label>
        </fieldset>

        {errors.items && <Alert>{errors.items[0]}</Alert>}

        <button type="submit" className="button button--primary button--block" disabled={submitting}>
          {submitting ? 'Mengirim pesanan…' : `Pesan sekarang · ${rupiah(grandTotal)}`}
        </button>
      </form>
    </div>
  )
}
