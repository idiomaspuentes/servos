/**
 * The same keys in every mini app (philosophy, principle 13): Alt+↓ and Alt+↑ go to the next and the previous verse or
 * section, also from the editor's lines (kept as they are typed); Ctrl+Enter does what the filled button does, once
 * per press; Ctrl+Z and Ctrl+Y undo and redo where the screen can. Esc closes what is on top (`Sheet`). A key is never the only way to do something: each
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

function inText(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null
  return Boolean(target?.closest?.('input, textarea, select, [contenteditable]'))
}

/**
 * Whether a box being written in keeps this key for itself. Undo and redo: always, it has its own. Next and previous:
 * but in the editor's lines, which are kept as they are typed, so leaving one loses nothing. Any other box (a
 * reviewer's comment) keeps what it has only until it is saved: moving away would throw it away, and on a Mac
 * Option+↑/↓ is how a box goes to the start or the end of a paragraph.
 */
export function boxKeeps(name: KeyName, e: KeyboardEvent): boolean {
  if (!inText(e)) return false
  if (name === 'undo' || name === 'redo') return true
  if (name === 'next' || name === 'previous') return !(e.target as HTMLElement).closest?.('.line-field')
  return false
}

/**
 * Runs `run` when `name` is pressed on this screen. While a sheet is open the keys are the sheet's: the screen behind
 * it does not move. A box being written in may keep the key (`boxKeeps`).
 */
export function useKey(name: KeyName, run: (() => void) | null | undefined) {
  const latest = useRef(run)
  latest.current = run
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (keyOf(e) !== name || !latest.current || sheetOpen()) return
      if (boxKeeps(name, e)) return
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

/**
 * Whether this press is Ctrl+Enter for the filled button. Once per press: a key held down repeats, and the next filled
 * button may be another answer («Sí, se entiende bien» for the next note), which the person did not give (principle 9).
 * Not while a word is being composed, nor when the box or the button that has the key already did something with it.
 */
export function pressesPrimary(e: KeyboardEvent): boolean {
  return keyOf(e) === 'primary' && !e.repeat && !e.isComposing && !e.defaultPrevented
}

/** Ctrl+Enter does what the one filled button of what is on top does (philosophy, principle 7: one per screen). */
export function usePrimaryKey() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!pressesPrimary(e)) return
      const button = filledButtons()[0]
      if (!button) return
      e.preventDefault()
      button.click()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
