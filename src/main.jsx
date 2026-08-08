import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Buffer } from 'buffer'
import './index.css'
import './lib/i18n.js'
import App from './App.jsx'
import { AuthProvider } from './lib/AuthContext.jsx'

window.Buffer = window.Buffer || Buffer

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
