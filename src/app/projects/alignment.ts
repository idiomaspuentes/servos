/**
 * Aligning a translation: each word of the draft linked to the words of a source it translates, as Taller and
 * translationCore align a draft with the original. In Servos the source is the one the team chooses: the literal
 * bridge text (TPL) by default, the simple one (TPS), or the Hebrew or Greek. Each source keeps its own alignment.
 *
 * The links are usfm-ast's `AlignmentGroup`s (`sources` the source words, `targets` the draft words), the same Taller
 * writes as `\zaln` in the USFM, worked with through usfm-ast's box model. When the draft changes, the links on the
 * words that stayed are kept (`reconcileAlignments`, as Taller does after an edit); those on words gone are dropped.
 *
 * In the prototype the alignments live in this browser, one a verse and source. Wired, they are the book's.
 */

import type { AlignmentGroup } from '@usfm-tools/types'
import { normalizeWordForAlignmentMatch, reconcileAlignments, tokenizeWords, type OriginalWordToken, type WordToken } from '@usfm-tools/editor-core'
import type { PrototypeText } from '../../prototype/data'

/** The words of a verse of the draft, each with its occurrence among the same words, as the alignment reads them. */
export function draftTokens(text: string, sid: string): WordToken[] {
  const words: string[] = tokenizeWords(text)
  const key = (w: string) => normalizeWordForAlignmentMatch(w)
  const total = new Map<string, number>()
  for (const w of words) total.set(key(w), (total.get(key(w)) ?? 0) + 1)
  const seen = new Map<string, number>()
  return words.map((surface, index) => {
    const occurrence = (seen.get(key(surface)) ?? 0) + 1
    seen.set(key(surface), occurrence)
    return { verseSid: sid, surface, occurrence, occurrences: total.get(key(surface)) ?? 1, index }
  })
}

/** A source's words in a verse, and where each stands among the chapter's words (to light it, or find its meaning). */
export interface SourceWords {
  tokens: OriginalWordToken[]
  places: number[]
}

/**
 * The words of a source in a verse, or in the verses joined with it (aligned together, as they are written). For the
 * original, each with its lemma and Strong number (what a link to it keeps); for a bridge text, its words alone.
 */
export function sourceWords(text: PrototypeText, verses: number | number[], sid: string): SourceWords {
  const pieces = ([] as number[])
    .concat(verses)
    .flatMap((verse) => (text.lines[verse] ?? []).flatMap((l) => l.pieces.filter((p): p is { text: string; word: number } => p.word !== undefined)))
  const key = (w: string) => normalizeWordForAlignmentMatch(w)
  const total = new Map<string, number>()
  for (const p of pieces) total.set(key(p.text), (total.get(key(p.text)) ?? 0) + 1)
  const seen = new Map<string, number>()
  const tokens = pieces.map((p, index) => {
    const occurrence = (seen.get(key(p.text)) ?? 0) + 1
    seen.set(key(p.text), occurrence)
    const w = text.original ? text.words?.[p.word] : undefined
    return {
      verseSid: sid,
      surface: p.text,
      occurrence,
      occurrences: total.get(key(p.text)) ?? 1,
      index,
      strong: w?.strong ?? '',
      lemma: w?.lemma ?? '',
      ...(w?.morph ? { morph: w.morph } : {}),
    }
  })
  return { tokens, places: pieces.map((p) => p.word) }
}

/** What is kept of a verse's alignment: the links, and the verse they were made on. */
export interface KeptAlignment {
  groups: AlignmentGroup[]
  text: string
  by?: string
  at?: string
}

const key = (book: string, chapter: number, verse: number, source: string) => `servos.prototipo.alineacion.${book}.${source}.${chapter}.${verse}`

export function readAlignment(book: string, chapter: number, verse: number, source: string): KeptAlignment | null {
  try {
    return JSON.parse(localStorage.getItem(key(book, chapter, verse, source)) ?? 'null') as KeptAlignment | null
  } catch {
    return null
  }
}

export function writeAlignment(book: string, chapter: number, verse: number, source: string, kept: KeptAlignment) {
  try {
    localStorage.setItem(key(book, chapter, verse, source), JSON.stringify(kept))
  } catch {
    /* kept on screen for this visit */
  }
}

/** The links of a verse for its text as it is now: those made on another text follow the words that stayed. */
export function alignmentFor(kept: KeptAlignment | null, text: string): AlignmentGroup[] {
  if (!kept) return []
  return kept.text.trim() === text.trim() ? kept.groups : reconcileAlignments(kept.text, text, kept.groups)
}
