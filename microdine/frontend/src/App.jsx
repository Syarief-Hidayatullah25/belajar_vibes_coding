import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { StaffLayout } from './components/StaffLayout'
import { LandingPage } from './pages/LandingPage'
import { CatalogPage } from './pages/customer/CatalogPage'
import { CheckoutPage } from './pages/customer/CheckoutPage'
import { OrderStatusPage } from './pages/customer/OrderStatusPage'
import { LoginPage } from './pages/staff/LoginPage'
import { KasirQueuePage } from './pages/staff/KasirQueuePage'
import { KasirTablesPage } from './pages/staff/KasirTablesPage'
import { KasirHistoryPage } from './pages/staff/KasirHistoryPage'
import { KitchenPage } from './pages/staff/KitchenPage'
import { AdminDashboardPage } from './pages/staff/admin/AdminDashboardPage'
import { AdminMenusPage } from './pages/staff/admin/AdminMenusPage'
import { AdminReportsPage } from './pages/staff/admin/AdminReportsPage'
import { AdminTargetsPage } from './pages/staff/admin/AdminTargetsPage'

const KASIR = ['admin', 'kasir']
const KITCHEN = ['admin', 'kitchen']
const ADMIN = ['admin']

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />

      {/* Alur pelanggan (tanpa login) */}
      <Route path="/m/:qrToken" element={<CatalogPage />} />
      <Route path="/m/:qrToken/checkout" element={<CheckoutPage />} />
      <Route path="/order/:orderNumber" element={<OrderStatusPage />} />

      {/* Portal staf */}
      <Route path="/staff/login" element={<LoginPage />} />

      <Route
        path="/staff"
        element={
          <ProtectedRoute>
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/staff/queue" replace />} />

        <Route
          path="queue"
          element={
            <ProtectedRoute roles={KASIR}>
              <KasirQueuePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="tables"
          element={
            <ProtectedRoute roles={KASIR}>
              <KasirTablesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="history"
          element={
            <ProtectedRoute roles={KASIR}>
              <KasirHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="kitchen"
          element={
            <ProtectedRoute roles={KITCHEN}>
              <KitchenPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="admin/dashboard"
          element={
            <ProtectedRoute roles={ADMIN}>
              <AdminDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/menus"
          element={
            <ProtectedRoute roles={ADMIN}>
              <AdminMenusPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/reports"
          element={
            <ProtectedRoute roles={ADMIN}>
              <AdminReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/targets"
          element={
            <ProtectedRoute roles={ADMIN}>
              <AdminTargetsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function NotFound() {
  return (
    <div className="landing">
      <h1>404</h1>
      <p className="muted">Halaman tidak ditemukan.</p>
      <a className="button" href="/">
        Kembali ke beranda
      </a>
    </div>
  )
}
