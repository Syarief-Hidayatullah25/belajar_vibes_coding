import { useCallback, useEffect, useState } from 'react'
import { api } from './lib/api'
import './App.css'

function HealthBadge({ status, detail, onRetry }) {
  const label = {
    loading: 'Menghubungi API…',
    ok: `API terhubung — ${detail ?? 'ok'}`,
    error: `API gagal dihubungi — ${detail}`,
  }[status]

  return (
    <div className={`health health--${status}`}>
      <span>{label}</span>
      <button type="button" onClick={onRetry} disabled={status === 'loading'}>
        Cek ulang
      </button>
    </div>
  )
}

export default function App() {
  const [health, setHealth] = useState({ status: 'loading', detail: null })
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ name: '', description: '' })
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const checkHealth = useCallback(async () => {
    setHealth({ status: 'loading', detail: null })
    try {
      const data = await api.health()
      setHealth({ status: 'ok', detail: data?.status })
    } catch (err) {
      setHealth({ status: 'error', detail: err.message })
    }
  }, [])

  const loadItems = useCallback(async () => {
    try {
      setItems(await api.listItems())
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    checkHealth()
    loadItems()
  }, [checkHealth, loadItems])

  async function handleSubmit(event) {
    event.preventDefault()
    if (!form.name.trim()) return

    setBusy(true)
    try {
      await api.createItem({ name: form.name.trim(), description: form.description.trim() || null })
      setForm({ name: '', description: '' })
      await loadItems()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleItem(item) {
    try {
      await api.updateItem(item.id, { is_done: !item.is_done })
      await loadItems()
    } catch (err) {
      setError(err.message)
    }
  }

  async function removeItem(item) {
    try {
      await api.deleteItem(item.id)
      await loadItems()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <main className="page">
      <header className="page__header">
        <h1>VCing — React + Laravel API</h1>
        <p className="page__subtitle">
          Frontend ini memanggil REST API Laravel di <code>{api.baseUrl}</code>
        </p>
      </header>

      <HealthBadge status={health.status} detail={health.detail} onRetry={checkHealth} />

      {error && <p className="alert">Error: {error}</p>}

      <section className="panel">
        <h2>Items (PostgreSQL)</h2>

        <form className="form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Nama item"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            type="text"
            placeholder="Deskripsi (opsional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <button type="submit" disabled={busy}>
            {busy ? 'Menyimpan…' : 'Tambah'}
          </button>
        </form>

        {items.length === 0 ? (
          <p className="muted">Belum ada item.</p>
        ) : (
          <ul className="items">
            {items.map((item) => (
              <li key={item.id} className={item.is_done ? 'item item--done' : 'item'}>
                <label>
                  <input type="checkbox" checked={item.is_done} onChange={() => toggleItem(item)} />
                  <span>
                    <strong>{item.name}</strong>
                    {item.description && <em>{item.description}</em>}
                  </span>
                </label>
                <button type="button" className="danger" onClick={() => removeItem(item)}>
                  Hapus
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
