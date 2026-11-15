import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const MENU = [
  { to: '/staff/queue', label: 'Antrean Kasir', roles: ['admin', 'kasir'] },
  { to: '/staff/tables', label: 'Meja', roles: ['admin', 'kasir'] },
  { to: '/staff/history', label: 'Histori', roles: ['admin', 'kasir'] },
  { to: '/staff/kitchen', label: 'Dapur', roles: ['admin', 'kitchen'] },
  { to: '/staff/admin/dashboard', label: 'Dashboard', roles: ['admin'] },
  { to: '/staff/admin/menus', label: 'Menu & HPP', roles: ['admin'] },
  { to: '/staff/admin/reports', label: 'Laporan', roles: ['admin'] },
  { to: '/staff/admin/targets', label: 'Target', roles: ['admin'] },
]

export function StaffLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/staff/login', { replace: true })
  }

  return (
    <div className="staff">
      <aside className="staff__sidebar">
        <div className="staff__brand">
          <strong>MICRODINE</strong>
          <span className="muted small">{user?.role}</span>
        </div>

        <nav className="staff__nav">
          {MENU.filter((item) => item.roles.includes(user?.role)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'staff__link staff__link--active' : 'staff__link')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="staff__footer">
          <span className="small muted">{user?.name}</span>
          <button type="button" className="button button--ghost" onClick={handleLogout}>
            Keluar
          </button>
        </div>
      </aside>

      <main className="staff__content">
        <Outlet />
      </main>
    </div>
  )
}
