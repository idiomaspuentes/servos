/**
 * When Servos online looks for something new besides startup (spec §4): when the app comes back into view and when the
 * connection comes back. The check keeps the rest by itself: it asks for the lists at most every three hours
 * (`RECHECK_MS`), never before a wait the Worker asked for, never while the person types, and it joins a run in flight
 * instead of starting beside it, so it never runs while something is applied. No timer: a person who keeps the app in
 * view for hours finds what is new the next time it comes back.
 */

import { checkForUpdates } from './onlineResources'

type Target = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

/** Starts watching; what it returns stops it. The targets and the check are the page's unless given (tests). */
export function watchOnline(
  win: Target = window,
  doc: Target & { readonly visibilityState: string } = document,
  check: () => unknown = () => checkForUpdates(),
): () => void {
  const backInView = () => {
    if (doc.visibilityState === 'visible') void check()
  }
  const backOnline = () => void check()
  doc.addEventListener('visibilitychange', backInView)
  win.addEventListener('online', backOnline)
  return () => {
    doc.removeEventListener('visibilitychange', backInView)
    win.removeEventListener('online', backOnline)
  }
}
