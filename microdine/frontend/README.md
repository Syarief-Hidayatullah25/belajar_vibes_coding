# Frontend MICRODINE

React + Vite SPA untuk MICRODINE, terhubung ke backend Laravel di `../backend` lewat REST API.

Dua antarmuka dalam satu aplikasi:

- **Pelanggan (mobile-first)** — `/m/:qrToken`, `/m/:qrToken/checkout`, `/order/:orderNumber`
- **Portal staf** — `/staff/login`, `/staff/queue`, `/staff/tables`, `/staff/history`, `/staff/kitchen`, `/staff/admin/*`

## Menjalankan

```powershell
cd microdine/frontend
bun install
bun run dev          # http://localhost:5173
```

Butuh backend di `http://localhost:8000` (lihat `../backend`) dan Reverb di `http://127.0.0.1:8080` untuk real-time. Base URL dan kredensial WebSocket ada di `.env`:

```
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_REVERB_APP_KEY=microdinekey
VITE_REVERB_HOST=127.0.0.1
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

`VITE_REVERB_*` **harus sama** dengan `REVERB_*` di `../backend/.env`. Bila Reverb mati atau key kosong, UI otomatis memakai polling dan menampilkan badge **Polling** (bukan **Live**).

Akun staf demo (password `password`): `admin`, `kasir`, `kitchen`.

Untuk mencoba alur pelanggan tanpa QR fisik: login sebagai kasir → menu **Meja** → tombol **QR** pada salah satu meja, lalu buka URL yang muncul (atau pindai QR-nya).

## Peta halaman

| Rute | Akses | Isi |
| --- | --- | --- |
| `/` | publik | halaman pengantar + info akun demo |
| `/m/:qrToken` | publik | katalog, pencarian, filter kategori, keranjang |
| `/m/:qrToken/checkout` | publik | nama pemesan, catatan per item, rincian pajak, pilih QRIS/tunai |
| `/order/:orderNumber` | publik | tracker progres, QR QRIS + countdown, nomor antrean tunai, timeline |
| `/staff/queue` | admin, kasir | Kanban 3 kolom, terima tunai (kalkulator kembalian), ubah status dapur |
| `/staff/tables` | admin, kasir | grid meja, QR meja, pesanan manual (barcode/scanner), tutup sesi |
| `/staff/history` | admin, kasir | filter tanggal/metode/status, detail pesanan, cetak struk |
| `/staff/kitchen` | admin, kitchen | Kitchen Display kontras tinggi, tombol Mulai Masak / Selesai Masak |
| `/staff/admin/dashboard` | admin | KPI omzet/HPP/laba/margin, tren 14 hari, rasio metode bayar, top menu |
| `/staff/admin/menus` | admin | tabel menu + kalkulator margin real-time, upload gambar, toggle tersedia |
| `/staff/admin/reports` | admin | audit transaksi + HPP/laba per transaksi, unduh CSV |
| `/staff/admin/targets` | admin | target bulanan, realisasi, proyeksi, kebutuhan omzet harian |

## Arsitektur kecil

```
src/
├── lib/api.js          # semua panggilan HTTP + Bearer token + normalisasi error
├── lib/format.js       # rupiah, tanggal, label status
├── context/            # AuthContext (token/role), CartContext (keranjang)
├── hooks/usePolling.js # auto-refresh; titik ganti ke WebSocket
├── components/         # ui, ProtectedRoute (RBAC), StaffLayout
└── pages/              # customer/*, staff/*, staff/admin/*
```

Catatan penting:

- **RBAC di UI bersifat kosmetik.** Backend tetap menolak (403) setiap request yang role-nya tidak berhak; guard di frontend hanya mencegah salah navigasi.
- **Real-time memakai WebSocket (Reverb).** KDS, Kanban kasir, grid meja, dan tracker pelanggan berlangganan channel `orders` / `order.{id}` lewat `src/lib/realtime.js`. Polling tetap jalan sebagai jaring pengaman dengan interval 20–30 detik saat WebSocket tersambung, dan kembali 3–5 detik bila terputus.
- **Ekspor CSV tidak bisa lewat `<a href>`** karena butuh header `Authorization`, jadi diunduh lewat `fetch` lalu dibuat blob.

## Verifikasi

```powershell
bun run build                 # build produksi
bun scripts/browser-check.mjs # verifikasi di browser sungguhan
```

`browser-check.mjs` memakai Playwright dengan Edge yang sudah terpasang (tanpa unduh browser) dan menjalankan alur nyata: pesan dari meja → bayar via webhook mock → cek halaman status ter-update tanpa reload → login kasir/admin/kitchen → telusuri semua halaman → uji guard RBAC. Error console/page dikumpulkan dan menggagalkan skrip. Screenshot tersimpan di `.screens/` (tidak di-commit).

Bagian real-time diukur, bukan sekadar "berjalan": KDS dibiarkan terbuka dengan badge **Live**, lalu satu pesanan dibayar. Karena interval polling saat tersambung 20 detik, tiket yang muncul di bawah 3 detik hanya mungkin datang dari WebSocket (hasil run terakhir: **369 ms**).

Prasyarat menjalankannya: backend `:8000`, Reverb `:8080`, dan dev server `:5173` hidup, database baru di-seed (`php artisan migrate:fresh --seed`).
