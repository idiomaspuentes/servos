/* Servos's service worker: the whole app kept on the phone at its first visit, so it opens without internet for as
 * long as the team works offline (weeks, sometimes), not only the pages already seen. Door43 is never kept here: it is
 * another site, always asked live, and what waits for it waits in the app (outbox).
 *
 * The build writes this file (vite.config.ts, `offlineShell`): BUILD names this version, FILES lists every file it
 * made. A new version is kept whole before it is used, and is used when the person says so or opens the app again. */

const BUILD = '__BUILD__'
const FILES = __FILES__
// `servos-app-`: the app's own kept versions. Before it moved to `/app/` they were `servos-<build>` at the root, and
// are let go below as any older version is; the site's worker at the root keeps its pages apart (`sitio-`).
const CACHE = `servos-app-${BUILD}`

self.addEventListener('install', (event) => {
  // Each file asked anew (not from the browser's own cache), so the version kept is the one that was built.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })))))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('servos-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// The page asks for the new version to be used now («Usar ahora»).
self.addEventListener('message', (event) => {
  if (event.data === 'usar-ahora') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  // The app's page, whatever its address: the one kept, at once, with or without a connection (a slow network does
  // not keep it from opening). A new version arrives through the worker's update, not here.
  if (request.mode === 'navigate') {
    event.respondWith(caches.match('./', { cacheName: CACHE }).then((kept) => kept || fetch(request)))
    return
  }
  event.respondWith(caches.match(request, { cacheName: CACHE }).then((kept) => kept || fetch(request)))
})
