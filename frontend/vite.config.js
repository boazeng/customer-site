import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// בפיתוח: מפנה /api /auth /login /logout /healthz לשרת ה-FastAPI (8000),
// כך שהדפדפן מדבר באותו מקור והעוגיות עובדות.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/login': 'http://localhost:8000',
      '/logout': 'http://localhost:8000',
      '/healthz': 'http://localhost:8000',
    },
  },
})
