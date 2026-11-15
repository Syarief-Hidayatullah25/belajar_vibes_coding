/**
 * Lapisan akses API.
 *
 * Semua pemanggilan ke Backend melewati file ini supaya base URL dan bentuk
 * response (`{ success, data, message }`) hanya ditangani di satu tempat.
 */

const BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api').replace(/\/+$/, '')

async function request(path, { body, ...options } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok || payload?.success === false) {
    const message = payload?.message ?? `Request gagal (HTTP ${response.status})`
    throw new Error(message)
  }

  return payload?.data ?? payload
}

export const api = {
  baseUrl: BASE_URL,
  health: () => request('/health'),
  listItems: () => request('/items'),
  createItem: (item) => request('/items', { method: 'POST', body: item }),
  updateItem: (id, item) => request(`/items/${id}`, { method: 'PUT', body: item }),
  deleteItem: (id) => request(`/items/${id}`, { method: 'DELETE' }),
}
