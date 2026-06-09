import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
)

// ── SERVICE WORKER — enregistrement + détection mise à jour ──────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {

      // Vérifier les mises à jour toutes les 30 secondes
      setInterval(() => reg.update(), 30000)

      // SW en attente = nouvelle version disponible
      const notifyUpdate = () => {
        if (reg.waiting) {
          window.dispatchEvent(new CustomEvent('sw-update', { detail: reg.waiting }))
        }
      }

      // Déjà en attente au moment de l'enregistrement
      if (reg.waiting) notifyUpdate()

      // Nouvelle version installée pendant la session
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            notifyUpdate()
          }
        })
      })

    }).catch(err => console.warn('[SW] Échec enregistrement:', err))

    // Rechargement après activation du nouveau SW
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) { refreshing = true; window.location.reload() }
    })
  })
}
