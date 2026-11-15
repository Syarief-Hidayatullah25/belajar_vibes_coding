# Planning: Project Baru — Frontend React + Backend Laravel (Decoupled)

## Tujuan

Membuat project baru di folder ini dengan arsitektur **terpisah (decoupled)** antara Frontend dan Backend:

- **Frontend**: React (Vite), package manager Bun (fallback: Node.js/npm).
- **Backend**: Laravel (PHP + Composer), hanya menyediakan REST API.
- **Komunikasi**: REST API (JSON) lewat HTTP.
- **Database**: PostgreSQL.

Frontend dan Backend adalah dua service mandiri: punya dependensi, konfigurasi, dan proses dev sendiri. Frontend tidak memuat kode PHP, Backend tidak merender halaman React.

## Batasan (High-Level)

- Dokumen ini bersifat panduan arah, bukan implementasi detail. Programmer/agen yang mengeksekusi boleh menentukan detail kecil (nama variabel, styling, dsb.).
- Fokus pada: struktur folder, inisialisasi tiap service, konfigurasi CORS, koneksi database, dan alur integrasi API dasar.
- Autentikasi, CI/CD, deployment, dan testing menyeluruh **di luar cakupan** tahap awal — siapkan hanya placeholder-nya.

## Tech Stack

| Layer | Teknologi | Keterangan |
| --- | --- | --- |
| Frontend | React + Vite | Dev server dengan HMR |
| Package Manager FE | Bun (utama) / npm (alternatif) | Pilih satu dan konsisten |
| Backend | Laravel | Mode API-only, bukan web penuh |
| Backend Runtime | PHP + Composer | Versi PHP mengikuti requirement Laravel terbaru |
| Database | PostgreSQL | Satu database untuk Backend |
| Protokol | REST API + JSON | CORS di sisi Backend |

## Struktur Folder (Monorepo Sederhana)

Repositori tunggal, dua folder service sejajar:

```
<root>/
├── frontend/          # React + Vite
├── backend/           # Laravel API
├── .gitignore         # mengabaikan node_modules, vendor, .env, build artifact
└── README.md          # cara menjalankan kedua service
```

Aturan:

- Tiap folder service punya `README.md` singkat dan `.env.example` sendiri.
- File `.env` asli **tidak** di-commit.
- Tidak ada sharing file kode antar service; kontrak antar service adalah REST API.
- Opsional: `Makefile` atau script root untuk menjalankan kedua service sekaligus.

## Langkah Implementasi

### 1. Persiapan Struktur

1. Buat folder `frontend/` dan `backend/` di root.
2. Siapkan `.gitignore` root yang mencakup `node_modules/`, `vendor/`, `.env`, `dist/`, `bootstrap/cache`.
3. Siapkan `README.md` root: prasyarat (PHP, Composer, Bun/npm, PostgreSQL), cara menjalankan, dan URL default kedua service.

### 2. Inisialisasi Backend (Laravel)

1. Buat project Laravel baru di `backend/` memakai Composer.
2. Konfigurasikan sebagai **API-only**: gunakan route API (`routes/api.php`), tidak memerlukan view/Blade atau session-based auth pada tahap awal. Boleh memakai opsi sana yang menyederhanakan (mis. `php artisan install:api` untuk Sanctum/route API).
3. Siapkan `.env.example` dengan variabel koneksi PostgreSQL (lihat bagian Konfigurasi Database).
4. Jalankan migrasi agar skema database terbentuk.
5. Tambahkan minimal satu endpoint kesehatan, mis. `GET /api/health` yang mengembalikan JSON `{ "status": "ok" }`, sebagai bukti Backend hidup dan siap dihubungi.

### 3. Inisialisasi Frontend (React + Vite)

1. Buat project React + Vite di `frontend/` (package manager Bun; catat alternatif npm di README).
2. Atur `.env.example` frontend berisi base URL API (mis. `VITE_API_BASE_URL`).
3. Buat lapisan akses API sederhana, mis. `src/lib/api.js` (atau `.ts` bila memakai TypeScript), yang membungkus `fetch` dan membaca base URL dari env.
4. Buat satu halaman contoh yang memanggil endpoint `GET /api/health` dan menampilkan status koneksi ke Backend.
5. Pastikan dev server Frontend berjalan di port tetap (mis. `5173`).

### 4. Konfigurasi Database (PostgreSQL)

1. Buat database PostgreSQL baru khusus project, mis. `vcing_dev`.
2. Isi `.env` Backend: `DB_CONNECTION=pgsql` beserta host, port, nama database, user, password.
3. Jalankan migrasi dan pastikan koneksi berhasil tanpa error, lalu verifikasi lewat seeder sederhana bila perlu.
4. Dokumentasikan cara membuat database dan menjalankan migrasi di `backend/README.md`.

### 5. Konfigurasi CORS

- CORS dikonfigurasi **di Backend** (Frontend tidak butuh konfigurasi CORS).
- Izinkan origin dev Frontend (mis. `http://localhost:5173`) pada konfigurasi CORS Laravel, bukan wildcard `*`, agar kredensial bisa dipakai nanti.
- Pastikan preflight `OPTIONS` untuk endpoint API dijawab dengan benar.
- Simpan origin Frontend di `.env` Backend (mis. `FRONTEND_URL`) agar tidak hardcode.
- Verifikasi: panggilan `fetch` dari Frontend ke `GET /api/health` berhasil tanpa error CORS di browser console.

### 6. Alur Integrasi API Dasar

1. Frontend memanggil Backend melalui base URL dari `VITE_API_BASE_URL` (default: `http://localhost:8000`).
2. Backend menerima request, memproses (validasi → akses database → bentuk response), dan membalas JSON dengan struktur konsisten, mis.:

   ```
   { "success": true, "data": { ... }, "message": "..." }
   ```

   dan untuk error: `{ "success": false, "message": "...", "errors": { ... } }`.
3. Frontend menangani tiga kondisi: loading, sukses (render data), gagal (tampilkan pesan error).
4. Tambahkan minimal satu resource CRUD contoh yang menembus database untuk membuktikan jalur end-to-end (Frontend → API → PostgreSQL → Frontend), mis. satu tabel `items` dengan `GET` dan `POST`.

## Konfigurasi Environment (Ringkasan)

Backend (`backend/.env.example`):

- `APP_ENV`, `APP_KEY`, `APP_URL`
- `DB_CONNECTION=pgsql`, `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`
- `FRONTEND_URL` (origin Frontend untuk CORS)
- `SANCTUM_STATEFUL_DOMAINS` (placeholder untuk autentikasi nanti)

Frontend (`frontend/.env.example`):

- `VITE_API_BASE_URL=http://localhost:8000/api`

## Cara Menjalankan (Target Akhir)

- Backend: `cd backend` → `composer install` → salin `.env.example` → `php artisan key:generate` → `php artisan migrate` → `php artisan serve` (port `8000`).
- Frontend: `cd frontend` → `bun install` → salin `.env.example` → `bun run dev` (port `5173`).
- Kedua service dijalankan bersamaan di dua terminal.

## Kriteria Selesai (Definition of Done)

- [ ] Struktur `frontend/` + `backend/` terbentuk dengan `.gitignore` dan `README.md` root.
- [ ] Laravel berjalan sebagai API-only dan `GET /api/health` mengembalikan JSON.
- [ ] React + Vite berjalan dan menampilkan status koneksi ke Backend.
- [ ] Backend terkoneksi ke PostgreSQL, migrasi berhasil.
- [ ] CORS mengizinkan origin Frontend tanpa error di browser console.
- [ ] Satu alur data end-to-end (Frontend → REST API → PostgreSQL) berfungsi untuk minimal satu resource.
- [ ] `.env.example` tersedia di kedua service; tidak ada rahasia yang ter-commit.
- [ ] Instruksi menjalankan project dapat diikuti dari nol sesuai `README.md`.

## Catatan untuk Eksekutor

- Prioritaskan konvensi bawaan tiap framework; jangan menambah library di luar kebutuhan tahap awal.
- Bila Bun bermasalah di lingkungan eksekusi, gunakan npm dan catat pilihan tersebut di `README.md`.
- Jaga status HTTP dan bentuk JSON response tetap konsisten antar endpoint.
- Perlakukan dokumen ini sebagai arah produk: bila ada konflik, utamakan Kriteria Selesai.
