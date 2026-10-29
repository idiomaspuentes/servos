/**
 * The shapes an action takes (philosophy, principle 12): nothing that acts floats alone as blue text. A row opens
 * something more (› a sheet or another place, ▾ unfolding here); a suggestion is a neutral card with its action and
 * «Not now». Filled and outlined buttons, chips and the arrows of a list are plain classes (`button-primary`,
 * `button-secondary`, `chip`, `pager-arrow`).
 */

import type { ReactNode } from 'react'
import { useT } from '../i18n/i18n'

/** A row that opens something more: › to a sheet or another place, ▾ to unfold here (then `expanded`). */
export function RowButton({
  label,
  meta,
  kind = 'open',
  expanded,
  onClick,
}: {
  label: ReactNode
  /** What the row holds, said quietly at its end («3», «Charis SIL»). */
  meta?: ReactNode
  kind?: 'open' | 'fold'
  expanded?: boolean
  onClick(): void
}) {
  return (
    <button type="button" className={`row-button is-${kind}`} aria-expanded={kind === 'fold' ? Boolean(expanded) : undefined} onClick={onClick}>
      <span className="row-button-label">{label}</span>
      {meta !== undefined && <span className="row-button-meta">{meta}</span>}
    </button>
  )
}

/**
 * Something switched on or off and left so (a copy made by itself): the words, and at their end the switch, the whole
 * row to touch. Not a choice between two (those are pills), and not an action (that is a button).
 */
export function Switch({ label, on, onChange }: { label: ReactNode; on: boolean; onChange(on: boolean): void }) {
  return (
    <button type="button" role="switch" aria-checked={on} className="switch-row" onClick={() => onChange(!on)}>
      <span className="switch-label">{label}</span>
      <span className="switch" aria-hidden="true" />
    </button>
  )
}

/**
 * Something the app suggests doing once (naming the book): a neutral card under what continues the work, with its
 * action and «Not now». One a screen; what it offers stays reachable in «More».
 */
export function Suggestion({
  text,
  action,
  mark = '✎',
  onAction,
  onDismiss,
}: {
  text: ReactNode
  action: string
  /** The sign before the action, when it says what it does (✎ to write); none when the action opens something. */
  mark?: string
  onAction(): void
  onDismiss(): void
}) {
  const t = useT()
  return (
    <section className="suggestion" aria-label={typeof text === 'string' ? text : undefined}>
      <p>{text}</p>
      <div className="chip-row">
        <button type="button" className="chip chip-action" onClick={onAction}>
          {mark ? `${mark} ${action}` : action}
        </button>
        <button type="button" className="chip" onClick={onDismiss}>
          {t('marco.ahoraNo')}
        </button>
      </div>
    </section>
  )
}
