import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base '/m/' — האפליקציה מוגשת תחת /m באותו מקור של ה-API (כדי שעוגיות האימות יעבדו).
// אם בעתיד נמקם אותה בתת-דומיין נפרד, משנים base ל-'/' ומגדירים CORS+cookie domain.
// בפיתוח: פרוקסי ל-FastAPI (8000) כך שהדפדפן מדבר באותו מקור.
export default defineConfig({
  base: '/m/',
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
