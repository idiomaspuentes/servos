/**
 * A sheet that comes up from the bottom (philosophy, layer «hoja que sube»): a list, an article, a menu.
 *
 * It is drawn in the page's body, not where it is opened: inside a moved pane (`Panes` moves its row by a transform)
 * a fixed box is fixed to that row, not to the screen, and opened off screen on a phone and cut at the top on a wide
 * one. Events still reach the tree it was opened from, so a finger on the sheet must not swipe the panes behind it.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n/i18n'

/** The sheets open, the last on top: the phone's back button closes the top one before it leaves a screen. */
const open: Array<{ close(): boolean }> = []

/**
 * Told how many sheets are open when that changes: where a screen keeps no entry in the browser's history of its own
 * (home), one is kept while a sheet is open, so the phone's back button closes it there too. Told once the opening or
 * closing settles (a sheet drawn twice in development comes and goes in one go).
 */
const listeners = new Set<(count: number) => void>()
let told = 0
const tell = () =>
  queueMicrotask(() => {
    if (open.length === told) return
    told = open.length
    listeners.forEach((fn) => fn(told))
  })
export function onSheets(fn: (count: number) => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/**
 * Closes the sheet on top: `closed`; or, when it holds something written and not saved, asks first and stays open:
 * `asked`. Null when no sheet is open.
 */
export function closeTopSheet(): 'closed' | 'asked' | null {
  const top = open[open.length - 1]
  if (!top) return null
  return top.close() ? 'closed' : 'asked'
}

export function Sheet({
  title,
  onClose,
  children,
  dirty = false,
}: {
  title: string
  onClose(): void
  children: ReactNode
  /**
   * Something written in it and not saved: closing it (its button, outside it, Escape, the phone's back button) asks
   * first, so what was written is not lost by a slip of the finger (philosophy, principle 9).
   */
  dirty?: boolean
}) {
  const t = useT()
  const panel = useRef<HTMLDivElement>(null)
  // The sheet takes the focus once, as it opens. Taken again on every drawing (a new `onClose` each time) it was taken
  // from a field just touched: the keyboard coming up redraws the screen, and went away again.
  useEffect(() => panel.current?.focus(), [])
  const [asking, setAsking] = useState(false)
  // Whether it closed: with something unsaved it asks instead.
  const attempt = useRef<() => boolean>(() => true)
  attempt.current = () => {
    if (dirty) {
      setAsking(true)
      return false
    }
    onClose()
    return true
  }
  const close = () => void attempt.current()
  useEffect(() => {
    const entry = { close: () => attempt.current() }
    open.push(entry)
    tell()
    return () => {
      open.splice(open.indexOf(entry), 1)
      tell()
    }
  }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && attempt.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return createPortal(
    <div className="sheet-backdrop" onClick={close} onPointerDown={(e) => e.stopPropagation()}>
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
          <button type="button" className="button-quiet" onClick={close}>
            {t('marco.cerrar')}
          </button>
        </div>
        {asking && (
          <div className="sheet-ask" role="alertdialog" aria-label={t('marco.sinGuardar')}>
            <p>{t('marco.sinGuardar')}</p>
            <div className="glossary-actions">
              <button type="button" className="button-secondary" onClick={() => setAsking(false)}>
                {t('marco.seguirEscribiendo')}
              </button>
              <button type="button" className="button-secondary sheet-ask-close" onClick={onClose}>
                {t('marco.cerrarSinGuardar')}
              </button>
            </div>
          </div>
        )}
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
