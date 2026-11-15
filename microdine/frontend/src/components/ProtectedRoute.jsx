import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './ui'

export function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <Spinner label="Memeriksa sesi…" />
  }

  if (!user) {
    return <Navigate to="/staff/login" state={{ from: location.pathname }} replace />
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="panel">
        <h2>Tidak punya akses</h2>
        <p className="muted">
          Halaman ini hanya untuk role: {roles.join(', ')}. Role Anda: <strong>{user.role}</strong>.
        </p>
      </div>
    )
  }

  return children
}
