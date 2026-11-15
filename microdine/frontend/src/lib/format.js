export function rupiah(value) {
  const number = Number(value ?? 0)

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(number) ? number : 0)
}

export function angka(value) {
  return new Intl.NumberFormat('id-ID').format(Number(value ?? 0))
}

export function jam(isoString) {
  if (!isoString) return '—'

  return new Date(isoString).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export function tanggal(isoString) {
  if (!isoString) return '—'

  return new Date(isoString).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function waktuLalu(isoString) {
  if (!isoString) return '—'

  const diffSeconds = Math.max(0, Math.round((Date.now() - new Date(isoString).getTime()) / 1000))

  if (diffSeconds < 60) return `${diffSeconds} detik lalu`
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} menit lalu`
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)} jam lalu`

  return `${Math.floor(diffSeconds / 86400)} hari lalu`
}

export function durasi(seconds) {
  const total = Math.max(0, Math.floor(seconds ?? 0))
  const m = Math.floor(total / 60)
  const s = total % 60

  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function todayInput() {
  const now = new Date()
  const offset = now.getTimezoneOffset()

  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10)
}

export const LABEL = {
  payment_status: {
    pending: 'Menunggu Bayar',
    paid: 'Lunas',
    failed: 'Gagal',
    expired: 'Kedaluwarsa',
  },
  kitchen_status: {
    waiting: 'Menunggu',
    cooking: 'Dimasak',
    ready: 'Siap',
    served: 'Disajikan',
  },
  payment_method: {
    qris: 'QRIS',
    cash: 'Tunai',
  },
  source: {
    qr_customer: 'Scan Meja',
    pos_cashier: 'Kasir',
  },
}
