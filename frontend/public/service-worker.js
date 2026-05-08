// Minimal service worker for PWA install + static asset caching.
// Caches:
//   - the SPA shell (HTML + JS + CSS) for offline UI
//   - the WASM bundle (long-immutable)
// Does NOT cache /apple/proxy, /wisp, /r2, /m, /d, /i — these need fresh
// network access (Apple TLS sessions, R2 streaming, OTA installd).

const CACHE = 'ipatool-v1'
const SHELL = ['/']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

const NETWORK_ONLY_PREFIXES = ['/auth/', '/wisp', '/apple/', '/r2/', '/m/', '/d/', '/i/', '/healthz']

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.origin !== location.origin) return
  if (NETWORK_ONLY_PREFIXES.some((p) => url.pathname.startsWith(p))) return
  if (event.request.method !== 'GET') return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        // Stale-while-revalidate for shell/JS/CSS/WASM.
        event.waitUntil(
          fetch(event.request)
            .then((resp) => {
              if (resp.ok) caches.open(CACHE).then((c) => c.put(event.request, resp.clone()))
            })
            .catch(() => {})
        )
        return cached
      }
      return fetch(event.request).then((resp) => {
        if (resp.ok && resp.type === 'basic') {
          const copy = resp.clone()
          caches.open(CACHE).then((c) => c.put(event.request, copy))
        }
        return resp
      })
    })
  )
})
