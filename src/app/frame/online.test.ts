import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isTyping, whenNotTyping } from './online'

/** A page with a field that has the focus, or none. */
function page() {
  const field = { tagName: 'TEXTAREA', isContentEditable: false }
  const body = { tagName: 'BODY', isContentEditable: false }
  const doc = Object.assign(new EventTarget(), { activeElement: field as unknown as Element | null, visibilityState: 'visible' as DocumentVisibilityState })
  return { doc, field, body }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('waiting for a pause in the typing (final review, I4)', () => {
  it('runs at once when nothing is being typed', () => {
    const { doc, body } = page()
    doc.activeElement = body as unknown as Element
    const run = vi.fn()
    whenNotTyping(run, doc)
    expect(run).toHaveBeenCalledTimes(1)
    expect(isTyping(doc)).toBe(false)
  })

  it('runs after the field loses the focus', () => {
    const { doc, body } = page()
    const run = vi.fn()
    whenNotTyping(run, doc)
    expect(run).not.toHaveBeenCalled()
    doc.activeElement = body as unknown as Element
    doc.dispatchEvent(new Event('focusout'))
    vi.advanceTimersByTime(300)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('a field taken away with no `focusout` does not hold it for ever: looked at again every 2 s', () => {
    const { doc } = page()
    const run = vi.fn()
    whenNotTyping(run, doc)
    vi.advanceTimersByTime(10_000)
    expect(run).not.toHaveBeenCalled()
    // The editor closed: the focused element was removed and the browser sent nothing.
    doc.activeElement = null
    vi.advanceTimersByTime(2_000)
    expect(run).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(10_000)
    doc.dispatchEvent(new Event('focusout'))
    vi.advanceTimersByTime(1_000)
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('looked at again when the app comes back into view', () => {
    const { doc, body } = page()
    const run = vi.fn()
    whenNotTyping(run, doc)
    doc.activeElement = body as unknown as Element
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('cancelled, it never runs and stops looking', () => {
    const { doc } = page()
    const run = vi.fn()
    const cancel = whenNotTyping(run, doc)
    cancel()
    doc.activeElement = null
    vi.advanceTimersByTime(10_000)
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(run).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })
})
