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

// ── SERVICE WORKER — auto-update à la reconnexion ────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {

      // Fonction : activer immédiatement si nouveau SW en attente
      const activerMiseAJour = () => {
        if (reg.waiting) {
          reg.waiting.postMessage('skipWaiting')
        }
      }

      // Si déjà en attente au démarrage → activer tout de suite
      if (reg.waiting) {
        activerMiseAJour()
        return
      }

      // Nouvelle version détectée pendant la session
      reg.addEventListener('updatefound', () => {
        const installing = reg.installing
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            activerMiseAJour()
          }
        })
      })

      // Vérifier les mises à jour quand l'app revient au premier plan
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          reg.update().then(() => {
            if (reg.waiting) activerMiseAJour()
          })
        }
      })

      // Vérification périodique toutes les 60 secondes
      setInterval(() => {
        reg.update().then(() => {
          if (reg.waiting) activerMiseAJour()
        })
      }, 60000)

    }).catch(err => console.warn('[SW] Échec:', err))

    // Rechargement automatique quand le nouveau SW prend le contrôle
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true
        window.location.reload()
      }
    })
  })
}
