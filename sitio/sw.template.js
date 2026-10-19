/* The site's worker (scripts/sitio.mjs writes it): the page that presents Servos and its guide kept whole at the first
 * visit, so the guide can be read in a workshop without internet. The app is not kept here: it has its own worker
 * under /app/, which keeps it whole and is the one that answers there.
 *
 * Before the app moved to /app/ (October 2026) it lived at the root, with a worker at this same address that answered
 * every page with the app. This worker takes its place at once, and lets its kept copies go (`servos-<build>`; the
 * app's own are `servos-app-<build>` now). What the team wrote is not there but in the browser's storage for this
 * site, which neither worker touches: the app at /app/ finds it as it was. */

const BUILD = '__BUILD__'
const FILES = __FILES__
const CACHE = `sitio-${BUILD}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' }))))
      // Nothing is being written in the site: the new version can be used at once.
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => (k.startsWith('sitio-') && k !== CACHE) || /^servos-[0-9a-f]{12}$/.test(k))
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Another site, or the app: not this worker's.
  if (url.origin !== self.location.origin || url.pathname.startsWith('/app/') || url.pathname === '/app') return
  const page = request.mode === 'navigate'
  const key = page && !url.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(url.pathname) ? url.pathname + '/' : url.pathname
  event.respondWith(
    caches.match(key, { cacheName: CACHE, ignoreSearch: true }).then(
      (kept) =>
        kept ||
        fetch(request).catch(() =>
          // Without internet, a page not kept opens the start of the site, which is.
          page ? caches.match('/', { cacheName: CACHE }).then((home) => home || Response.error()) : Response.error()
        )
    )
  )
})
