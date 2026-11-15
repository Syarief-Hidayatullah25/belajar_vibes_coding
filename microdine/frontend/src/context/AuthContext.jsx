import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, ApiError, getToken, setToken } from '../lib/api'

const AuthContext = createContext(null)

const USER_KEY = 'microdine.user'

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null')
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(Boolean(getToken()))

  const persist = useCallback((nextUser) => {
    setUser(nextUser)
    if (nextUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(nextUser))
    } else {
      localStorage.removeItem(USER_KEY)
    }
  }, [])

  // Validasi token tersimpan sekali saat aplikasi dibuka.
  useEffect(() => {
    if (!getToken()) {
      setLoading(false)
      return
    }

    let active = true
    api
      .me()
      .then((data) => {
        if (active) persist(data)
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          setToken(null)
          persist(null)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [persist])

  const login = useCallback(
    async (username, password) => {
      const data = await api.login(username, password)
      setToken(data.token)
      persist(data.user)

      return data.user
    },
    [persist],
  )

  const logout = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      // Token mungkin sudah tidak valid; tetap bersihkan state lokal.
    }
    setToken(null)
    persist(null)
  }, [persist])

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user) && Boolean(getToken()),
      login,
      logout,
      hasRole: (...roles) => Boolean(user) && roles.includes(user.role),
    }),
    [user, loading, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (context === null) {
    throw new Error('useAuth harus dipakai di dalam AuthProvider')
  }

  return context
}
