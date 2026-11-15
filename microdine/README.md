# MICRODINE — Backend API

Backend REST API untuk sistem POS restoran MICRODINE: pelanggan memindai QR meja, memesan, membayar (QRIS/tunai), dapur mengolah, kasir menutup sesi, admin melihat laba.

Status: **Fase 1–3 (backend) + fondasi real-time selesai.** Frontend SPA (Fase 4–5) belum dikerjakan.

- Laravel 13 (API-only) + Sanctum + PostgreSQL
- Semua endpoint di bawah `/api/v1`
- Envelope response: `{ success, data, message }` / error `{ success, message, errors }`

## Menjalankan

```powershell
# 1. PostgreSQL lokal project (portabel, dari root repo)
pwsh ../scripts/db-start.ps1

# 2. Siapkan aplikasi
cd microdine/backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate:fresh --seed

# 3. Jalankan API
php artisan serve --host=127.0.0.1 --port=8000
```

> Di mesin ini `php` default (Herd Lite) tidak punya `pdo_pgsql`, jadi gunakan PHP portabel repo:
> `../../../.tools/php/php.exe artisan ...` dari folder `microdine/backend`.

Akun demo (password semuanya `password`):

| Username | Role | Bisa apa |
| --- | --- | --- |
| `admin` | admin | master data, analitik, target, tutup meja |
| `kasir` | kasir | antrean, meja, order manual, konfirmasi tunai |
| `kitchen` | kitchen | antrean dapur, ubah status masak |

## Aturan bisnis → implementasi

| Aturan | Di mana |
| --- | --- |
| **1. Pay-First Gate** — pesanan pending tidak muncul di dapur | `OperationOrderController@queue` memfilter `screen=kitchen` hanya `payment_status=paid`; perubahan status dapur ditolak 409 bila belum lunas |
| **2. Snapshot harga & HPP** | `OrderService::create` menyalin `unit_price_snapshot`, `unit_hpp_snapshot`, `subtotal_price`, `subtotal_hpp`; analitik membaca snapshot, bukan harga menu saat ini |
| **3. Shared table session** | `TableSessionService::openOrJoin` mengembalikan sesi aktif yang sama, bukan membuat sesi kedua |
| **4. Concurrency safety** | `DB::transaction` + `lockForUpdate()` pada baris meja sebelum membuat sesi |
| **5. Financial integrity** | `AnalyticsService::paidOrders` — seluruh agregasi hanya `payment_status = paid`; `pending/expired/failed` diabaikan |

## Endpoint

### Publik (tanpa login)

| Method | Path | Keterangan |
| --- | --- | --- |
| GET | `/public/tables/scan/{qr_token}` | Buka/gabung sesi meja |
| GET | `/public/menus` | Katalog + konfigurasi pajak |
| POST | `/public/orders` | Buat pesanan (QRIS/tunai) |
| GET | `/public/orders/{order_number}` | Status pesanan + timeline + countdown |

### Auth & pengaturan

| Method | Path | Role |
| --- | --- | --- |
| POST | `/auth/login` | publik |
| POST | `/auth/logout` | semua staf |
| GET | `/auth/me` | semua staf |
| GET | `/settings` | semua staf |
| PUT | `/settings` | admin |

### Admin

| Method | Path | Keterangan |
| --- | --- | --- |
| CRUD | `/admin/categories` | kategori menu |
| CRUD | `/admin/menus` | menu + HPP + harga jual |
| CRUD | `/admin/staff` | akun kasir & dapur (role admin tidak bisa dibuat di sini) |
| GET | `/admin/analytics/dashboard` | KPI, tren 14 hari, rasio metode, top menu |
| GET | `/admin/analytics/reports` | audit transaksi + HPP + laba |
| GET | `/admin/analytics/reports/export` | ekspor CSV |
| GET/POST | `/admin/analytics/targets` | target bulanan + proyeksi |

### Operasional

| Method | Path | Role |
| --- | --- | --- |
| GET | `/operations/tables` | kasir, kitchen |
| POST | `/operations/tables/{table}/close` | admin, kasir |
| POST | `/operations/orders/manual` | admin, kasir |
| GET | `/operations/orders/queue?screen=kasir\|kitchen` | semua staf |
| PATCH | `/operations/orders/{order}/kitchen-status` | semua staf |
| GET | `/operations/orders/history` | admin, kasir |
| POST | `/cashier/orders/{order}/confirm-cash` | admin, kasir |
| POST | `/payments/webhook/qris` | publik (signature) |

## Payment gateway (mock)

Driver default `mock` (`PAYMENT_GATEWAY_DRIVER`). `MockPaymentGateway` tidak menghubungi pihak ketiga: ia membuat `ref_id` dan `qris_payload` (JSON) yang bisa dirender frontend menjadi QR.

Kontrak ada di `app/Services/PaymentGateway/PaymentGateway.php`. Untuk Midtrans/Xendit: buat implementasi baru, daftarkan di `AppServiceProvider`, lalu ganti driver di `.env` — tanpa mengubah controller.

Simulasi webhook sukses:

```powershell
$secret = 'mock-secret-key'
$body = '{"ref_id":"MOCK-A-001-XXXXXX","status":"paid"}'
$sig = (Get-FileHash -InputStream ([IO.MemoryStream]::new([Text.Encoding]::UTF8.GetBytes($body))) -Algorithm SHA256) # ilustrasi
# Signature sebenarnya: HMAC-SHA256(body, secret)
```

```bash
# contoh dengan openssl
BODY='{"ref_id":"MOCK-A-001-XXXXXX","status":"paid"}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "mock-secret-key" -hex | sed 's/^.* //')
curl -X POST http://127.0.0.1:8000/api/v1/payments/webhook/qris \
  -H "Content-Type: application/json" -H "X-Callback-Signature: $SIG" -d "$BODY"
```

Webhook bersifat idempoten: dikirim dua kali tetap `paid`, dan transaksi yang sudah `expired` ditolak `409`.

## Scheduler

```powershell
php artisan schedule:work     # menjalankan orders:expire tiap menit
php artisan orders:expire     # manual sekali jalan
```

Pesanan `pending` yang melewati `expires_at` (default 15 menit, `ORDER_EXPIRY_MINUTES`) diubah menjadi `expired` dan dicatat di `order_status_logs`.

## Real-time

Event `OrderPaid` dan `OrderStatusUpdated` sudah dipicu dan implement `ShouldBroadcast`. Default `BROADCAST_CONNECTION=log` (tanpa server tambahan). Untuk produksi, install Laravel Reverb dan ganti driver — channel publik (`orders`, `order.{id}`) cukup diganti `PrivateChannel` bila perlu otorisasi.

## Smoke test

```powershell
php scripts/smoke-test.php
```

Menguji 68 skenario lewat HTTP: RBAC, sesi meja bersama, snapshot harga, Pay-First Gate, signature webhook, transisi status dapur, kembalian tunai, integritas omzet, dan ekspor CSV. Untuk hasil bersih: `php artisan migrate:fresh --seed` lalu jalankan ulang.
