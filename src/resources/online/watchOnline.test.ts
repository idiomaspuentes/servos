import { describe, expect, it, vi } from 'vitest'
import { watchOnline } from './watchOnline'

const page = () => {
  const win = new EventTarget()
  const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  return { win, doc }
}

describe('when Servos online looks again (spec §4)', () => {
  it('checks when the app comes back into view, not when it leaves', () => {
    const { win, doc } = page()
    const check = vi.fn()
    watchOnline(win, doc, check)
    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(check).not.toHaveBeenCalled()
    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('checks when the connection comes back, and not when it goes', () => {
    const { win, doc } = page()
    const check = vi.fn()
    watchOnline(win, doc, check)
    win.dispatchEvent(new Event('offline'))
    expect(check).not.toHaveBeenCalled()
    win.dispatchEvent(new Event('online'))
    expect(check).toHaveBeenCalledTimes(1)
  })

  it('checks nothing at the start, and nothing once it stopped watching', () => {
    const { win, doc } = page()
    const check = vi.fn()
    const stop = watchOnline(win, doc, check)
    expect(check).not.toHaveBeenCalled()
    stop()
    win.dispatchEvent(new Event('online'))
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(check).not.toHaveBeenCalled()
  })
})

describe('the one timer for a wait the Worker asked for (final review, I1)', () => {
  const waits = (at: { next: number | null }) => {
    const listeners = new Set<() => void>()
    return {
      next: () => at.next,
      now: () => Date.now(),
      changed: (fn: () => void) => {
        listeners.add(fn)
        return () => void listeners.delete(fn)
      },
      tell: () => listeners.forEach((fn) => fn()),
    }
  }

  it('fires once when the earliest wait ends, checks, and stops', async () => {
    vi.useFakeTimers()
    try {
      const { win, doc } = page()
      const at = { next: Date.now() + 600_000 as number | null }
      const w = waits(at)
      const check = vi.fn(async () => {
        at.next = null
      })
      watchOnline(win, doc, check, w)
      await vi.advanceTimersByTimeAsync(599_000)
      expect(check).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(2_000)
      expect(check).toHaveBeenCalledTimes(1)
      await vi.advanceTimersByTimeAsync(24 * 3_600_000)
      expect(check).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('no timer while the app is hidden, nor once it stopped watching', async () => {
    vi.useFakeTimers()
    try {
      const { win, doc } = page()
      const at = { next: Date.now() + 60_000 as number | null }
      const w = waits(at)
      const check = vi.fn()
      doc.visibilityState = 'hidden'
      const stop = watchOnline(win, doc, check, w)
      await vi.advanceTimersByTimeAsync(120_000)
      expect(check).not.toHaveBeenCalled()
      // Back in view: a check for coming back, then the timer for the wait.
      doc.visibilityState = 'visible'
      at.next = Date.now() + 60_000
      doc.dispatchEvent(new Event('visibilitychange'))
      expect(check).toHaveBeenCalledTimes(1)
      stop()
      await vi.advanceTimersByTimeAsync(120_000)
      expect(check).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a wait set later is timed too', async () => {
    vi.useFakeTimers()
    try {
      const { win, doc } = page()
      const at = { next: null as number | null }
      const w = waits(at)
      const check = vi.fn(async () => {
        at.next = null
      })
      watchOnline(win, doc, check, w)
      at.next = Date.now() + 30_000
      w.tell()
      await vi.advanceTimersByTimeAsync(31_000)
      expect(check).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
