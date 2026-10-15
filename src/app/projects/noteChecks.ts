/**
 * Checking a translation against the notes: for each note that sends to a Translation Academy article (a phrase that
 * may be misread or is hard to translate), the translator marks the words of their verse that translate the phrase
 * and says whether they translated it as the note explains.
 *
 * A check is resolved only when it is marked «it is right», and only while the verse is as it was when marked: a
 * later change to the verse leaves it to be checked again, as translationCore 3 and 4 and Taller do. «Correct later»
 * keeps a found error, or a doubt to look into, for when the team is together; it is not resolved.
 *
 * In the prototype the checks live in this browser, one a note. Wired, each is an entry of the book's journal.
 */

import type { PrototypeData, PrototypeNote } from '../../prototype/data'

/**
 * The categories of the checks, by Translation Academy article: translationCore 3's grouping of translation notes,
 * as translationCore 4 keeps it (`src/data/derive.ts`, `TN_CATEGORY_MAP`). An article not listed is «other».
 */
export const NOTE_CATEGORIES: Record<string, string[]> = {
  discourse: [
    'figs-declarative', 'figs-events', 'figs-exclamations', 'figs-exmetaphor', 'figs-imperative', 'figs-parables',
    'figs-pastforfuture', 'figs-quotations', 'figs-quotesinquotes', 'figs-sentences', 'translate-versebridge',
    'writing-background', 'writing-connectingwords', 'writing-endofstory', 'writing-intro', 'writing-newevent',
    'writing-participants', 'writing-poetry', 'writing-proverbs', 'writing-quotations',
  ],
  numbers: ['translate-fraction', 'translate-numbers', 'translate-ordinal'],
  figures: [
    'figs-apostrophe', 'figs-doublenegatives', 'figs-doublet', 'figs-ellipsis', 'figs-euphemism', 'figs-hendiadys',
    'figs-hyperbole', 'figs-idiom', 'figs-irony', 'figs-litotes', 'figs-merism', 'figs-metaphor', 'figs-metonymy',
    'figs-parallelism', 'figs-personification', 'figs-rquestion', 'figs-simile', 'figs-synecdoche', 'figs-quotemarks',
  ],
  culture: [
    'figs-explicit', 'figs-go', 'translate-bdistance', 'translate-bmoney', 'translate-bvolume', 'translate-hebrewmonths',
    'translate-names', 'translate-bweight', 'translate-symaction', 'translate-unknown', 'writing-symlanguage',
  ],
  grammar: [
    'figs-abstractnouns', 'figs-activepassive', 'figs-distinguish', 'figs-exclusive', 'figs-123person', 'figs-they',
    'figs-you', 'figs-we', 'figs-genericnoun', 'figs-hypo', 'figs-inclusive', 'figs-nominaladj', 'figs-possession',
    'figs-pronouns', 'figs-rpronouns', 'figs-gendernotations', 'grammar-connect-logic-goal',
    'grammar-connect-exceptions', 'grammar-connect-logic-contrast', 'grammar-connect-logic-result',
  ],
  other: ['guidelines-sonofgodprinciples', 'translate-manuscripts', 'translate-textvariants', 'translate-transliterate'],
}
export const CATEGORY_ORDER = ['figures', 'grammar', 'culture', 'discourse', 'numbers', 'other']

const categoryOfSlug = new Map(Object.entries(NOTE_CATEGORIES).flatMap(([cat, slugs]) => slugs.map((s) => [s, cat] as const)))

/** The article's slug (`figs-metaphor`) of a path (`translate/figs-metaphor`). */
export const slugOf = (academy: string) => academy.split('/').pop() ?? academy

// A connecting word's article the list does not have yet (`grammar-connect-time-sequential`) is still grammar.
export const categoryOf = (academy: string) =>
  categoryOfSlug.get(slugOf(academy)) ?? (slugOf(academy).startsWith('grammar-') ? 'grammar' : 'other')

/** A note to check: the one note, at the first verse it is about. */
export interface CheckItem {
  note: PrototypeNote
  chapter: number
  verse: number
  /** The Translation Academy article's path. */
  academy: string
  category: string
}

/** The notes of these chapters that send to an article, each once, in the order of the verses. */
export function checksOf(chapters: PrototypeData[]): CheckItem[] {
  const out: CheckItem[] = []
  const seen = new Set<string>()
  for (const data of chapters) {
    for (const v of data.verses) {
      for (const note of v.notes) {
        if (!note.academy || seen.has(note.id)) continue
        seen.add(note.id)
        out.push({ note, chapter: data.chapter, verse: v.verse, academy: note.academy, category: categoryOf(note.academy) })
      }
    }
  }
  return out
}

export type CheckStatus = 'bien' | 'despues'

/** What the translator answered for a note. */
export interface NoteCheck {
  status: CheckStatus
  /** The words of the verse that translate the phrase, by their place among its words (from 0). */
  words: number[]
  /** The phrase is not in the translation (left out on purpose, or missing). */
  notThere?: boolean
  /** For «correct later»: why, and what was seen. */
  reason?: 'equipo' | 'investigar'
  comment?: string
  /** The verse as it was when answered: an answer to another text is not an answer. */
  verseText: string
  by: string
  at: string
}

/** The words of a verse as the translator touches them: what spaces part. */
export const wordsOfVerse = (text: string) => text.split(/\s+/).filter(Boolean)

const key = (book: string, noteId: string) => `servos.prototipo.revisionNota.${book}.${noteId}`

export function readCheck(book: string, noteId: string): NoteCheck | null {
  try {
    return JSON.parse(localStorage.getItem(key(book, noteId)) ?? 'null') as NoteCheck | null
  } catch {
    return null
  }
}

export function writeCheck(book: string, noteId: string, check: NoteCheck) {
  try {
    localStorage.setItem(key(book, noteId), JSON.stringify(check))
  } catch {
    /* kept on screen for this visit */
  }
}

/** Where a note's check stands now, against the verse as it is. */
export type CheckState = 'pendiente' | 'bien' | 'despues' | 'cambio'

export function stateOf(check: NoteCheck | null, verseText: string): CheckState {
  if (!check) return 'pendiente'
  // Answered for another text: whatever the answer, it is to be checked again.
  if (check.verseText.trim() !== verseText.trim()) return 'cambio'
  return check.status
}
