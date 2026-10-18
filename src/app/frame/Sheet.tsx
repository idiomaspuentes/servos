/**
 * A sheet that comes up from the bottom (philosophy, layer «hoja que sube»): a list, an article, a menu.
 *
 * It is drawn in the page's body, not where it is opened: inside a moved pane (`Panes` moves its row by a transform)
 * a fixed box is fixed to that row, not to the screen, and opened off screen on a phone and cut at the top on a wide
 * one. Events still reach the tree it was opened from, so a finger on the sheet must not swipe the panes behind it.
 */

import { useEffect, useRef, useState, type KeyboardEvent as KeyEvent, type ReactNode } from 'react'
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

/** Whether a sheet is open: the keys of the screen behind it wait (`keys.ts`). */
export function sheetOpen(): boolean {
  return open.length > 0
}

const TEXT = 'input, textarea, select, [contenteditable]'
const FOCUSABLE = 'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex]:not([tabindex="-1"])'

export function Sheet({
  title,
  onClose,
  children,
  dirty = false,
  menu = false,
}: {
  title: string
  onClose(): void
  children: ReactNode
  /**
   * A menu of a screen («Más», the person's): on a phone a sheet like any other; on a wide window it opens under its
   * button at the top right, as a desktop menu does, while a sheet is a box in the middle (philosophy, principle 13).
   */
  menu?: boolean
  /**
   * Something written in it and not saved: closing it (its button, outside it, Escape, the phone's back button) asks
   * first, so what was written is not lost by a slip of the finger (philosophy, principle 9).
   */
  dirty?: boolean
}) {
  const t = useT()
  const panel = useRef<HTMLDivElement>(null)
  // What had the focus when it opened, to give it back when it closes.
  const opener = useRef<Element | null>(null)
  if (opener.current === null && typeof document !== 'undefined') opener.current = document.activeElement
  // The sheet takes the focus once, as it opens. Taken again on every drawing (a new `onClose` each time) it was taken
  // from a field just touched: the keyboard coming up redraws the screen, and went away again.
  useEffect(() => {
    panel.current?.focus()
    const from = opener.current
    return () => {
      // Closed, the focus goes back to the button that opened it, for whoever goes by the keyboard (principle 13);
      // never to a box being written in, whose keyboard would come up again on a phone.
      if (from instanceof HTMLElement && from !== document.body && from.isConnected && !from.closest(TEXT)) from.focus({ preventScroll: true })
    }
  }, [])
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
  const entry = useRef<{ close(): boolean } | null>(null)
  useEffect(() => {
    const mine = { close: () => attempt.current() }
    entry.current = mine
    open.push(mine)
    tell()
    return () => {
      open.splice(open.indexOf(mine), 1)
      tell()
    }
  }, [])
  useEffect(() => {
    // Esc closes the sheet on top only: one opened from another leaves that one open.
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && open[open.length - 1] === entry.current && attempt.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // Tab goes round inside the open sheet, not on to the screen behind it (principle 13). A sheet opened from this one
  // is drawn apart in the page, so its keys are its own.
  const keepTab = (e: KeyEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !(e.target instanceof Node) || !e.currentTarget.contains(e.target)) return
    const all = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
    if (!all.length) return
    const first = all[0]
    const last = all[all.length - 1]
    const at = document.activeElement
    if (e.shiftKey && (at === first || at === e.currentTarget)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && at === last) {
      e.preventDefault()
      first.focus()
    }
  }
  return createPortal(
    <div className={menu ? 'sheet-backdrop is-menu' : 'sheet-backdrop'} onClick={close} onPointerDown={(e) => e.stopPropagation()}>
      <div
        className={menu ? 'sheet is-menu' : 'sheet'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={keepTab}
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
