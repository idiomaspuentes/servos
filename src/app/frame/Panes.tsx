/**
 * Panes side by side, one in sight on a phone: a finger slides from one to the next, or a tab is touched. Neither
 * takes the focus from the box being written in, so the keyboard stays up while the person goes to read the text
 * they translate from and comes back (a phone hides the keyboard when the focus leaves the box).
 *
 * The row of panes is moved by a transform inside a box that clips, not scrolled. A phone keeps the focused box in
 * sight: with the row a scroll container, Chrome on Android scrolled it back to the box as soon as the keyboard moved,
 * and scroll snapping re-snaps to the pane that holds the focus. A clipped box cannot be scrolled by anyone, so the
 * swipe is read here from the pointer.
 *
 * On a wide screen one pane (`fixed`, the boxes) stays in sight on the right and the others share the left, so the
 * text being read and the one being written are side by side.
 */

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'

export interface Pane {
  id: string
  label: string
  content: ReactNode
}

/** Keeps the focus where it is: on a phone, the keyboard of the box being written in stays up. */
export function keepFocus(event: PointerEvent) {
  const target = event.target as HTMLElement
  if (target.closest('input, textarea, select, [contenteditable]')) return
  if (document.activeElement instanceof HTMLTextAreaElement || document.activeElement instanceof HTMLInputElement) event.preventDefault()
}

/**
 * Brings a box into sight in the pane that scrolls around it, never by scrolling the page: its first line when it
 * opens above the pane's top or is taller than the pane (a long help moved to with «Next» from its end), else its
 * whole when it opens below.
 */
export function showInPane(box: HTMLElement | null) {
  const pane = box?.parentElement?.closest<HTMLElement>('.pane')
  if (!box || !pane) return
  const c = pane.getBoundingClientRect()
  const r = box.getBoundingClientRect()
  if (r.top < c.top) pane.scrollTop -= c.top - r.top + 8
  else if (r.bottom > c.bottom) pane.scrollTop += Math.min(r.top - c.top - 8, r.bottom - c.bottom + 8)
}

/** Where a screen is wide enough for two panes side by side. */
const WIDE = '(min-width: 900px)'

function useWide(): boolean {
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(WIDE).matches)
  useEffect(() => {
    const query = window.matchMedia(WIDE)
    const change = () => setWide(query.matches)
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  return wide
}

/** How far a finger moves before it counts as a swipe, and how far (of the width) to go to the next pane. */
const SLOP = 10
const ENOUGH = 0.2

export function Panes({ panes: all, label, onPane, fixed }: { panes: Pane[]; label: string; onPane?(id: string): void; fixed?: string }) {
  const wide = useWide()
  const kept = wide ? all.find((p) => p.id === fixed) : undefined
  const panes = kept ? all.filter((p) => p !== kept) : all
  const track = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  // Between one column and two the panes are not the same list: start again from the first.
  const [wasWide, setWasWide] = useState(Boolean(kept))
  if (wasWide !== Boolean(kept)) {
    setWasWide(Boolean(kept))
    setCurrent(0)
  }
  const swipe = useRef<{ id: number; x: number; y: number; t: number; dx: number; horizontal: boolean | null } | null>(null)
  // A swipe that ends over a word must not touch it.
  const swiped = useRef(false)

  const go = (index: number) => setCurrent(Math.max(0, Math.min(panes.length - 1, index)))

  useEffect(() => {
    onPane?.(panes[current]?.id ?? '')
  }, [current]) // eslint-disable-line react-hooks/exhaustive-deps

  // Under the finger the row follows it at once; let go, it slides to its pane (the same value React sets).
  const place = (dx: number, moving: boolean) => {
    const el = track.current
    if (!el) return
    el.style.transition = moving ? 'none' : ''
    el.style.transform = `translateX(calc(${-current * 100}% + ${dx}px))`
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    keepFocus(event)
    if (event.pointerType === 'mouse') return
    swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY, t: event.timeStamp, dx: 0, horizontal: null }
    swiped.current = false
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current
    if (!s || s.id !== event.pointerId) return
    const dx = event.clientX - s.x
    const dy = event.clientY - s.y
    if (s.horizontal === null) {
      if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return
      s.horizontal = Math.abs(dx) > Math.abs(dy) * 1.2
      if (!s.horizontal) return
      event.currentTarget.setPointerCapture(event.pointerId)
      swiped.current = true
    }
    if (!s.horizontal) return
    // Past the first and the last pane the row gives a little, and no more.
    const edge = (dx > 0 && current === 0) || (dx < 0 && current === panes.length - 1)
    s.dx = edge ? dx / 4 : dx
    place(s.dx, true)
  }
  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current
    if (!s || s.id !== event.pointerId) return
    swipe.current = null
    if (!s.horizontal) return
    const width = track.current?.clientWidth ?? 1
    const fast = Math.abs(s.dx) / Math.max(1, event.timeStamp - s.t) > 0.5
    place(0, false)
    if (event.type === 'pointerup' && (Math.abs(s.dx) > width * ENOUGH || (fast && Math.abs(s.dx) > SLOP * 3))) go(current + (s.dx < 0 ? 1 : -1))
  }

  const row = (
    <div className="panes">
      <div className="panes-tabs" role="tablist" aria-label={label} onPointerDown={keepFocus}>
        {panes.map((pane, index) => (
          <button
            key={pane.id}
            type="button"
            role="tab"
            id={`pane-tab-${pane.id}`}
            aria-controls={`pane-${pane.id}`}
            aria-selected={index === current}
            className="panes-tab"
            onClick={() => go(index)}
          >
            {pane.label}
          </button>
        ))}
      </div>
      <div className="panes-window">
        <div
          ref={track}
          className="panes-track"
          style={{ transform: `translateX(${-current * 100}%)` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onClickCapture={(event) => {
            if (!swiped.current) return
            swiped.current = false
            event.stopPropagation()
            event.preventDefault()
          }}
        >
          {panes.map((pane) => (
            <section
              key={pane.id}
              id={`pane-${pane.id}`}
              role="tabpanel"
              aria-labelledby={`pane-tab-${pane.id}`}
              className="pane"
            >
              {pane.content}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
  if (!kept) return row
  return (
    <div className="panes-split">
      {row}
      <section id={`pane-${kept.id}`} aria-label={kept.label} className="pane pane-fixed">
        {kept.content}
      </section>
    </div>
  )
}
