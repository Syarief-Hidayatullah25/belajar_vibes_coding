/**
 * Verifikasi frontend MICRODINE di browser sungguhan (Edge headless via Playwright).
 *
 * Menjalankan alur pelanggan (scan → pesan) dan menelusuri semua halaman staf,
 * sambil mengumpulkan error console/page. Screenshot disimpan untuk bukti visual.
 *
 * Prasyarat: backend :8000 dan frontend :5173 hidup.
 * Pakai: bun scripts/browser-check.mjs
 */
import { mkdir } from 'node:fs/promises'
import { createHmac } from 'node:crypto'
import { chromium } from 'playwright-core'

const APP = 'http://localhost:5173'
const API = 'http://localhost:8000/api/v1'
const GATEWAY_SECRET = 'mock-secret-key'
const SHOTS = '.screens'

const results = []
const errors = []

function check(label, ok, detail = '') {
  results.push({ label, ok, detail })
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !detail ? '' : `  ->  ${detail}`}`)
}

async function apiLogin(username) {
  const response = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'password' }),
  })
  const payload = await response.json()

  return payload.data.token
}

function watch(page, tag) {
  page.on('pageerror', (error) => errors.push(`[${tag}] pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`[${tag}] console: ${message.text()}`)
  })
}

async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: false })
}

await mkdir(SHOTS, { recursive: true })

const browser = await chromium.launch({ channel: 'msedge', headless: true })

try {
  // ------------------------------------------------------------- pelanggan
  const kasirToken = await apiLogin('kasir')
  const tablesResponse = await fetch(`${API}/operations/tables`, {
    headers: { Authorization: `Bearer ${kasirToken}` },
  })
  const tables = (await tablesResponse.json()).data
  const table = tables.find((item) => item.status === 'available') ?? tables[0]

  console.log(`\n== Alur pelanggan (meja ${table.table_number}) ==`)

  const customerContext = await browser.newContext({ viewport: { width: 420, height: 920 } })
  const page = await customerContext.newPage()
  watch(page, 'customer')

  await page.goto(`${APP}/m/${table.qr_token}`, { waitUntil: 'networkidle' })
  await page.getByRole('heading', { name: `Meja ${table.table_number}` }).waitFor({ timeout: 15000 })
  check('katalog menampilkan nomor meja dari QR', true)
  check('katalog menampilkan menu', await page.getByText('Nasi Goreng Spesial').first().isVisible())
  await shot(page, '01-katalog')

  await page.getByRole('button', { name: 'Tambah' }).first().click()
  check('tombol tambah mengubah stepper', await page.locator('.stepper').first().isVisible())

  await page.getByRole('button', { name: /Lanjut pesan/i }).click()
  await page.waitForURL(/checkout/, { timeout: 10000 })
  await page.getByRole('heading', { name: 'Konfirmasi Pesanan' }).waitFor()
  check('halaman checkout terbuka', true)
  check('checkout menampilkan pajak', await page.getByText(/\(10%\)/).first().isVisible())
  await shot(page, '02-checkout')

  await page.getByRole('button', { name: /Pesan sekarang/i }).click()
  await page.waitForURL(/\/order\//, { timeout: 15000 })
  await page.waitForTimeout(1500)

  const orderNumber = page.url().split('/').pop()
  check('halaman status pesanan terbuka', /^A-\d+$/.test(orderNumber), orderNumber)
  check('tracker status tampil', await page.locator('.tracker').isVisible())
  check('QRIS atau nomor antrean tampil', await page.locator('.qris, .queue-number').first().isVisible())
  await shot(page, '03-status-pesanan')

  // Bayar lewat webhook mock, lalu pastikan halaman status ter-update TANPA reload.
  const orderResponse = await fetch(`${API}/public/orders/${orderNumber}`)
  const orderDetail = (await orderResponse.json()).data
  const webhookBody = JSON.stringify({
    ref_id: JSON.parse(orderDetail.qris_payload).ref_id,
    status: 'paid',
  })
  const signature = createHmac('sha256', GATEWAY_SECRET).update(webhookBody).digest('hex')
  const webhookResponse = await fetch(`${API}/payments/webhook/qris`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Callback-Signature': signature },
    body: webhookBody,
  })
  check('webhook QRIS mock diterima', webhookResponse.ok, `HTTP ${webhookResponse.status}`)

  // Label langkah tracker selalu ada di DOM, jadi tunggu badge status berubah
  // menjadi "Lunas" dan panel QRIS hilang — bukan sekadar teks statis.
  await page.locator('.badge--paid').first().waitFor({ timeout: 15000 })
  check('halaman status ter-update otomatis setelah bayar (polling)', true)
  check('panel QRIS hilang setelah lunas', (await page.locator('.qris').count()) === 0, 'QRIS masih tampil')
  check(
    'badge berubah menjadi Lunas',
    (await page.locator('.badge--paid').first().innerText()).trim() === 'Lunas',
  )
  await shot(page, '03b-status-lunas')

  // --------------------------------------------------- staff: kasir melihat order
  const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const staff = await staffContext.newPage()
  watch(staff, 'staff')

  await staff.goto(`${APP}/staff/login`, { waitUntil: 'networkidle' })
  await staff.getByLabel('Username').fill('kasir')
  await staff.getByLabel('Password').fill('password')
  await staff.getByRole('button', { name: 'Masuk' }).click()
  await staff.waitForURL(/\/staff\/queue/, { timeout: 15000 })
  check('login kasir diarahkan ke antrean', true)

  await staff.waitForTimeout(1500)
  check('pesanan pelanggan muncul di antrean kasir', await staff.getByText(orderNumber).first().isVisible())
  await shot(staff, '04-kanban-kasir')

  await staff.goto(`${APP}/staff/tables`, { waitUntil: 'networkidle' })
  await staff.getByRole('heading', { name: 'Manajemen Meja' }).waitFor()
  check('halaman meja menampilkan grid', (await staff.locator('.table-card').count()) > 0)
  await shot(staff, '05-meja')

  await staff.goto(`${APP}/staff/history`, { waitUntil: 'networkidle' })
  await staff.getByRole('heading', { name: 'Histori Pesanan' }).waitFor()
  await staff.waitForTimeout(1200)
  check('histori memuat data transaksi', (await staff.locator('tbody tr').count()) > 0)
  await shot(staff, '06-histori')

  // --------------------------------------------------------- admin: dashboard
  const adminContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const admin = await adminContext.newPage()
  watch(admin, 'admin')

  await admin.goto(`${APP}/staff/login`, { waitUntil: 'networkidle' })
  await admin.getByLabel('Username').fill('admin')
  await admin.getByLabel('Password').fill('password')
  await admin.getByRole('button', { name: 'Masuk' }).click()
  await admin.waitForURL(/admin\/dashboard/, { timeout: 15000 })
  await admin.getByText('Omzet').first().waitFor({ timeout: 15000 })
  check('login admin diarahkan ke dashboard', true)
  check('dashboard menampilkan 14 batang tren', (await admin.locator('.chart__col').count()) === 14)
  await shot(admin, '07-dashboard-admin')

  await admin.goto(`${APP}/staff/admin/menus`, { waitUntil: 'networkidle' })
  await admin.getByRole('heading', { name: 'Menu & HPP' }).waitFor()
  check('tabel menu memuat margin', (await admin.locator('.table tbody tr').count()) > 0)
  await shot(admin, '08-menu-hpp')

  await admin.goto(`${APP}/staff/admin/reports`, { waitUntil: 'networkidle' })
  await admin.getByRole('heading', { name: 'Laporan Transaksi' }).waitFor()
  await admin.waitForTimeout(1200)
  check('laporan menampilkan kolom HPP & laba', await admin.getByText('HPP').first().isVisible())
  await shot(admin, '09-laporan')

  await admin.goto(`${APP}/staff/admin/targets`, { waitUntil: 'networkidle' })
  await admin.getByRole('heading', { name: 'Target Penjualan' }).waitFor()
  await admin.waitForTimeout(1200)
  check('target menampilkan proyeksi', await admin.getByText(/Proyeksi akhir bulan/i).first().isVisible())
  await shot(admin, '10-target')

  // ------------------------------------------------------------ dapur (KDS)
  const kitchenContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const kitchen = await kitchenContext.newPage()
  watch(kitchen, 'kitchen')

  await kitchen.goto(`${APP}/staff/login`, { waitUntil: 'networkidle' })
  await kitchen.getByLabel('Username').fill('kitchen')
  await kitchen.getByLabel('Password').fill('password')
  await kitchen.getByRole('button', { name: 'Masuk' }).click()
  await kitchen.waitForURL(/\/staff\/kitchen/, { timeout: 15000 })
  check('login kitchen diarahkan ke KDS', true)

  // ------------------------------------------------- WEBSocket vs polling
  // Bukti real-time: KDS dibiarkan terbuka, lalu pesanan baru dibayar.
  // Interval polling saat WebSocket tersambung 20 detik, jadi kemunculan kartu
  // jauh di bawah itu hanya mungkin lewat event WebSocket.
  const liveBadge = kitchen.locator('.badge--live')
  await liveBadge.first().waitFor({ timeout: 15000 })
  check('KDS tersambung ke Reverb (badge Live)', (await liveBadge.first().innerText()).trim() === 'Live')

  const realtimeOrder = await fetch(`${API}/public/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      qr_token: table.qr_token,
      payment_method: 'qris',
      items: [{ menu_id: orderDetail.items[0].menu_id, quantity: 2 }],
    }),
  }).then((response) => response.json())

  const realtimeNumber = realtimeOrder.data.order_number
  const realtimeRef = JSON.parse(realtimeOrder.data.qris_payload).ref_id

  const realtimeBody = JSON.stringify({ ref_id: realtimeRef, status: 'paid' })
  const realtimeSignature = createHmac('sha256', GATEWAY_SECRET).update(realtimeBody).digest('hex')

  const startedAt = Date.now()
  await fetch(`${API}/payments/webhook/qris`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Callback-Signature': realtimeSignature },
    body: realtimeBody,
  })

  await kitchen.getByText(realtimeNumber).first().waitFor({ timeout: 15000 })
  const latency = Date.now() - startedAt

  check(`tiket muncul di KDS dalam ${latency} ms (< 3000 ms)`, latency < 3000, `${latency} ms`)
  await shot(kitchen, '11-kitchen')

  // --------------------------------------------------- guard: kitchen ke admin
  await kitchen.goto(`${APP}/staff/admin/dashboard`, { waitUntil: 'networkidle' })
  check(
    'role kitchen ditolak di halaman admin',
    await kitchen.getByText('Tidak punya akses').first().isVisible(),
  )
  await shot(kitchen, '12-rbac-guard')
} finally {
  await browser.close()
}

const failed = results.filter((item) => !item.ok)

console.log('\n----------------------------------------')
console.log(`PASS: ${results.length - failed.length}   FAIL: ${failed.length}`)

if (errors.length > 0) {
  console.log('\nError console/page yang tertangkap:')
  for (const error of errors.slice(0, 15)) console.log(`  - ${error}`)
} else {
  console.log('Tidak ada error console/page.')
}

console.log(`\nScreenshot: ${SHOTS}/`)

if (failed.length > 0 || errors.length > 0) {
  process.exit(1)
}

console.log('Semua skenario browser lolos tanpa error.')
