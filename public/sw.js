const VERSION = 'blackthorn-1781954478884'
const SHELL   = ['/index.html', '/blackthorn-logo.png', '/manifest.json']

// INSTALL
self.addEventListener('install', e => {
  console.log('[SW] Install', VERSION)
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(SHELL))
  )
  self.skipWaiting()
})

// ACTIVATE : nettoyer les anciens caches
self.addEventListener('activate', e => {
  console.log('[SW] Activate', VERSION)
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

// FETCH : network-first pour TOUT (plus de cache-first sur les assets)
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return

  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(VERSION).then(c => c.put(e.request, clone))
        }
        return res
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('/index.html')))
  )
})

// MESSAGE
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting()
})
