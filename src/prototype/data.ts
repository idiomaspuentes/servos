/**
 * The chapters the screens read, in the shape they need (`PrototypeData`), and the lexicon of the original's words.
 *
 * Two sources, the device first: what the language packs left on this device, read and registered here book by book
 * when a book opens (`src/resources/library.ts`), and the example's Titus and Jonah in es-419, bundled in the app
 * (taken from real packs by `makeData.test.ts`). Both are kept by the project's helps language, so two projects that
 * translate the same book with different helps do not read each other's.
 */

import { strongParts, type LexiconFile } from '../lexicon/lexicon'
import type { ChapterPiece, WordLine } from '../resources/reading'
import lexicon from './data/lexicon.json'

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
  /** For the original, each word's lemma and Strong number, by the word's place: what a glossary entry hangs from. */
  words?: Array<{ lemma: string; strong: string; morph?: string }>
  /**
   * For the original, the words of each verse that stand in notes and are not shown (the Hebrew's qere, after its
   * ketiv), numbered as MACULA numbers a verse's words: from 1, those of notes included (`maculaPlace`).
   */
  inNotes?: Record<number, number[]>
  /**
   * For the original, the notes it gives after a word, by the word's place: the Hebrew's qere after its ketiv
   * («Q יַ֣עַשׂ»), another possible reading («Or perhaps …»), a word on the manuscripts. In English, as the text has them.
   */
  wordNotes?: Record<number, string>
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
   * translationCore 4 work by. The bridge texts do not mark them, so they come from unfoldingWord's ULT.
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

/** The example's language: its bundled books and lexicon are es-419's. */
export const EXAMPLE_LANGUAGE = 'es-419'

const files = import.meta.glob<PrototypeData>('./data/*-*.json', { eager: true, import: 'default' })

/** The example's chapters, bundled: by book, by chapter number. */
const BUNDLED: Record<string, Record<number, PrototypeData>> = {}
for (const data of Object.values(files)) (BUNDLED[data.book.id] ??= {})[data.chapter] = data

/** Chapters read from this device, by `{language}:{book}`, then by chapter number. */
const DEVICE = new Map<string, Record<number, PrototypeData>>()
/** Lexicon entries read from this device, by `{language}:{kind}:{number}`. */
const DEVICE_LEXICON = new Map<string, LexiconFile>()

/** The helps language of the project the app is in (the library says it; the example's until it does). */
let languageNow: () => string = () => EXAMPLE_LANGUAGE
export const setLanguageResolver = (resolve: () => string) => {
  languageNow = resolve
}

/** Keeps a book's chapters read from this device, for its language: they are read before the example's. */
export function keepBook(language: string, book: string, chapters: PrototypeData[]) {
  DEVICE.set(`${language}:${book}`, Object.fromEntries(chapters.map((c) => [c.chapter, c])))
}

/** Forgets the books read from this device (a pack was opened again: they are read anew). */
export function forgetBooks() {
  DEVICE.clear()
}

/** Keeps lexicon entries read from this device, by Strong number (`hebrew:7121`). */
export function keepLexicon(language: string, entries: Record<string, LexiconFile>) {
  for (const [key, file] of Object.entries(entries)) DEVICE_LEXICON.set(`${language}:${key}`, file)
}

const chaptersByBook = (book: string, language = languageNow()): Record<number, PrototypeData> | undefined =>
  DEVICE.get(`${language}:${book}`) ?? (language === EXAMPLE_LANGUAGE ? BUNDLED[book] : undefined)

/** Whether the example bundled in the app has the book (es-419's Titus and Jonah). */
export const isBundled = (book: string) => Boolean(BUNDLED[book])

/** A chapter of a book, when this device (or the example) has it. */
export const chapterOf = (book: string, chapter: number): PrototypeData | null => chaptersByBook(book)?.[chapter] ?? null

/**
 * The lexicon entry of a word of the original, by its Strong number (`c:H7121`, `G23160`), in the project's helps
 * language: from this device's lexicon (the language pack carries it), else the example's (Taller's lexicons on
 * Door43, the entries of Titus's and Jonah's words, `makeLexicon.test.ts`).
 */
export function lexiconOf(strong: string): { file: LexiconFile; kind: 'greek' | 'hebrew'; number: number; letter: string } | null {
  const part = strongParts(strong)[0]
  if (!part) return null
  const language = languageNow()
  const file =
    DEVICE_LEXICON.get(`${language}:${part.kind}:${part.number}`) ??
    (language === EXAMPLE_LANGUAGE ? (lexicon as Record<string, LexiconFile>)[`${part.kind}:${part.number}`] : undefined)
  return file ? { file, ...part } : null
}

/** The chapter numbers this device (or the example) has of a book, in order. */
export const chaptersOf = (book: string): number[] =>
  Object.keys(chaptersByBook(book) ?? {})
    .map(Number)
    .sort((a, b) => a - b)
