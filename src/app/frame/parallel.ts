/**
 * Texts read side by side on a computer (philosophy, principle 13): the TPL beside the TPS, or beside the original.
 * Each text's name is a switch, the chapter goes one row per verse so the texts stay in step, and what was chosen is
 * there the next time. Taller reads its chapters the same way (`src/domain/parallelChapter.ts` there), so a team that
 * uses both apps finds the same gesture in each.
 */

/** Which texts are shown after `id` is touched: added, or taken away when it was shown. They keep the order the
 * screen lists them in; one always stays, and past `max` the touch does nothing (the person takes one away first).
 * Where only one fits (the editor with its helps on a window narrower than 1280 px), the touched one takes its place. */
export function toggleShown(shown: string[], id: string, order: string[], max: number): string[] {
  const on = shown.includes(id)
  if (on && shown.length === 1) return shown
  if (!on && max === 1) return [id]
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
  // One at a time: the one chosen, or the text read when it was among several.
  if (max === 1 && valid.length) return [first && valid.includes(first) ? first : valid[0]]
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

/**
 * The rows when the team writes in the same rows (the editor): a verse each, and the verses said together (`\v 1-2`)
 * in one, as they are written in one box. `unitOf` gives the verses said with a verse, itself alone when none.
 */
export function rowsOf(verses: number[], unitOf: (verse: number) => number[]): number[][] {
  const rows: number[][] = []
  const placed = new Set<number>()
  for (const v of verses) {
    if (placed.has(v)) continue
    const unit = unitOf(v)
    for (const u of unit) placed.add(u)
    rows.push(unit)
  }
  return rows
}

/**
 * Where the line being written (counted over the box of the whole row) falls in a text: in which of the row's verses,
 * and which of its lines. A text with fewer lines shows its last; one with none in the row shows nothing.
 */
export function lineIn(unit: number[], line: number, countOf: (verse: number) => number): { verse: number; line: number } | null {
  let left = line
  let last: { verse: number; line: number } | null = null
  for (const verse of unit) {
    const count = countOf(verse)
    if (!count) continue
    if (left < count) return { verse, line: left }
    left -= count
    last = { verse, line: count - 1 }
  }
  return last
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
