/**
 * Panes side by side, one in sight on a phone: a finger slides from one to the next, or a tab is touched. Neither
 * takes the focus from the box being written in, so the keyboard stays up while the person goes to read the text
 * they translate from and comes back (a phone hides the keyboard when the focus leaves the box).
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

export function Panes({ panes, label, onPane }: { panes: Pane[]; label: string; onPane?(id: string): void }) {
  const track = useRef<HTMLDivElement>(null)
  const [current, setCurrent] = useState(0)

  const go = (index: number) => {
    const el = track.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: document.visibilityState === 'visible' ? 'smooth' : 'auto' })
    setCurrent(index)
  }

  useEffect(() => {
    onPane?.(panes[current]?.id ?? '')
  }, [current]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
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
      <div
        ref={track}
        className="panes-track"
        onPointerDown={keepFocus}
        onScroll={(e) => {
          const el = e.currentTarget
          const index = Math.round(Math.abs(el.scrollLeft) / Math.max(1, el.clientWidth))
          if (index !== current) setCurrent(index)
        }}
      >
        {panes.map((pane) => (
          <section key={pane.id} id={`pane-${pane.id}`} role="tabpanel" aria-labelledby={`pane-tab-${pane.id}`} className="pane">
            {pane.content}
          </section>
        ))}
      </div>
    </div>
  )
}
