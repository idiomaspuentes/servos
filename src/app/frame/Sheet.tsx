/**
 * A sheet that comes up from the bottom (philosophy, layer «hoja que sube»): a list, an article, a menu.
 *
 * It is drawn in the page's body, not where it is opened: inside a moved pane (`Panes` moves its row by a transform)
 * a fixed box is fixed to that row, not to the screen, and opened off screen on a phone and cut at the top on a wide
 * one. Events still reach the tree it was opened from, so a finger on the sheet must not swipe the panes behind it.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n/i18n'

/** The sheets open, the last on top: the phone's back button closes the top one before it leaves a screen. */
const open: Array<{ close(): void }> = []

/** Closes the sheet on top, if one is open; whether one was. */
export function closeTopSheet(): boolean {
  const top = open[open.length - 1]
  if (!top) return false
  top.close()
  return true
}

export function Sheet({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const t = useT()
  const panel = useRef<HTMLDivElement>(null)
  // The sheet takes the focus once, as it opens. Taken again on every drawing (a new `onClose` each time) it was taken
  // from a field just touched: the keyboard coming up redraws the screen, and went away again.
  useEffect(() => panel.current?.focus(), [])
  const close = useRef(onClose)
  close.current = onClose
  useEffect(() => {
    const entry = { close: () => close.current() }
    open.push(entry)
    return () => void open.splice(open.indexOf(entry), 1)
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose} onPointerDown={(e) => e.stopPropagation()}>
      <div
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sheet-head">
          <h2>{title}</h2>
          <button type="button" className="button-quiet" onClick={onClose}>
            {t('marco.cerrar')}
          </button>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body
  )
}

/** A menu row: the action, and under it what it does (philosophy, principle 3). */
export function MenuRow({ label, description, onClick, disabled }: { label: string; description?: string; onClick(): void; disabled?: boolean }) {
  return (
    <button type="button" className="menu-row" onClick={onClick} disabled={disabled}>
      <span className="menu-row-label">{label}</span>
      {description && <span className="menu-row-description">{description}</span>}
    </button>
  )
}
