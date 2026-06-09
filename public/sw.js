const VERSION = 'blackthorn-1780998167691'
const SHELL   = ['/index.html', '/blackthorn-logo.png', '/manifest.json']

// INSTALL : mise en cache du shell
self.addEventListener('install', e => {
  console.log('[SW] Install', VERSION)
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => {
      // Ne pas attendre d'être activé — prendre le contrôle immédiatement
      // Mais laisser le message de mise à jour d'abord
    })
  )
})

// ACTIVATE : nettoyer les anciens caches
self.addEventListener('activate', e => {
  console.log('[SW] Activate', VERSION)
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== VERSION).map(k => {
          console.log('[SW] Suppression ancien cache:', k)
          return caches.delete(k)
        })
      )
    ).then(() => self.clients.claim())
  )
})

// FETCH : network-first pour index.html, cache-first pour assets
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // Navigation : toujours réseau en premier (pour détecter les mises à jour)
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            caches.open(VERSION).then(c => c.put(e.request, res.clone()))
          }
          return res
        })
        .catch(() => caches.match('/index.html').then(r => r || new Response('Offline')))
    )
    return
  }

  // Assets : cache-first + mise à jour en arrière-plan
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        const network = fetch(e.request).then(res => {
          if (res.ok) caches.open(VERSION).then(c => c.put(e.request, res.clone()))
          return res
        })
        return cached || network
      })
    )
  }
})

// MESSAGE : commande de mise à jour depuis la page
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') {
    console.log('[SW] skipWaiting → activation immédiate')
    self.skipWaiting()
  }
})
