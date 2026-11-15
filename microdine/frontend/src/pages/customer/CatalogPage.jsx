import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../lib/api'
import { rupiah } from '../../lib/format'
import { useCart } from '../../context/CartContext'
import { Alert, Spinner } from '../../components/ui'

export function CatalogPage() {
  const { qrToken } = useParams()
  const navigate = useNavigate()
  const cart = useCart()

  const [table, setTable] = useState(null)
  const [session, setSession] = useState(null)
  const [joined, setJoined] = useState(false)
  const [catalog, setCatalog] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')

  useEffect(() => {
    let active = true
    setLoading(true)

    Promise.all([api.scanTable(qrToken), api.publicMenus()])
      .then(([scan, menus]) => {
        if (!active) return
        setTable(scan.table)
        setSession(scan.session)
        setJoined(!scan.session_created)
        setCatalog(menus)
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))

    return () => {
      active = false
    }
  }, [qrToken])

  const categories = useMemo(() => {
    if (!catalog) return []

    const keyword = search.trim().toLowerCase()

    return catalog.categories
      .map((category) => ({
        ...category,
        menus: category.menus.filter((menu) => keyword === '' || menu.name.toLowerCase().includes(keyword)),
      }))
      .filter((category) => category.menus.length > 0)
      .filter((category) => activeCategory === 'all' || String(category.id) === activeCategory)
  }, [catalog, search, activeCategory])

  if (loading) return <Spinner label="Menyiapkan meja…" />

  if (error) {
    return (
      <div className="customer">
        <Alert>{error}</Alert>
        <p className="muted small">
          QR meja tidak dikenali? Coba pindai ulang kode di meja, atau hubungi staf.
        </p>
      </div>
    )
  }

  return (
    <div className="customer customer--with-cart">
      <header className="customer__header">
        <div>
          <p className="muted small">{catalog.restaurant.name}</p>
          <h1>Meja {table.table_number}</h1>
          <p className="muted small">
            {table.area} · Sesi {session.session_code}
            {joined ? ' · Anda bergabung ke sesi yang sedang berjalan' : ''}
          </p>
        </div>
        <Link className="button button--ghost small" to="/">
          Keluar
        </Link>
      </header>

      <input
        className="input"
        type="search"
        placeholder="Cari menu…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />

      <div className="chips">
        <button
          type="button"
          className={activeCategory === 'all' ? 'chip chip--active' : 'chip'}
          onClick={() => setActiveCategory('all')}
        >
          Semua
        </button>
        {catalog.categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={String(category.id) === activeCategory ? 'chip chip--active' : 'chip'}
            onClick={() => setActiveCategory(String(category.id))}
          >
            {category.name}
          </button>
        ))}
      </div>

      {categories.length === 0 && <p className="empty">Menu tidak ditemukan.</p>}

      {categories.map((category) => (
        <section key={category.id} className="menu-section">
          <h2>{category.name}</h2>
          <div className="menu-list">
            {category.menus.map((menu) => {
              const line = cart.lines.find((item) => item.menu_id === menu.id)

              return (
                <article key={menu.id} className="menu-card">
                  <div className="menu-card__body">
                    <h3>{menu.name}</h3>
                    {menu.description && <p className="muted small">{menu.description}</p>}
                    <strong>{rupiah(menu.selling_price)}</strong>
                  </div>

                  {line ? (
                    <div className="stepper">
                      <button type="button" onClick={() => cart.decrease(menu.id)} aria-label="Kurangi">
                        −
                      </button>
                      <span>{line.quantity}</span>
                      <button type="button" onClick={() => cart.add(menu)} aria-label="Tambah">
                        +
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="button button--primary" onClick={() => cart.add(menu)}>
                      Tambah
                    </button>
                  )}
                </article>
              )
            })}
          </div>
        </section>
      ))}

      {cart.count > 0 && (
        <div className="cart-bar">
          <div>
            <span className="small muted">{cart.count} item</span>
            <strong>{rupiah(cart.subtotal)}</strong>
          </div>
          <button type="button" className="button button--primary" onClick={() => navigate(`/m/${qrToken}/checkout`)}>
            Lanjut pesan
          </button>
        </div>
      )}
    </div>
  )
}
