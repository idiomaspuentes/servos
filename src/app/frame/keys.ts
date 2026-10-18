/**
 * The same keys in every mini app (philosophy, principle 13): Alt+↓ and Alt+↑ go to the next and the previous verse or
 * section, also from a box being written in; Ctrl+Enter does what the filled button does; Ctrl+Z and Ctrl+Y undo and
 * redo where the screen can. Esc closes what is on top (`Sheet`). A key is never the only way to do something: each
 * is a button too, and the button says its key when the pointer rests on it.
 */

import { useEffect, useRef } from 'react'
import { sheetOpen } from './Sheet'

/** How a key is written beside its action. Key names are the keyboard's, the same in every language. */
export const KEYS = { next: 'Alt+↓', previous: 'Alt+↑', primary: 'Ctrl+Enter', undo: 'Ctrl+Z', redo: 'Ctrl+Y' } as const

export type KeyName = keyof typeof KEYS

const command = (e: KeyboardEvent) => (e.ctrlKey || e.metaKey) && !e.altKey

/** Which of the app's keys this press is, if any. */
export function keyOf(e: KeyboardEvent): KeyName | null {
  if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === 'ArrowDown') return 'next'
  if (e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.key === 'ArrowUp') return 'previous'
  if (command(e) && e.key === 'Enter') return 'primary'
  if (command(e) && !e.shiftKey && e.key.toLowerCase() === 'z') return 'undo'
  if (command(e) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) return 'redo'
  return null
}

/** A box being written in keeps its own undo and redo. */
function inText(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable]'))
}

/**
 * Runs `run` when `name` is pressed on this screen. While a sheet is open the keys are the sheet's: the screen behind
 * it does not move. Undo and redo are left to a box being written in.
 */
export function useKey(name: KeyName, run: (() => void) | null | undefined) {
  const latest = useRef(run)
  latest.current = run
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (keyOf(e) !== name || !latest.current || sheetOpen()) return
      if ((name === 'undo' || name === 'redo') && inText(e)) return
      e.preventDefault()
      latest.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [name])
}

/** The visible filled buttons of what is on top: the open sheet, or else the screen. */
function filledButtons(): HTMLButtonElement[] {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]')
  const scope: ParentNode = dialogs.length ? dialogs[dialogs.length - 1] : document
  return [...scope.querySelectorAll<HTMLButtonElement>('button.button-primary:not(:disabled)')].filter(
    (b) => b.getClientRects().length > 0
  )
}

/** Ctrl+Enter does what the one filled button of what is on top does (philosophy, principle 7: one per screen). */
export function usePrimaryKey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (keyOf(e) !== 'primary') return
      const button = filledButtons()[0]
      if (!button) return
      e.preventDefault()
      button.click()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
