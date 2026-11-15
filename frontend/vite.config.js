import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Port tetap supaya konfigurasi CORS di Backend (FRONTEND_URL) tidak berubah.
    port: 5173,
    strictPort: true,
  },
})
