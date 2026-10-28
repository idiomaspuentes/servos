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
