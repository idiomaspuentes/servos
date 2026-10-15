/**
 * The prototype reads the chapters of Titus and Jonah taken from real packs (`makeData.test.ts`), in the shape the
 * screens need. When the screens are wired, `src/resources/reading.ts` gives the same things from the device.
 */

import type { ChapterPiece, WordLine } from '../resources/reading'

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
  /**
   * For a bridge text, each word's places in the original (the words it translates), by the word's place: what
   * lets a touched word find the words of the other bridge text that translate the same original words.
   */
  toOriginal?: number[][]
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
  /** The chapter's introduction note (markdown), when the notes have one. */
  intro?: string
  /** The book's introduction note, kept with its first chapter. */
  bookIntro?: string
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

const files = import.meta.glob<PrototypeData>('./data/*.json', { eager: true, import: 'default' })

/** The chapters the prototype has: by book, by chapter number. */
export const CHAPTERS: Record<string, Record<number, PrototypeData>> = {}
for (const data of Object.values(files)) (CHAPTERS[data.book.id] ??= {})[data.chapter] = data

/** A chapter of a book, when the prototype has it. */
export const chapterOf = (book: string, chapter: number): PrototypeData | null => CHAPTERS[book]?.[chapter] ?? null

/** The chapter numbers the prototype has of a book, in order. */
export const chaptersOf = (book: string): number[] =>
  Object.keys(CHAPTERS[book] ?? {})
    .map(Number)
    .sort((a, b) => a - b)
