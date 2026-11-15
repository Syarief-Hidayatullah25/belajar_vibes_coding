import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div className="landing">
      <h1>MICRODINE</h1>
      <p className="muted">Demo sistem POS restoran: pesan dari meja, bayar, dapur mengolah, kasir menutup sesi.</p>

      <div className="landing__grid">
        <section className="panel">
          <h2>Untuk Pelanggan</h2>
          <p className="muted small">
            Pindai QR di meja. Untuk mencoba tanpa QR fisik, buka menu <strong>Meja</strong> di portal staf lalu tekan
            tombol QR pada salah satu meja.
          </p>
          <Link className="button button--ghost" to="/staff/login">
            Buka portal staf
          </Link>
        </section>

        <section className="panel">
          <h2>Untuk Staf</h2>
          <p className="muted small">Login sesuai role. Akun demo password <code>password</code>.</p>
          <ul className="plain-list">
            <li>
              <code>admin</code> — dashboard, menu & HPP, laporan, target
            </li>
            <li>
              <code>kasir</code> — antrean, meja, histori, terima tunai
            </li>
            <li>
              <code>kitchen</code> — kitchen display
            </li>
          </ul>
          <Link className="button button--primary" to="/staff/login">
            Masuk portal staf
          </Link>
        </section>
      </div>

      <p className="muted small center">
        API: <code>{import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'}</code>
      </p>
    </div>
  )
}
