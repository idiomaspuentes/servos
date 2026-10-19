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
  type FullInline,
  type ScriptureFullChapter,
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

export function kindOf(subject: unknown): ResourceKind {
  const s = String(subject ?? '')
  return KIND_BY_SUBJECT[s] ?? (/OBS/i.test(s) ? 'obs-helps' : 'other')
}

/** Source rows are keyed by book right after the resource key: `tn:{key}:{book}…`. */
const BOOK_ROW_PREFIXES = ['scripture-usj:', 'tn:', 'tq:', 'twl:'] as const

export const BIBLE_ORDER = [
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

/** A line of a verse as the text has it: its paragraph marker (`p`, `q1`, `q2`…) and its words. */
export interface VerseLine {
  marker: string
  text: string
}

/**
 * A chapter as its verses, each in the lines the text gives it: a prose verse is one line; a verse of a poem has one
 * line per `\q`. Headings are not part of any verse. This is the shape the editor writes in, line by line, and the
 * shape a translated verse takes when it is saved (Taller, `docs/PLATAFORMA.md`, «Un versículo es sus renglones»).
 */
export async function readChapterLines(
  stores: ResourceStores,
  textKey: string,
  book: string,
  chapter: number
): Promise<Record<number, VerseLine[]> | null> {
  const entry = await stores.cache.get(preparedUnitKey('scripture', textKey, book, chapter, 'light'))
  const light = unwrapVersioned<ScriptureLightChapter>(entry, SCRIPTURE_PREPARE_VERSION)
  if (!light) return null
  return versesInLines(light.blocks)
}

export function versesInLines(blocks: ScriptureLightChapter['blocks']): Record<number, VerseLine[]> {
  const verses: Record<number, VerseLine[]> = {}
  let current: number | null = null
  for (const block of blocks) {
    let lineOpen = false
    for (const item of block.inline) {
      if (item.kind === 'heading') {
        current = null
      } else if (item.kind === 'verse') {
        current = item.verseNumber
        verses[current] = [{ marker: block.marker, text: '' }]
        lineOpen = true
      } else if (item.kind === 'text' && current !== null) {
        if (!lineOpen) {
          verses[current].push({ marker: block.marker, text: '' })
          lineOpen = true
        }
        verses[current][verses[current].length - 1].text += item.text
      }
    }
  }
  for (const lines of Object.values(verses)) {
    for (const line of lines) line.text = line.text.replace(/\s+/g, ' ').trim()
    while (lines.length > 1 && !lines[lines.length - 1].text) lines.pop()
  }
  return verses
}

/** A piece of a line: a word of the text (its place among the chapter's words) or what stands between words. */
export interface WordPiece {
  text: string
  word?: number
}

export interface WordLine {
  marker: string
  pieces: WordPiece[]
}

export interface ChapterWords {
  /** Each verse in its lines, as `readChapterLines` gives them, its words told apart. */
  lines: Record<number, WordLine[]>
  /**
   * The chapter's words in order: the place of each is what aligned helps keep (`helps-align` rows), so a touched word
   * finds its notes. `own` is its match key (`jon 2:2:קראתי:1`), `originals` the original words it translates.
   */
  words: Array<{ verse: number; own: string; originals: string[] }>
  /** The notes the text gives after a word, by the word's place: the Hebrew's qere after its ketiv («Q יַ֣עַשׂ»). */
  notes?: Record<number, string>
}

/** A chapter of a text in lines of words, from the full prepared tier (null when the device lacks it). */
export async function readChapterWords(stores: ResourceStores, textKey: string, book: string, chapter: number): Promise<ChapterWords | null> {
  const entry = await stores.cache.get(preparedUnitKey('scripture', textKey, book, chapter, 'full'))
  const full = unwrapVersioned<ScriptureFullChapter>(entry, SCRIPTURE_PREPARE_VERSION)
  return full ? wordsInLines(full) : null
}

/**
 * tc-study's rule for the space before a word (`shouldInsertSpaceBeforeInline`), but no space after what opens (`¿`,
 * `«`, a quote mark after a space) nor after a Hebrew maqaf, which binds two words: tc-study writes «¿ Qué» and
 * «אֶל־ יְהוָה».
 */
function spaceBefore(prev: FullInline | undefined): boolean {
  if (!prev) return false
  if (prev.kind === 'text' || prev.kind === 'heading') return !/\s$/.test(prev.text) && !/[¿¡(\[«“‘־]$|(^|\s)["']$/.test(prev.text)
  if (prev.kind === 'token') return !prev.token.c.endsWith('־')
  return prev.kind === 'verse' || prev.kind === 'note' || prev.kind === 'xref'
}

/**
 * The words are numbered as tc-study numbers them for the aligned helps (`extractPreparedBroadcastTokens`): every word
 * of the chapter in order, a word before the first verse marker counted in the block's verse. What stands before the
 * first verse is not shown in a verse (the chapter's label, «Capítulo 2»), but a psalm's title (`\d`) is.
 */
export function wordsInLines(full: ScriptureFullChapter): ChapterWords {
  const lines: Record<number, WordLine[]> = {}
  const words: ChapterWords['words'] = []
  const notes: Record<number, string> = {}
  let verse = 0
  // The word a note that follows it is about: the last one of its verse.
  let last: number | null = null
  for (const block of full.blocks) {
    let current: WordLine | null = null
    const blockVerse = block.verseNumbers[0] ?? 0
    const open = (v: number) => {
      current = { marker: block.marker, pieces: [] }
      ;(lines[v] ??= []).push(current)
    }
    block.inline.forEach((item, i) => {
      if (item.kind === 'heading') {
        current = null
      } else if (item.kind === 'verse') {
        verse = item.verseNumber
        last = null
        open(verse)
      } else if (item.kind === 'note' && last !== null && item.text.trim()) {
        notes[last] = notes[last] ? `${notes[last]} ${item.text.trim()}` : item.text.trim()
      } else if (item.kind === 'text' || item.kind === 'token') {
        const v = verse > 0 ? verse : blockVerse > 0 ? blockVerse : 1
        const shown = verse > 0 || block.marker === 'd'
        if (!current && shown) open(v)
        const line = (current as WordLine | null) ?? { marker: block.marker, pieces: [] }
        if (item.kind === 'text') {
          line.pieces.push({ text: item.text })
        } else {
          if (spaceBefore(block.inline[i - 1])) line.pieces.push({ text: ' ' })
          line.pieces.push({ text: item.token.c, word: words.length })
          last = words.length
          words.push({
            verse: v,
            own: full.matchKeys[item.token.k] ?? '',
            originals: (item.token.a ?? []).map((k) => full.matchKeys[k]).filter((k): k is string => typeof k === 'string'),
          })
        }
      }
    })
  }
  for (const verseLines of Object.values(lines)) {
    for (const line of verseLines) {
      // Spaces at the ends of a line are not part of it, as in `versesInLines`.
      const { pieces } = line
      while (pieces.length && pieces[0].word === undefined && !pieces[0].text.trim()) pieces.shift()
      while (pieces.length && pieces[pieces.length - 1].word === undefined && !pieces[pieces.length - 1].text.trim()) pieces.pop()
      if (pieces.length && pieces[0].word === undefined) pieces[0] = { text: pieces[0].text.trimStart() }
      const last = pieces.length - 1
      if (last >= 0 && pieces[last].word === undefined) pieces[last] = { text: pieces[last].text.trimEnd() }
    }
    while (verseLines.length > 1 && !verseLines[verseLines.length - 1].pieces.length) verseLines.pop()
  }
  return Object.keys(notes).length ? { lines, words, notes } : { lines, words }
}

/**
 * Where each aligned help of a chapter stands in a text: help id → the places of its words (`ChapterWords.words`).
 * The same rows as `notesOfVerse` reads; translation words links are aligned the same way.
 */
export async function alignedPlaces(stores: ResourceStores, helpsKey: string, textKey: string, book: string, chapter: number): Promise<Record<string, number[]>> {
  const stamp = resourceContentStamp(await stores.catalog.get(helpsKey))
  const rows = await alignedQuotes(stores, helpsKey, stamp, textKey, book, chapter)
  return Object.fromEntries(Object.entries(rows).filter(([, row]) => row.m !== 0 && row.p.length).map(([id, row]) => [id, row.p]))
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

/** What a word of the original is, for a glossary: its dictionary form and its Strong number (`H7121`, `c:H6419`). */
export interface OriginalWord {
  lemma: string
  strong: string
  /** Its grammar, as the text gives it (`He,C:Vqw3ms`): what `describeMorph` puts in plain words. */
  morph: string
}

export interface OriginalWords {
  words: OriginalWord[]
  /**
   * The words of each verse that stand in notes (the Hebrew's qere, after its ketiv), numbered as MACULA numbers a
   * verse's words: from 1, those of notes included.
   */
  inNotes: Record<number, number[]>
}

/**
 * The lemma and Strong number of each word of a chapter of the original, by the word's place (as `readChapterWords`
 * numbers them). They are on the `\w` markers of the stored USJ outside notes, one a word in the same order; null when
 * the device lacks the chapter or the counts differ (then the places would not match).
 */
export async function originalWordsOf(stores: ResourceStores, textKey: string, book: string, chapter: number): Promise<OriginalWords | null> {
  type Node = { type?: string; number?: string; marker?: string; content?: Array<Node | string>; lemma?: string; strong?: string; 'x-morph'?: string }
  const row = (await stores.cache.get(`scripture-usj:${textKey}:${book.toLowerCase()}:${chapter}`)) as { content?: { usj?: Node } } | null
  const usj = row?.content?.usj
  const words = await readChapterWords(stores, textKey, book, chapter)
  if (!usj || !words) return null
  const found: OriginalWord[] = []
  const inNotes: Record<number, number[]> = {}
  let verse = 0
  let counted = 0
  const walk = (node: Node | string, inNote: boolean) => {
    if (typeof node === 'string') return
    if (node.type === 'verse') {
      verse = Number(node.number) || verse
      counted = 0
    }
    if (node.marker === 'w') {
      counted++
      // A note's words are not the text's: the Hebrew's qere stands in a footnote after its ketiv (Ruth 1:8), and the
      // chapter's words leave it out (bt-synergy's usj-processor 2.3.0). MACULA counts it.
      if (inNote) (inNotes[verse] ??= []).push(counted)
      else found.push({ lemma: node.lemma ?? '', strong: node.strong ?? '', morph: node['x-morph'] ?? '' })
    }
    for (const child of node.content ?? []) walk(child, inNote || node.type === 'note')
  }
  walk(usj, false)
  return found.length === words.words.length ? { words: found, inNotes } : null
}

/** The introductions a chapter of notes opens with: the book's, then the chapter's. */
export interface ChapterIntros {
  book: string | null
  chapter: string | null
}

/**
 * The introduction notes of a chapter, in markdown. tc-study keeps them in the chapter's notes marked `isIntro`, with
 * their reference rewritten to the first verse, so the book's (`front:intro`) and chapter 1's (`1:intro`) look alike:
 * in chapter 1 the book's comes first. A lone one in chapter 1 is the chapter's when its heading names the chapter
 * («# Jonás 1 Notas generales»), else the book's («# Introducción a Jonás»).
 */
export async function introsOf(stores: ResourceStores, notesKey: string, book: string, chapter: number): Promise<ChapterIntros> {
  const entry = await stores.cache.get(preparedUnitKey('notes', notesKey, book, chapter, 'light'))
  const light = unwrapVersioned<NotesLightChapter>(entry, NOTES_PREPARE_VERSION)
  const intros = (light?.notes ?? []).filter((n) => n.isIntro && n.note.trim()).map((n) => n.note)
  if (chapter !== 1) return { book: null, chapter: intros[0] ?? null }
  if (intros.length >= 2) return { book: intros[0], chapter: intros[1] }
  const only = intros[0] ?? null
  // Its heading: the first line, the notes keeping their line ends as written `\n` or as real ones.
  const heading = only?.trimStart().split(/\\n|\n/)[0] ?? ''
  const namesChapter = heading.startsWith('#') && new RegExp(`\\b${chapter}\\b`).test(heading)
  return namesChapter ? { book: null, chapter: only } : { book: only, chapter: null }
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

/** A verse's helps as they stand: its notes and its literal and simple bridge texts (to compare, helpsChanges.ts). */
export interface VerseHelps {
  chapter: number
  verse: number
  notes: Array<{ id: string; quote: string; note: string }>
  literal: string
  simple: string
}

/** The helps of these verses of a book, as this device has them now: what a newer pack may change. */
export async function readVerseHelps(
  stores: ResourceStores,
  sources: { literal: string; simple?: string; notes?: string },
  book: string,
  places: ReadonlyArray<{ chapter: number; verse: number }>
): Promise<VerseHelps[]> {
  const out: VerseHelps[] = []
  const chapters = new Map<string, Record<number, VerseLine[]> | null>()
  const textOf = async (key: string | undefined, chapter: number, verse: number) => {
    if (!key) return ''
    const at = `${key}:${chapter}`
    if (!chapters.has(at)) chapters.set(at, await readChapterLines(stores, key, book, chapter))
    return (chapters.get(at)?.[verse] ?? []).map((l) => l.text).join(' ')
  }
  for (const { chapter, verse } of places) {
    const notes = sources.notes ? await notesOfVerse(stores, { notesKey: sources.notes, textKey: sources.literal, book, chapter, verse }) : []
    out.push({
      chapter,
      verse,
      notes: notes.map((n) => ({ id: n.id, quote: n.quote, note: n.note })),
      literal: await textOf(sources.literal, chapter, verse),
      simple: await textOf(sources.simple, chapter, verse),
    })
  }
  return out
}
