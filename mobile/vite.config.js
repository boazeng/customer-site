import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base '/' — האפליקציה מוגשת בשורש של תת-דומיין ייעודי (m.newavera.co.il),
// מאותו backend (container עם APP_MODE=mobile). אימות עצמאי על אותו מארח.
// בפיתוח: פרוקסי ל-FastAPI (8000) כך שהדפדפן מדבר באותו מקור.
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:8000',
      '/auth': 'http://localhost:8000',
      '/login': 'http://localhost:8000',
      '/logout': 'http://localhost:8000',
      '/healthz': 'http://localhost:8000',
    },
  },
})
