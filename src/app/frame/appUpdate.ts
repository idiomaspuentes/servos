/**
 * The app kept on the phone (`offline/sw.template.js`): its first visit keeps it whole, and it opens without internet
 * from then on. A new version is kept whole in the background, and used when the person says so («Usar ahora») or the
 * next time the app opens; it never changes under someone's hands.
 *
 * Off in development (the dev server reloads by itself) and in the prototype shared as a page inside Claude.
 */

import { useEffect, useState } from 'react'

let waiting: ServiceWorker | null = null
let asked = false
const listeners = new Set<() => void>()

export function keepAppOffline() {
  if (!import.meta.env.PROD || import.meta.env.MODE === 'pagina' || !('serviceWorker' in navigator) || 'claude' in window) return
  // The team's work lives on this phone: the browser is asked not to clear it to make room.
  void navigator.storage
    ?.persisted?.()
    .then((kept) => kept || navigator.storage.persist())
    .catch(() => {})
  const start = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        // Only an update waits with a version already in use; the first one is used at once.
        const ready = (worker: ServiceWorker | null) => {
          if (!worker || !navigator.serviceWorker.controller) return
          waiting = worker
          listeners.forEach((fn) => fn())
        }
        ready(registration.waiting)
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing
          worker?.addEventListener('statechange', () => worker.state === 'installed' && ready(worker))
        })
        // Coming back to the app is when to look for a new version (when there is internet).
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible' && navigator.onLine) void registration.update().catch(() => {})
        })
      })
      .catch(() => {})
    // The new version took over because the person asked: the page opens again in it.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!asked) return
      asked = false
      location.reload()
    })
  }
  // After the page has loaded: keeping the app whole must not slow its first opening.
  if (document.readyState === 'complete') start()
  else window.addEventListener('load', start)
}

/** Uses the new version now: the app opens again in it (what was written is kept, as on any reload). */
export function switchToNewVersion() {
  if (!waiting) return
  asked = true
  waiting.postMessage('usar-ahora')
}

/** Whether a new version is kept and waiting to be used. */
export function useNewVersion(): boolean {
  const [ready, setReady] = useState(waiting !== null)
  useEffect(() => {
    const on = () => setReady(true)
    listeners.add(on)
    return () => void listeners.delete(on)
  }, [])
  return ready
}
