/**
 * Reading what a pack left on the device: which resources there are and their books, a chapter of a text as verses,
 * and the notes of a verse with the words of the text each note is about. Everything comes from rows already built
 * (prepared views and aligned quotes), so reading needs no parsing and no network.
 */

import { resourceContentStamp } from '@bt-synergy/resource-catalog'
import { unwrapVersioned } from '@bt-synergy/resource-pipeline/cache/versionedEnvelope'
import { HELPS_ALIGN_VERSION, type CachedAlignments } from '@bt-synergy/resource-pipeline/helps/helpsAlignCache'
import { NOTES_PREPARE_VERSION, type NotesLightChapter } from '@bt-synergy/resource-pipeline/notes/notesPreparer'
import { preparedUnitKey } from '@bt-synergy/resource-pipeline/prepare/prepareKeys'
import {
  SCRIPTURE_PREPARE_VERSION,
  type ScriptureLightChapter,
  type ScriptureNavRecord,
} from '@bt-synergy/resource-pipeline/scripture/scripturePreparer'
import type { ResourceStores } from './store'

export type ResourceKind =
  | 'scripture'
  | 'original'
  | 'notes'
  | 'questions'
  | 'word-links'
  | 'academy'
  | 'words'
  | 'obs'
  | 'obs-helps'
  | 'other'

export interface ResourceOnDevice {
  key: string
  title: string
  language: string
  kind: ResourceKind
  /** `{tag}#{published_at}` of the release on the device. */
  stamp: string
  /** Books with rows on the device, lowercase, in Bible order. Empty for resources not kept by book. */
  books: string[]
}

const KIND_BY_SUBJECT: Record<string, ResourceKind> = {
  Bible: 'scripture',
  'Aligned Bible': 'scripture',
  'Greek New Testament': 'original',
  'Hebrew Old Testament': 'original',
  'TSV Translation Notes': 'notes',
  'TSV Translation Questions': 'questions',
  'TSV Translation Words Links': 'word-links',
  'Translation Academy': 'academy',
  'Translation Words': 'words',
  'Open Bible Stories': 'obs',
}

function kindOf(subject: unknown): ResourceKind {
  const s = String(subject ?? '')
  return KIND_BY_SUBJECT[s] ?? (/OBS/i.test(s) ? 'obs-helps' : 'other')
}

/** Source rows are keyed by book right after the resource key: `tn:{key}:{book}…`. */
const BOOK_ROW_PREFIXES = ['scripture-usj:', 'tn:', 'tq:', 'twl:'] as const

const BIBLE_ORDER = [
  'gen', 'exo', 'lev', 'num', 'deu', 'jos', 'jdg', 'rut', '1sa', '2sa', '1ki', '2ki', '1ch', '2ch', 'ezr', 'neh',
  'est', 'job', 'psa', 'pro', 'ecc', 'sng', 'isa', 'jer', 'lam', 'ezk', 'dan', 'hos', 'jol', 'amo', 'oba', 'jon',
  'mic', 'nam', 'hab', 'zep', 'hag', 'zec', 'mal', 'mat', 'mrk', 'luk', 'jhn', 'act', 'rom', '1co', '2co', 'gal',
  'eph', 'php', 'col', '1th', '2th', '1ti', '2ti', 'tit', 'phm', 'heb', 'jas', '1pe', '2pe', '1jn', '2jn', '3jn',
  'jud', 'rev',
]

export function inBibleOrder(books: Iterable<string>): string[] {
  const rank = (b: string) => {
    const i = BIBLE_ORDER.indexOf(b)
    return i < 0 ? BIBLE_ORDER.length : i
  }
  return [...new Set(books)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
}

async function booksWithRows(stores: ResourceStores, key: string): Promise<string[]> {
  const books = new Set<string>()
  for (const prefix of BOOK_ROW_PREFIXES) {
    const head = `${prefix}${key}:`
    for (const row of await stores.cache.getByPrefix(head)) {
      const book = row.key.slice(head.length).split(':')[0]?.toLowerCase()
      if (book) books.add(book)
    }
  }
  return inBibleOrder(books)
}

/** Every resource in the device's catalog, with the books it has. */
export async function resourcesOnDevice(stores: ResourceStores): Promise<ResourceOnDevice[]> {
  const out: ResourceOnDevice[] = []
  for (const key of await stores.catalog.getAll()) {
    const meta = await stores.catalog.get(key)
    if (!meta) continue
    out.push({
      key,
      title: String(meta.title ?? key),
      language: String(meta.language ?? key.split('/')[1] ?? ''),
      kind: kindOf(meta.subject),
      stamp: resourceContentStamp(meta),
      books: await booksWithRows(stores, key),
    })
  }
  return out.sort((a, b) => a.key.localeCompare(b.key))
}

export interface BookOnDevice {
  book: string
  name: string
  chapters: Array<{ number: number; verseCount: number }>
}

/**
 * The book's name as the text itself gives it: `\toc2` (its short name), else `\h`. The header rows sit in the book's
 * chapter 0 of the source. tc-study's own `bookName` is the book code («TIT»), and `\h` is sometimes left untranslated
 * (es-419 GST Titus says «Titus»), so `\toc2` comes first.
 */
async function bookNameInText(stores: ResourceStores, textKey: string, book: string): Promise<string | null> {
  const [row] = await stores.cache.getByPrefix(`scripture-usj:${textKey}:${book}:0`)
  const raw = row ? JSON.stringify(row.entry) : ''
  const find = (marker: string) => raw.match(new RegExp(`"marker":"${marker}","content":\\["([^"]+)"`))?.[1]?.trim()
  return find('toc2') ?? find('h') ?? null
}

/**
 * The books of a text that can be read, with their chapters. The chapters come from the prepared chapters on the
 * device, not from the prepared table of chapters: tc-study's warm jobs rewrite that table chapter by chapter, and it
 * keeps only the last one.
 */
export async function booksOfText(stores: ResourceStores, textKey: string): Promise<BookOnDevice[]> {
  const prefix = `prepared:scripture:${textKey}:`
  const byBook = new Map<string, Map<number, number>>()
  const navName = new Map<string, string>()
  for (const row of await stores.cache.getByPrefix(prefix)) {
    const [book, unit, tier] = row.key.slice(prefix.length).split(':')
    if (unit === 'nav') {
      const nav = unwrapVersioned<ScriptureNavRecord>(row.entry, SCRIPTURE_PREPARE_VERSION)
      if (nav) navName.set(book, nav.bookName)
      continue
    }
    if (tier !== 'light') continue
    const light = unwrapVersioned<ScriptureLightChapter>(row.entry, SCRIPTURE_PREPARE_VERSION)
    if (!light) continue
    const verses = new Set(light.blocks.flatMap((b) => b.inline.filter((i) => i.kind === 'verse').map((i) => (i as { verseNumber: number }).verseNumber)))
    const chapters = byBook.get(book) ?? new Map<number, number>()
    chapters.set(Number(unit), verses.size)
    byBook.set(book, chapters)
  }
  const books: BookOnDevice[] = []
  for (const book of inBibleOrder(byBook.keys())) {
    const chapters = [...byBook.get(book)!.entries()].sort((a, b) => a[0] - b[0]).map(([number, verseCount]) => ({ number, verseCount }))
    const name = (await bookNameInText(stores, textKey, book)) ?? navName.get(book) ?? book.toUpperCase()
    books.push({ book, name, chapters })
  }
  return books
}

export type ChapterPiece = { kind: 'heading'; text: string } | { kind: 'paragraph'; verses: Array<{ verse: number; text: string }> }

/** A chapter as headings and paragraphs of verses, or null when the device does not have it. */
export async function readChapter(
  stores: ResourceStores,
  textKey: string,
  book: string,
  chapter: number
): Promise<ChapterPiece[] | null> {
  const entry = await stores.cache.get(preparedUnitKey('scripture', textKey, book, chapter, 'light'))
  const light = unwrapVersioned<ScriptureLightChapter>(entry, SCRIPTURE_PREPARE_VERSION)
  if (!light) return null
  const pieces: ChapterPiece[] = []
  for (const block of light.blocks) {
    let paragraph: Extract<ChapterPiece, { kind: 'paragraph' }> | null = null
    for (const item of block.inline) {
      if (item.kind === 'heading') {
        pieces.push({ kind: 'heading', text: item.text.trim() })
        paragraph = null
      } else if (item.kind === 'verse') {
        if (!paragraph) {
          paragraph = { kind: 'paragraph', verses: [] }
          pieces.push(paragraph)
        }
        paragraph.verses.push({ verse: item.verseNumber, text: '' })
      } else if (item.kind === 'text' && paragraph?.verses.length) {
        paragraph.verses[paragraph.verses.length - 1].text += item.text
      }
    }
  }
  for (const piece of pieces) {
    if (piece.kind === 'paragraph') for (const v of piece.verses) v.text = v.text.replace(/\s+/g, ' ').trim()
  }
  return pieces.filter((p) => p.kind === 'heading' || p.verses.length > 0)
}

export interface VerseNote {
  id: string
  reference: string
  /** The words of the original the note is about. */
  quote: string
  /** The same words in the text being read, when the pack carried the alignment. */
  textQuote: string | null
  /** The note, in markdown. */
  note: string
  /** The `rc:` link to the Translation Academy article (`…/ta/man/translate/…`), when there is one. */
  supportReference: string
}

/** Whether a note reference (`1:3`, `1:3-5`, `1:intro`) covers this verse. */
export function referenceCovers(reference: string, chapter: number, verse: number): boolean {
  const [ch, vs] = reference.split(':')
  if (Number(ch) !== chapter || !vs) return false
  const [from, to] = vs.split('-').map(Number)
  if (!Number.isFinite(from)) return false
  return verse >= from && verse <= (Number.isFinite(to) ? to : from)
}

/**
 * The aligned quotes of a notes resource for one chapter of a text: note id → the text's words. Read by prefix, not by
 * key, so it does not need the original's stamp, and raw, so a row past its cache lifetime is still read.
 */
async function alignedQuotes(
  stores: ResourceStores,
  notesKey: string,
  notesStamp: string,
  textKey: string,
  book: string,
  chapter: number
): Promise<CachedAlignments> {
  const out: CachedAlignments = {}
  const tail = `:${book.toLowerCase()}:${chapter}`
  for (const row of await stores.cache.getByPrefix(`helps-align:${notesKey}@${notesStamp}:`)) {
    if (!row.key.endsWith(tail) || row.key.split(':')[3]?.split('@')[0] !== textKey) continue
    Object.assign(out, unwrapVersioned<CachedAlignments>(row.entry, HELPS_ALIGN_VERSION) ?? {})
  }
  return out
}

/**
 * The words of an aligned quote as they stand in the text, in the text's order, with «…» where words of the text that
 * are not part of it lie between them. A row keeps each word's position in the chapter, so the gaps are known: Titus
 * 1:1 in es-419 marks «de … que es … acuerdo con la piedad» (positions 20, 23, 24, 26…).
 */
export function textQuoteOf(row: { p: number[]; m: number; t?: string[] } | undefined): string | null {
  if (!row || row.m === 0 || !row.t?.length) return null
  if (row.p.length !== row.t.length) return row.t.join(' ')
  const words = row.p.map((position, i) => ({ position, word: row.t![i] })).sort((a, b) => a.position - b.position)
  return words.map((w, i) => (i > 0 && w.position > words[i - 1].position + 1 ? `… ${w.word}` : w.word)).join(' ')
}

/** The notes of a verse, in the order of the notes resource, each with its words in `textKey` when known. */
export async function notesOfVerse(
  stores: ResourceStores,
  args: { notesKey: string; textKey: string; book: string; chapter: number; verse: number }
): Promise<VerseNote[]> {
  const { notesKey, textKey, book, chapter, verse } = args
  const entry = await stores.cache.get(preparedUnitKey('notes', notesKey, book, chapter, 'light'))
  const light = unwrapVersioned<NotesLightChapter>(entry, NOTES_PREPARE_VERSION)
  if (!light) return []
  const notesStamp = resourceContentStamp(await stores.catalog.get(notesKey))
  const aligned = await alignedQuotes(stores, notesKey, notesStamp, textKey, book, chapter)
  return light.notes
    .filter((n) => !n.isIntro && referenceCovers(n.reference, chapter, verse))
    .map((n) => {
      return {
        id: n.id,
        reference: n.reference,
        quote: n.quote,
        textQuote: textQuoteOf(aligned[n.id]),
        note: n.note,
        supportReference: n.supportReference,
      }
    })
}
