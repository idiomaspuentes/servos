/**
 * When Servos online looks for something new besides startup (spec §4): when the app comes back into view, when the
 * connection comes back, and when a wait the Worker asked for (`Retry-After`) ends while the app is in view. The
 * check keeps the rest by itself: it asks for the lists at most every three hours (`RECHECK_MS`), but at once for a
 * language whose wait is over; never before a wait; never while the person types; and it joins a run in flight
 * instead of starting beside it, so it never runs while something is applied.
 *
 * One timer at most, for the earliest wait, and only while the app is in view: no polling. A person who keeps the app
 * in view for hours with nothing waiting finds what is new the next time it comes back.
 */

import { checkForUpdates, nextWaitEnd, onWaits } from './onlineResources'

type Target = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>

/** The waits the Worker asked for: when the earliest ends, the clock it is told in, and word when they change. */
export type Waits = {
  next: () => number | null
  now: () => number
  changed: (fn: () => void) => () => void
}

const moduleWaits: Waits = { next: nextWaitEnd, now: () => Date.now(), changed: onWaits }

/** Starts watching; what it returns stops it. The targets, the check and the waits are the page's unless given (tests). */
export function watchOnline(
  win: Target = window,
  doc: Target & { readonly visibilityState: string } = document,
  check: () => unknown = () => checkForUpdates(),
  waits: Waits = moduleWaits,
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let timedFor: number | null = null
  let stopped = false

  /** The timer for the earliest wait, while in view; none otherwise. */
  const time = () => {
    const next = !stopped && doc.visibilityState === 'visible' ? waits.next() : null
    if (next === timedFor) return
    clearTimeout(timer)
    timer = undefined
    timedFor = next
    if (next === null) return
    timer = setTimeout(
      () => {
        timer = undefined
        timedFor = null
        // Timed again once the check ends: a new wait it brought back, or none.
        void Promise.resolve()
          .then(check)
          .catch(() => {})
          .finally(time)
      },
      Math.max(0, next - waits.now()),
    )
  }

  const backInView = () => {
    if (doc.visibilityState === 'visible') void check()
    time()
  }
  const backOnline = () => void check()
  doc.addEventListener('visibilitychange', backInView)
  win.addEventListener('online', backOnline)
  const unwatch = waits.changed(time)
  time()
  return () => {
    stopped = true
    clearTimeout(timer)
    unwatch()
    doc.removeEventListener('visibilitychange', backInView)
    win.removeEventListener('online', backOnline)
  }
}
