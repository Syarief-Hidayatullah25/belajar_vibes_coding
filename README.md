# VCing

Project contoh dengan arsitektur **decoupled**: Frontend React (Vite) dan Backend Laravel (REST API) berjalan sebagai dua service terpisah, memakai PostgreSQL sebagai database.

> Butuh sistem POS restoran (MICRODINE)? Lihat [`microdine/`](microdine/README.md) — produk terpisah di repo ini dengan backend Laravel + PostgreSQL (Sanctum, RBAC, payment gateway, analitik).

```
.
├── frontend/        # React + Vite (Bun)  -> http://localhost:5173
├── backend/         # Laravel API-only     -> http://localhost:8000
├── scripts/         # helper start/stop PostgreSQL portabel
├── .tools/          # PHP + PostgreSQL portabel (tidak di-commit)
└── .data/           # data cluster PostgreSQL & log (tidak di-commit)
```

## Prasyarat

| Kebutuhan | Versi yang dipakai | Catatan |
| --- | --- | --- |
| PHP | 8.5.12 (portabel) | Wajib punya ekstensi `pdo_pgsql` |
| Composer | 2.8+ | Terpasang di sistem |
| Bun | 1.4+ | Alternatif: npm |
| PostgreSQL | 17.11 (portabel) | Server lokal, port `5432` |

> **Catatan toolchain lokal.** Mesin ini memakai PHP dari Herd Lite yang merupakan *build statis* tanpa `pdo_pgsql`, sehingga project memakai PHP portabel di `.tools/php/php.exe`. Folder `.tools/` dan `.data/` bersifat lokal mesin dan tidak masuk git. Jika Anda memasang PHP resmi dengan `pdo_pgsql`, cukup ganti `$PHP` di perintah di bawah dengan `php`.

## Menjalankan PostgreSQL

```powershell
# Start (data cluster ada di .data/pgdata, log di .data/pg.log)
pwsh ./scripts/db-start.ps1

# Stop
pwsh ./scripts/db-stop.ps1
```

Database `vcing_dev` sudah dibuat. Kredensial dev ada di `backend/.env` (user `postgres`, password `postgres`).

## Menjalankan Backend (Laravel)

```powershell
$PHP = "$PWD\.tools\php\php.exe"

cd backend
& $PHP artisan serve --host=127.0.0.1 --port=8000
```

Inisialisasi pertama kali (jika database masih kosong):

```powershell
cd backend
cp .env.example .env
& $PHP artisan key:generate
& $PHP artisan migrate
& $PHP artisan db:seed
```

## Menjalankan Frontend (React + Vite)

```powershell
cd frontend
bun install       # sekali saja
bun run dev       # http://localhost:5173
```

Ganti `bun` dengan `npm` bila memakai Node.js/npm.

## Konfigurasi

**Backend** (`backend/.env`):

- `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `FRONTEND_URL` — origin Frontend yang diizinkan CORS (default `http://localhost:5173`)

**Frontend** (`frontend/.env`):

- `VITE_API_BASE_URL` — base URL API (default `http://localhost:8000/api`)

CORS diatur di Backend (`backend/config/cors.php`) dengan origin eksplisit, bukan wildcard.

## Kontrak API

Semua endpoint berada di bawah prefix `/api` dan membalas JSON dengan bentuk konsisten:

```json
{ "success": true, "data": { }, "message": "..." }
```

Error:

```json
{ "success": false, "message": "...", "errors": { "field": ["..."] } }
```

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/api/health` | Cek API hidup |
| GET | `/api/items` | Daftar item |
| POST | `/api/items` | Buat item (`name` wajib) |
| GET | `/api/items/{id}` | Detail item |
| PUT/PATCH | `/api/items/{id}` | Ubah item |
| DELETE | `/api/items/{id}` | Hapus item |

## Alur Integrasi

1. Frontend membaca `VITE_API_BASE_URL` dari `frontend/.env`.
2. Semua panggilan lewat `frontend/src/lib/api.js` (membungkus `fetch`, menormalkan error).
3. Backend memvalidasi request → akses PostgreSQL lewat Eloquent → balas JSON.
4. Halaman utama (`frontend/src/App.jsx`) menampilkan status `/api/health` dan CRUD `items`.

## Deploy

Deploy permanen **belum dilakukan** dan butuh akun platform (Railway/Render untuk Laravel + PostgreSQL, Vercel/Netlify untuk frontend). Ringkasan opsi yang sudah diuji:

- **Railway + Vercel** — jalur paling sedikit konfigurasi (Railway memakai nixpacks, tidak perlu Dockerfile), tetapi wajib login akun.
- **GitHub Pages untuk frontend** — bisa tanpa akun baru, tetapi harus mengaktifkan Pages di Settings → Pages (atau token dengan izin Pages). Percobaan lewat API gagal `403` karena izin token tidak mencakup Pages.
- **Cloudflare Quick Tunnel** — satu-satunya cara tanpa akun; cukup `cloudflared tunnel --url http://127.0.0.1:<port>`. Sifatnya **sementara**: URL acak baru setiap start, hanya hidup selama mesin dan proses cloudflared berjalan, dan API tetap berjalan di laptop. Bukan pengganti hosting.

Bila memakai tunnel, ingat: `VITE_API_BASE_URL` tertanam saat build, jadi frontend harus di-build ulang setiap URL tunnel backend berubah, dan origin tunnel frontend harus ada di `FRONTEND_URL` Backend agar CORS lolos.

