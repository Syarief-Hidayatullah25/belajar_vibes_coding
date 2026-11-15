/**
 * Klien API MICRODINE.
 *
 * Satu tempat untuk: base URL, Bearer token, dan normalisasi envelope
 * `{ success, data, message }` / `{ success, message, errors }`.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1').replace(/\/+$/, '')

const TOKEN_KEY = 'microdine.token'

export class ApiError extends Error {
  constructor(message, status, errors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token)
  } else {
    localStorage.removeItem(TOKEN_KEY)
  }
}

async function request(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const isFormData = body instanceof FormData
  const token = auth ? getToken() : null

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.message ?? `Request gagal (HTTP ${response.status})`, response.status, payload?.errors ?? {})
  }

  return payload?.data ?? null
}

export const api = {
  baseUrl: BASE_URL,

  // ---------------------------------------------------------------- publik
  scanTable: (qrToken) => request(`/public/tables/scan/${qrToken}`, { auth: false }),
  publicMenus: () => request('/public/menus', { auth: false }),
  createOrder: (payload) => request('/public/orders', { method: 'POST', body: payload, auth: false }),
  getOrder: (orderNumber) => request(`/public/orders/${orderNumber}`, { auth: false }),

  // ------------------------------------------------------------------ auth
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password }, auth: false }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  // ------------------------------------------------------------- pengaturan
  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', { method: 'PUT', body: payload }),

  // ----------------------------------------------------------------- admin
  categories: () => request('/admin/categories'),
  createCategory: (payload) => request('/admin/categories', { method: 'POST', body: payload }),
  updateCategory: (id, payload) => request(`/admin/categories/${id}`, { method: 'PUT', body: payload }),
  deleteCategory: (id) => request(`/admin/categories/${id}`, { method: 'DELETE' }),

  menus: (params = '') => request(`/admin/menus${params}`),
  createMenu: (payload) => request('/admin/menus', { method: 'POST', body: payload }),
  updateMenu: (id, payload) => request(`/admin/menus/${id}`, { method: 'PUT', body: payload }),
  deleteMenu: (id) => request(`/admin/menus/${id}`, { method: 'DELETE' }),
  uploadMenuImage: (id, file) => {
    const form = new FormData()
    form.append('image', file)
    return request(`/admin/menus/${id}/image`, { method: 'POST', body: form })
  },

  staff: () => request('/admin/staff'),
  createStaff: (payload) => request('/admin/staff', { method: 'POST', body: payload }),
  updateStaff: (id, payload) => request(`/admin/staff/${id}`, { method: 'PUT', body: payload }),
  deleteStaff: (id) => request(`/admin/staff/${id}`, { method: 'DELETE' }),

  dashboard: (params = '') => request(`/admin/analytics/dashboard${params}`),
  reports: (params = '') => request(`/admin/analytics/reports${params}`),
  reportExportUrl: (params = '') => `${BASE_URL}/admin/analytics/reports/export${params}`,
  targets: (month) => request(`/admin/analytics/targets${month ? `?month=${month}` : ''}`),
  saveTarget: (payload) => request('/admin/analytics/targets', { method: 'POST', body: payload }),

  // ------------------------------------------------------------ operasional
  tables: () => request('/operations/tables'),
  closeTable: (tableId) => request(`/operations/tables/${tableId}/close`, { method: 'POST' }),
  queue: (screen = 'kasir') => request(`/operations/orders/queue?screen=${screen}`),
  updateKitchenStatus: (orderId, status, notes) =>
    request(`/operations/orders/${orderId}/kitchen-status`, { method: 'PATCH', body: { kitchen_status: status, notes } }),
  history: (params = '') => request(`/operations/orders/history${params}`),
  manualOrder: (payload) => request('/operations/orders/manual', { method: 'POST', body: payload }),
  confirmCash: (orderId, cashReceived) =>
    request(`/cashier/orders/${orderId}/confirm-cash`, { method: 'POST', body: { cash_received: cashReceived } }),
}
