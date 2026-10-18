/**
 * Texts read side by side on a computer (philosophy, principle 13): the TPL beside the TPS, or beside the original.
 * Each text's name is a switch, the chapter goes one row per verse so the texts stay in step, and what was chosen is
 * there the next time. Taller reads its chapters the same way (`src/domain/parallelChapter.ts` there), so a team that
 * uses both apps finds the same gesture in each.
 */

/** Which texts are shown after `id` is touched: added, or taken away when it was shown. They keep the order the
 * screen lists them in; one always stays, and past `max` the touch does nothing (the person takes one away first). */
export function toggleShown(shown: string[], id: string, order: string[], max: number): string[] {
  const on = shown.includes(id)
  if (on && shown.length === 1) return shown
  if (!on && shown.length >= max) return shown
  const next = on ? shown.filter((x) => x !== id) : [...shown, id]
  return order.filter((x) => next.includes(x))
}

/**
 * The texts shown when the screen opens, or when the window narrows and fewer fit: those kept that this screen has,
 * no more than `max`, with `initial` (the text the person reads) among them; with nothing kept, `initial` alone, or
 * the first text.
 */
export function shownAtStart(kept: unknown, order: string[], initial: string | undefined, max: number): string[] {
  const first = initial && order.includes(initial) ? initial : undefined
  let valid = Array.isArray(kept) ? order.filter((id) => (kept as unknown[]).includes(id)) : []
  if (first && valid.length && !valid.includes(first)) valid = order.filter((id) => [...valid.slice(0, max - 1), first].includes(id))
  if (valid.length > max) {
    // The text read stays; of the others, the first ones listed.
    const keep = new Set(first && valid.includes(first) ? [first] : [])
    for (const id of valid) if (keep.size < max) keep.add(id)
    valid = order.filter((id) => keep.has(id))
  }
  if (valid.length) return valid
  return order.length ? [first ?? order[0]] : []
}

/** The verses any of the texts has, in order: one row each. */
export function versesOf(sets: Iterable<number>[]): number[] {
  const all = new Set<number>()
  for (const set of sets) for (const v of set) if (v > 0) all.add(v)
  return [...all].sort((a, b) => a - b)
}

/** What a text's cell says in a verse's row. */
export type SideCell =
  | { kind: 'text' }
  /** The team said this verse together with an earlier one: its text is in that verse's row. */
  | { kind: 'joined'; from: number }
  /** This text has nothing for this verse. */
  | { kind: 'missing' }

/** A text of words (a bridge text, the original): it has the verse or it does not. */
export function cellOfText(lines: Record<number, unknown>, verse: number): SideCell {
  return lines[verse] ? { kind: 'text' } : { kind: 'missing' }
}

/** The team's own text: its verse, the verse it is said together with, or nothing written yet. */
export function cellOfOwn(verse: number, startOf: (verse: number) => number, textOf: (verse: number) => string): SideCell {
  const start = startOf(verse)
  if (start !== verse) return { kind: 'joined', from: start }
  return textOf(verse).trim() ? { kind: 'text' } : { kind: 'missing' }
}
