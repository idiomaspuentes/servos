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
 * text being read and the one being written are side by side. On a wider one (from 1280 px) another (`side`, the
 * helps) has a column of its own after them, as translationCore 4 keeps its helps at the right (philosophy,
 * principle 13). On a phone the tabs are at the foot, under the thumb (and right above the keyboard while writing).
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

/** Where a screen is wide enough for two panes side by side, and for a third column (the helps). */
const WIDE = '(min-width: 900px)'
const WIDER = '(min-width: 1280px)'
/** Where a third text fits beside two in the editor, with its boxes and helps. */
const WIDEST = '(min-width: 1600px)'

function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const media = window.matchMedia(query)
    const change = () => setOn(media.matches)
    change()
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [query])
  return on
}

export function useWide(): boolean {
  return useMedia(WIDE)
}

export function useWider(): boolean {
  return useMedia(WIDER)
}

export function useWidest(): boolean {
  return useMedia(WIDEST)
}

/** How far a finger moves before it counts as a swipe, and how far (of the width) to go to the next pane. */
const SLOP = 10
const ENOUGH = 0.2

export function Panes({
  panes: all,
  label,
  onPane,
  fixed,
  side,
  open,
  holdFocus = true,
}: {
  panes: Pane[]
  label: string
  onPane?(id: string): void
  fixed?: string
  /** A pane with a column of its own, after the others, on a window of 1280 px or more (the editor's helps). */
  side?: string
  /**
   * Whether moving between panes keeps the focus in the box being written in (the editor: the keyboard stays up while
   * the person looks at the text). Not where writing is the lesser part (the study's note).
   */
  holdFocus?: boolean
  /** A pane to bring into sight, asked by the mini app (its button leads there); a new object asks again. */
  open?: { id: string }
}) {
  const wide = useWide()
  const wider = useWider()
  const kept = wide ? all.find((p) => p.id === fixed) : undefined
  const aside = kept && wider ? all.find((p) => p.id === side) : undefined
  const panes = all.filter((p) => p !== kept && p !== aside)
  const track = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)
  // Between one column, two and three the panes are not the same list: start again from the first.
  const columns = aside ? 3 : kept ? 2 : 1
  const [wasColumns, setWasColumns] = useState(columns)
  if (wasColumns !== columns) {
    setWasColumns(columns)
    setCurrent(0)
  }
  const swipe = useRef<{ id: number; x: number; y: number; t: number; dx: number; horizontal: boolean | null } | null>(null)
  // A swipe that ends over a word must not touch it.
  const swiped = useRef(false)

  const go = (index: number) => setCurrent(Math.max(0, Math.min(panes.length - 1, index)))
  useEffect(() => {
    const index = open ? panes.findIndex((p) => p.id === open.id) : -1
    if (index >= 0) setCurrent(index)
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (holdFocus) keepFocus(event)
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

  // A pane alone beside the fixed one needs no tab: it names itself (the texts side by side, with their switches).
  const tabs = !(kept && panes.length === 1)
  const row = (
    <div className="panes">
      {tabs && <div className="panes-tabs" role="tablist" aria-label={label} onPointerDown={holdFocus ? keepFocus : undefined}>
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
      </div>}
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
              role={tabs ? 'tabpanel' : 'region'}
              aria-labelledby={tabs ? `pane-tab-${pane.id}` : undefined}
              aria-label={tabs ? undefined : pane.label}
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
    <div className={aside ? 'panes-split has-side' : 'panes-split'}>
      {row}
      <section id={`pane-${kept.id}`} aria-label={kept.label} className="pane pane-fixed">
        {kept.content}
      </section>
      {aside && (
        <section id={`pane-${aside.id}`} aria-label={aside.label} className="pane pane-side">
          {/* Its name over it, as the tabs name the panes beside it */}
          <h2 className="pane-side-title">{aside.label}</h2>
          {aside.content}
        </section>
      )}
    </div>
  )
}
