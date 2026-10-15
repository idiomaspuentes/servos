/**
 * The prototype reads a fixed chapter taken from a real pack (`makeData.test.ts`), in the shape the screens need. When
 * the screens are wired, `src/resources/reading.ts` gives the same things from the device.
 */

import type { ChapterPiece } from '../resources/reading'
import tito1 from './data/tito-1.json'

export interface PrototypeNote {
  id: string
  /** Words of the original. */
  quote: string
  /** The same words in each bridge text, when aligned. */
  glt: string | null
  gst: string | null
  /** Markdown. */
  note: string
  /** Translation Academy article path (`translate/figs-metaphor`), when the note points to one. */
  academy: string | null
}

export interface PrototypeData {
  source: string
  language: string
  book: { id: string; name: string; chapters: number }
  chapter: number
  texts: Array<{ key: string; abbreviation: string; title: string; pieces: ChapterPiece[] }>
  verses: Array<{
    verse: number
    notes: PrototypeNote[]
    questions: Array<{ id: string; question: string; response: string }>
    words: Array<{ id: string; original: string; article: string; keyTerm: boolean }>
  }>
  words: Record<string, { title: string; markdown: string }>
  academy: Record<string, { title: string; markdown: string }>
}

export const TITO_1 = tito1 as PrototypeData
