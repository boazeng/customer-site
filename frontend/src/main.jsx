import React from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/recipes.css'
import './components/TactLogo.css'
import './styles/app.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
