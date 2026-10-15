/**
 * The prototype reads fixed chapters taken from real packs (`makeData.test.ts`), in the shape the screens need. When
 * the screens are wired, `src/resources/reading.ts` gives the same things from the device.
 */

import type { ChapterPiece, WordLine } from '../resources/reading'
import jonas2 from './data/jonas-2.json'
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
  /** Its words in each text, by abbreviation: places among the chapter's words (`PrototypeText.lines`). */
  places: Places
}

/** Text abbreviation → places of words in that text's chapter. */
export type Places = Record<string, number[]>

export interface PrototypeText {
  key: string
  /** `TPL`, `TPS`, `Griego`, `Hebreo`. */
  abbreviation: string
  title: string
  pieces: ChapterPiece[]
  /** Each verse in the lines the text gives it, with their markers, its words numbered through the chapter. */
  lines: Record<number, WordLine[]>
  /** The Greek or Hebrew the bridge texts translate. */
  original?: boolean
  dir?: 'ltr' | 'rtl'
  lang?: string
}

export interface PrototypeData {
  source: string
  language: string
  book: { id: string; name: string; chapters: number }
  chapter: number
  texts: PrototypeText[]
  /**
   * The chapter's sections, the verses of each: the translators' sections (`\ts\*`) that translationCore and
   * translationCore 4 work by. The es-419 bridge texts do not mark them, so they come from unfoldingWord's ULT.
   */
  sections: number[][]
  verses: Array<{
    verse: number
    notes: PrototypeNote[]
    questions: Array<{ id: string; question: string; response: string }>
    words: Array<{ id: string; original: string; article: string; keyTerm: boolean; places: Places }>
  }>
  words: Record<string, { title: string; markdown: string }>
  academy: Record<string, { title: string; markdown: string }>
}

export const TITO_1 = tito1 as unknown as PrototypeData
export const JONAS_2 = jonas2 as unknown as PrototypeData

/** The chapters the prototype has, by book. */
export const CHAPTERS: Record<string, PrototypeData> = { tit: TITO_1, jon: JONAS_2 }
