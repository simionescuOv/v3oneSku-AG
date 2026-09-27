// Minimal Service Worker pentru oneSku PWA
// Îndeplinește cerințele native Chromium/Android pentru generarea pachetului WebAPK Standalone

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Passthrough fetch handler pentru compatibilitate maximă cu arhitectura Local-First
self.addEventListener('fetch', (event) => {
  // Cererile de rețea trec direct la server; dacă rețeaua e indisponibilă, încearcă cache
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  )
})
