/**
 * A book begun in another app (translationCore, Paratext, a text editor), brought in from its USFM file: each verse's
 * text as it is read (the alignment and the markers left out), a bridge (`\v 1-2`) as verses joined. It is gathered as
 * a book shared from another phone is (`share.ts`): a verse empty here takes its text, one the same stays, and one
 * written otherwise keeps both versions until someone chooses. Nothing written here is overwritten.
 */

import { placesOf } from '../../core/book'
import { BOOKS, type Phase } from './model'
import type { SharedBook } from './share'

export interface UsfmBook {
  /** The book's code, from `\id`, if it is one Servos knows. */
  code: string | null
  /** The `\id` as written, to say what was found when it is not known. */
  id: string
  book: SharedBook
  /** Verses with text. */
  verses: number
}

export function readUsfmBook(usfm: string, by: string, phase: Phase = 'traduccion'): UsfmBook {
  const id = (usfm.match(/\\id\s+(\S+)/)?.[1] ?? '').trim()
  const known = BOOKS.find(([c]) => c.toLowerCase() === id.toLowerCase())?.[0] ?? null
  const verses = placesOf(usfm)
    .filter((p) => p.text.trim())
    .map((p) => ({ chapter: p.chapter, verse: p.from, text: p.text, by, ...(p.to > p.from ? { joinedTo: p.to } : {}) }))
  return {
    code: known,
    id,
    verses: verses.length,
    book: { code: known ?? id.toLowerCase(), phase, verses, alignments: [], checks: {}, studyNotes: [] },
  }
}
