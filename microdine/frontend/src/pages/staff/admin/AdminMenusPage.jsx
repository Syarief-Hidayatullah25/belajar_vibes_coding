import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../../lib/api'
import { rupiah } from '../../../lib/format'
import { Alert, Empty, Spinner } from '../../../components/ui'

const EMPTY_FORM = {
  id: null,
  category_id: '',
  name: '',
  description: '',
  hpp: '',
  selling_price: '',
  is_available: true,
}

function MenuFormModal({ menu, categories, onClose, onSaved }) {
  const [form, setForm] = useState(() =>
    menu
      ? {
          id: menu.id,
          category_id: String(menu.category_id),
          name: menu.name,
          description: menu.description ?? '',
          hpp: String(menu.hpp),
          selling_price: String(menu.selling_price),
          is_available: menu.is_available,
        }
      : { ...EMPTY_FORM, category_id: String(categories[0]?.id ?? '') },
  )
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const hpp = Number(form.hpp || 0)
  const price = Number(form.selling_price || 0)
  const margin = price - hpp
  const marginPercent = price > 0 ? (margin / price) * 100 : 0
  const marginValid = price >= hpp

  async function handleSubmit(event) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      category_id: Number(form.category_id),
      name: form.name.trim(),
      description: form.description.trim() || null,
      hpp: Number(form.hpp),
      selling_price: Number(form.selling_price),
      is_available: form.is_available,
    }

    try {
      const saved = form.id
        ? await api.updateMenu(form.id, payload)
        : await api.createMenu(payload)

      onSaved(saved)
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
          <h2>{form.id ? 'Ubah Menu' : 'Menu Baru'}</h2>
          <button type="button" className="button button--ghost" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </header>

        {error && <Alert>{error}</Alert>}

        <form className="stack" onSubmit={handleSubmit}>
          <div className="grid-2">
            <label className="field">
              <span>Nama menu</span>
              <input
                className="input"
                value={form.name}
                required
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Kategori</span>
              <select
                className="input"
                value={form.category_id}
                required
                onChange={(event) => setForm({ ...form, category_id: event.target.value })}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="field">
            <span>Deskripsi</span>
            <textarea
              className="input"
              rows={2}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </label>

          <div className="grid-2">
            <label className="field">
              <span>HPP (modal)</span>
              <input
                className="input"
                type="number"
                min={0}
                required
                value={form.hpp}
                onChange={(event) => setForm({ ...form, hpp: event.target.value })}
              />
            </label>

            <label className="field">
              <span>Harga jual</span>
              <input
                className="input"
                type="number"
                min={0}
                required
                value={form.selling_price}
                onChange={(event) => setForm({ ...form, selling_price: event.target.value })}
              />
            </label>
          </div>

          <div className={marginValid ? 'margin-box' : 'margin-box margin-box--invalid'}>
            <div>
              <span className="muted small">Margin nominal</span>
              <strong>{rupiah(margin)}</strong>
            </div>
            <div>
              <span className="muted small">Margin %</span>
              <strong>{marginPercent.toFixed(1)}%</strong>
            </div>
            {!marginValid && <p className="small">Harga jual tidak boleh di bawah HPP.</p>}
          </div>

          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.is_available}
              onChange={(event) => setForm({ ...form, is_available: event.target.checked })}
            />
            <span>Tersedia untuk dijual</span>
          </label>

          <button type="submit" className="button button--primary button--block" disabled={loading || !marginValid}>
            {loading ? 'Menyimpan…' : 'Simpan'}
          </button>
        </form>
      </div>
    </div>
  )
}

export function AdminMenusPage() {
  const [menus, setMenus] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [notice, setNotice] = useState(null)
  const [formMenu, setFormMenu] = useState(undefined)
  const [newCategory, setNewCategory] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [menuData, categoryData] = await Promise.all([api.menus(), api.categories()])
      setMenus(menuData)
      setCategories(categoryData)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map()

    for (const menu of menus) {
      const key = menu.category?.name ?? 'Tanpa kategori'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(menu)
    }

    return [...map.entries()]
  }, [menus])

  async function toggle(menu) {
    try {
      await api.updateMenu(menu.id, {
        category_id: menu.category_id,
        name: menu.name,
        hpp: Number(menu.hpp),
        selling_price: Number(menu.selling_price),
        is_available: !menu.is_available,
      })
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleUpload(menu, file) {
    if (!file) return

    try {
      await api.uploadMenuImage(menu.id, file)
      setNotice(`Gambar ${menu.name} diperbarui.`)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleDelete(menu) {
    if (!window.confirm(`Hapus menu ${menu.name}?`)) return

    try {
      await api.deleteMenu(menu.id)
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  async function handleAddCategory(event) {
    event.preventDefault()
    if (!newCategory.trim()) return

    try {
      await api.createCategory({ name: newCategory.trim() })
      setNewCategory('')
      await load()
    } catch (err) {
      setError(err.message)
    }
  }

  if (loading && menus.length === 0) return <Spinner label="Memuat menu…" />

  return (
    <div className="page">
      <header className="page__head">
        <div>
          <h1>Menu & HPP</h1>
          <p className="muted small">Margin dihitung otomatis: harga jual − HPP.</p>
        </div>
        <button type="button" className="button button--primary" onClick={() => setFormMenu(null)}>
          Menu Baru
        </button>
      </header>

      {error && <Alert onClose={() => setError(null)}>{error}</Alert>}
      {notice && (
        <Alert tone="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      <form className="inline-form" onSubmit={handleAddCategory}>
        <input
          className="input"
          placeholder="Kategori baru…"
          value={newCategory}
          onChange={(event) => setNewCategory(event.target.value)}
        />
        <button type="submit" className="button">
          Tambah kategori
        </button>
      </form>

      {grouped.length === 0 && <Empty>Belum ada menu.</Empty>}

      {grouped.map(([categoryName, items]) => (
        <section key={categoryName} className="panel panel--flush">
          <h2 className="panel__title">{categoryName}</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Menu</th>
                <th className="text-right">HPP</th>
                <th className="text-right">Harga</th>
                <th className="text-right">Margin</th>
                <th className="text-right">Margin %</th>
                <th>Status</th>
                <th>Gambar</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((menu) => {
                const margin = Number(menu.selling_price) - Number(menu.hpp)
                const percent = Number(menu.selling_price) > 0 ? (margin / Number(menu.selling_price)) * 100 : 0

                return (
                  <tr key={menu.id}>
                    <td>
                      <strong>{menu.name}</strong>
                      {menu.description && <div className="muted small">{menu.description}</div>}
                    </td>
                    <td className="text-right">{rupiah(menu.hpp)}</td>
                    <td className="text-right">{rupiah(menu.selling_price)}</td>
                    <td className="text-right">{rupiah(margin)}</td>
                    <td className="text-right">{percent.toFixed(1)}%</td>
                    <td>
                      <button type="button" className="button button--ghost small" onClick={() => toggle(menu)}>
                        {menu.is_available ? 'Tersedia' : 'Nonaktif'}
                      </button>
                    </td>
                    <td>
                      <label className="button button--ghost small">
                        {menu.image_url ? 'Ganti' : 'Unggah'}
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          hidden
                          onChange={(event) => handleUpload(menu, event.target.files?.[0])}
                        />
                      </label>
                    </td>
                    <td className="text-right">
                      <button type="button" className="button button--ghost small" onClick={() => setFormMenu(menu)}>
                        Ubah
                      </button>
                      <button type="button" className="button button--danger small" onClick={() => handleDelete(menu)}>
                        Hapus
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </section>
      ))}

      {formMenu !== undefined && categories.length > 0 && (
        <MenuFormModal
          menu={formMenu}
          categories={categories}
          onClose={() => setFormMenu(undefined)}
          onSaved={() => load()}
        />
      )}
    </div>
  )
}
