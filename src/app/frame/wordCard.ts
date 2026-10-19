/**
 * What the card of a touched word shows where, and how the pane moves around it (TouchWords), apart from the drawing
 * so it can be tried without a screen.
 *
 * The card has a fixed shape: the word (what it is in the original and in the other texts, the team's decision), then
 * the helps that are read one at a time (what the original says of its reading, the notes, the words with an article),
 * then, folded, more about the word of the original. Only the middle part pages, so moving from help to help changes
 * nothing above its arrows, and the arrows stay under the finger.
 */

import type { Places } from '../../prototype/data'

/** The kinds of help read one at a time, behind the card's arrows; the others are the card's fixed head and fold. */
export const PAGED = ['lectura', 'nota', 'palabra'] as const

export function pagedHelps<T extends { kind: string }>(helps: T[]): T[] {
  return helps.filter((h) => (PAGED as readonly string[]).includes(h.kind))
}

/**
 * The words lit in a text: the words of the help being read; with none to page through, the touched word and the
 * words that translate the same words of the original in every text (what the head of the card says); else the
 * touched word alone.
 */
export function litOf(
  helps: Array<{ kind: string; places: Places }>,
  index: number,
  touched: { abbreviation: string; place: number },
  abbreviation: string
): Set<number> {
  const paged = pagedHelps(helps)
  const help = paged[Math.min(index, paged.length - 1)]
  if (help) return new Set(help.places[abbreviation] ?? [])
  const aligned = helps.filter((h) => h.kind === 'puente' || h.kind === 'lexico').flatMap((h) => h.places[abbreviation] ?? [])
  const own = touched.abbreviation === abbreviation ? [touched.place] : []
  return new Set([...own, ...aligned])
}

/** The short sense of a word of the original: the first glosses of its sense in this verse, else the lexicon's brief. */
export function shortGloss(sense: { glosses?: string[] } | undefined, brief: string): string {
  const glosses = sense?.glosses?.filter(Boolean) ?? []
  return glosses.length ? glosses.slice(0, 3).join(', ') : brief
}

/**
 * The scroll that keeps a word where it stood on screen after what is above it changed (a card closing above it, a
 * card closing under it at the end of the pane): `was` its top on screen then, `now` its top now.
 */
export const keepPlace = (scroll: number, was: number, now: number): number => scroll + (now - was)

/**
 * How far to scroll down so the start of a card opened under a word is in sight: its top down to `until` (the word's
 * head and the first help's arrows), a margin above the pane's bottom. Never so far that the word itself leaves the
 * top: the person reads the card with the word they touched, and the words it lights, still in sight. 0 when it fits.
 */
export function revealBelow({
  paneTop,
  paneBottom,
  wordTop,
  until,
  margin = 8,
}: {
  paneTop: number
  paneBottom: number
  wordTop: number
  until: number
  margin?: number
}): number {
  const need = until - (paneBottom - margin)
  if (need <= 0) return 0
  return Math.max(0, Math.min(need, wordTop - paneTop - margin))
}

/** Whether a box is at least partly in sight in its pane. */
export const inSight = (box: { top: number; bottom: number }, pane: { top: number; bottom: number }): boolean => box.bottom > pane.top && box.top < pane.bottom
