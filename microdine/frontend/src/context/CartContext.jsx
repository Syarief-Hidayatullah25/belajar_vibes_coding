import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const CartContext = createContext(null)

const STORAGE_KEY = 'microdine.cart'

export function CartProvider({ children }) {
  const [lines, setLines] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(lines))
  }, [lines])

  const add = (menu) => {
    setLines((current) => {
      const found = current.find((line) => line.menu_id === menu.id)

      if (found) {
        return current.map((line) =>
          line.menu_id === menu.id ? { ...line, quantity: Math.min(99, line.quantity + 1) } : line,
        )
      }

      return [
        ...current,
        {
          menu_id: menu.id,
          name: menu.name,
          selling_price: Number(menu.selling_price),
          quantity: 1,
          notes: '',
        },
      ]
    })
  }

  const decrease = (menuId) => {
    setLines((current) =>
      current.flatMap((line) => {
        if (line.menu_id !== menuId) return [line]
        if (line.quantity <= 1) return []

        return [{ ...line, quantity: line.quantity - 1 }]
      }),
    )
  }

  const setNotes = (menuId, notes) => {
    setLines((current) => current.map((line) => (line.menu_id === menuId ? { ...line, notes } : line)))
  }

  const clear = () => setLines([])

  const value = useMemo(() => {
    const subtotal = lines.reduce((total, line) => total + line.selling_price * line.quantity, 0)
    const count = lines.reduce((total, line) => total + line.quantity, 0)

    return { lines, add, decrease, setNotes, clear, subtotal, count }
  }, [lines])

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)

  if (context === null) {
    throw new Error('useCart harus dipakai di dalam CartProvider')
  }

  return context
}
