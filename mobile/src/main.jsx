import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(<App />)

// רישום ה-service worker (מאפשר "הוספה למסך הבית" כאפליקציה)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/m/sw.js', { scope: '/m/' }).catch(() => {})
  })
}
