/**
 * The projects' books, read from what the language packs left on this device (design §7): when the app opens, what
 * each language has here, from keys alone; then each project's books, in the background, chapter by chapter, into the
 * chapters the screens read (`chapterOf`), with the lexicon entries of their words and what MACULA says of them. A
 * book opened first is read first. The example's Titus and Jonah are bundled and need nothing.
 *
 * What is read stays in memory while the app is open: a team works on a few books at a time.
 *
 * With the staging packs server (`packsFormat() === 3`) a book installed in format 3 is read from there
 * (`readBookV3`), and any other from the rows as before, so a device that switches keeps every book it could read.
 * With today's server the format 3 store is never opened.
 */

import { strongParts, type LexiconFile } from '../../lexicon/lexicon'
import { EXAMPLE_LANGUAGE, forgetBooks, isBundled, keepBook, keepLexicon, setLanguageResolver, type PrototypeData } from '../../prototype/data'
import { keepMacula } from '../../prototype/original'
import { readLexiconEntry, readMacula } from '../../resources/companions'
import { booksOfText, inBibleOrder } from '../../resources/reading'
import { chapterData, type BookSources } from '../../resources/screenData'
import { sectionStartsOf } from '../../resources/sections'
import { availability, deviceIndex, languagesOnDevice, sourcesFor, withFormat3, type Availability, type DeviceIndex, type ResourceHere } from '../../resources/sources'
import { packsFormat } from '../../resources/online/packsServer'
import { catalogResourcesV3, forgetReadersV3, languagesV3, packsV3, readerV3 } from '../../resources/v3/client'
import { readBookV3, sourcesV3 } from '../../resources/v3/bookV3'
import { readArticleV3 } from '../../resources/v3/companionsV3'
import { openResourceStores, type ResourceStores } from '../../resources/store'
import { openingLeft } from '../../resources/packs'
import type { ArticleRef } from '../../resources/articleLinks'
import { resourceContentStamp } from '@bt-synergy/resource-catalog'
import { unwrapVersioned } from '@bt-synergy/resource-pipeline/cache/versionedEnvelope'
import type { Project } from './model'
import { currentProject } from './scope'

/** Where a book stands, for the screens that show it. */
export type BookState =
  /** The example bundled in the app (es-419's Titus and Jonah), and nothing of it on this device. */
  | { state: 'example' }
  /** On this device, being read: chapters read of how many. */
  | { state: 'loading'; done: number; total: number }
  | { state: 'ready' }
  /** Not on this device: what of it is missing, and why (its availability), when the device could be read. */
  | { state: 'missing'; availability: Availability | null }
  | { state: 'error'; message: string }

let stores: ResourceStores | null = null
let index: DeviceIndex | null = null
let projects: Project[] = []
const states = new Map<string, BookState>()
const loads = new Map<string, Promise<void>>()

/** What a language has installed in format 3. */
interface HereV3 {
  /** The books that can be read there (their book and their original installed), with their sources. */
  books: Map<string, BookSources>
  /** Resource titles, by key, from the catalogs (the reader gives none). */
  titles: Map<string, string>
  articles: { tw: boolean; ta: boolean }
  lexicon: boolean
}
/** By language; empty unless `packsFormat()` is 3. */
let v3 = new Map<string, HereV3>()
/** The books each language has in format 3 (read by `readBookV3`; any other by `chapterData`). */
export const v3Books = (): Map<string, Set<string>> => new Map([...v3].map(([lang, here]) => [lang, new Set(here.books.keys())]))

const listeners = new Set<() => void>()
let version = 0
const changed = () => {
  version++
  listeners.forEach((fn) => fn())
}
/** Told when a book is read, or what is on this device changes (`useSyncExternalStore`). */
export const subscribeLibrary = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}
export const libraryVersion = () => version

/** The helps language of a project: its books are read in it. */
export const languageOf = (projectId: string | null): string =>
  projects.find((p) => p.id === projectId)?.helpsLanguage || EXAMPLE_LANGUAGE
setLanguageResolver(() => languageOf(currentProject()))

/** The projects whose books are read (their helps languages). */
export function setProjects(next: Project[]) {
  projects = next
}

/** When the app opens: what is on this device, then every project's books, in the background. */
export async function openLibrary(next: Project[]): Promise<void> {
  setProjects(next)
  try {
    stores = openResourceStores()
    index = await deviceIndex(stores, new Set(openingLeft()?.keys ?? []))
  } catch {
    // A browser without IndexedDB (a private window, a page inside another): the example only.
    index = { resources: [] }
  }
  v3 = await readV3()
  changed()
  void readAll()
}

/** After a pack was opened: what is on this device again, and its books read anew. */
export async function refreshLibrary(): Promise<void> {
  if (!stores) stores = openResourceStores()
  index = await deviceIndex(stores, new Set(openingLeft()?.keys ?? []))
  forgetReadersV3()
  v3 = await readV3()
  forgetBooks()
  states.clear()
  loads.clear()
  changed()
  void readAll()
}

/**
 * What each language has in format 3: the projects' helps languages, those with rows here and those with anything
 * active there. Nothing (and no format 3 store opened) unless the packs server is staging; nothing either when the
 * store cannot be read, so the rows are read as before.
 */
async function readV3(): Promise<Map<string, HereV3>> {
  const out = new Map<string, HereV3>()
  if (packsFormat() !== 3) return out
  try {
    const client = await packsV3()
    const languages = new Set([...projects.map((p) => p.helpsLanguage).filter(Boolean), ...(index ? languagesOnDevice(index) : []), ...(await languagesV3())])
    for (const lang of languages) {
      const status = await client.status(lang)
      if (!status.active) continue
      const reader = await readerV3(lang)
      if (!reader) continue
      const installed = status.units.filter((u) => u.installed).map((u) => u.key.slice(u.key.indexOf('/') + 1))
      const books = new Map<string, BookSources>()
      for (const unit of installed) {
        const book = /^book:(\w+)$/.exec(unit)?.[1]
        if (!book || !reader.installed(unit) || !reader.installed(`orig:${book}`)) continue
        const sources = await sourcesV3(reader, lang, book)
        if (sources) books.set(book, sources)
      }
      out.set(lang, {
        books,
        titles: new Map((await catalogResourcesV3(lang)).map((r) => [r.key, r.title])),
        articles: { tw: installed.some((u) => u.startsWith('art:tw:')), ta: installed.some((u) => u.startsWith('art:ta:')) },
        lexicon: installed.some((u) => u.startsWith('lex:')),
      })
    }
  } catch {
    // The format 3 store could not be read: the rows are read as before.
  }
  return out
}

async function readAll() {
  for (const p of projects) for (const b of p.books) await loadBook(b.code, p.helpsLanguage).catch(() => {})
}

/** What a language has on this device for a project to work with: the parts of its sources, and its books. */
export interface HelpsLanguage {
  code: string
  /** Books its literal bridge text has here. */
  books: string[]
  parts: Array<'literal' | 'simple' | 'notes' | 'questions' | 'words' | 'academy'>
}

/** The languages whose bridge texts are on this device, the one with most books first. */
export function helpsLanguagesHere(): HelpsLanguage[] {
  const here = index
  if (!here) return []
  const withBooks = [...v3].filter(([, h]) => h.books.size > 0).map(([code]) => code)
  return [...new Set([...languagesOnDevice(here), ...withBooks])]
    .map((code): HelpsLanguage => {
      const sources = sourcesFor(here, code)
      const literal = here.resources.find((r) => r.key === sources?.literal)
      const inV3 = v3.get(code)
      const ofV3 = [...(inV3?.books.values() ?? [])]
      const has = (p: HelpsLanguage['parts'][number]) =>
        Boolean(sources?.[p]) || (p === 'words' || p === 'academy' ? Boolean(inV3?.articles[p === 'words' ? 'tw' : 'ta']) : ofV3.some((s) => s[p]))
      const parts = (['literal', 'simple', 'notes', 'questions', 'words', 'academy'] as const).filter(has)
      return { code, books: inBibleOrder(new Set([...(literal?.books ?? []), ...(inV3?.books.keys() ?? [])])), parts: [...parts] }
    })
    .sort((a, b) => b.books.length - a.books.length)
}

/** A book that can be opened in a language: on this device, or the example bundled in the app. */
export function bookIsHere(book: string, language: string): boolean {
  const state = bookState(book, language).state
  return state === 'example' || state === 'loading' || state === 'ready'
}

/** Whether a resource's copy on this device was made for an earlier version of the app (a pack has to replace it). */
export const staleOnDevice = (key: string): boolean => Boolean(index?.resources.some((r) => r.key === key && r.stale))

/** This device's copy of each resource, with its release and books, to compare with a pack's (`freshness.ts`). */
export const copiesOnDevice = (): ResourceHere[] => index?.resources ?? []

/** Whether a resource (a text, the originals, articles) is on this device. */
export const onDevice = (key: string): boolean => Boolean(index?.resources.some((r) => r.key === key && (r.books.length > 0 || r.articles)))

/** What this device has of a book in a language, and why not, when it can tell. */
export function availabilityOf(book: string, language: string): Availability | null {
  const rows = index ? availability(index, language, book) : null
  const inV3 = v3.get(language)
  const sources = inV3?.books.get(book.toLowerCase())
  return inV3 && sources ? withFormat3(rows, sources, { lexicon: inV3.lexicon }) : rows
}

/** Whether this device has a language's word articles or Translation Academy: then any article of them can be read. */
export function articlesOnDevice(kind: ArticleRef['kind'], language = languageOf(currentProject())): boolean {
  if (v3.get(language)?.articles[kind]) return true
  const sources = index ? sourcesFor(index, language) : null
  const key = kind === 'tw' ? sources?.words : sources?.academy
  return Boolean(key && onDevice(key))
}

/**
 * An article of the project's helps language read from this device, for one an article links to and the chapter did
 * not bring (`ArticleSheet`): a word's, with its title, or Translation Academy's, titled by its heading. None when the
 * device does not have it, or for the example bundled in the app.
 */
export async function readArticle(ref: ArticleRef, language = languageOf(currentProject())): Promise<{ title: string; markdown: string } | null> {
  if (v3.get(language)?.articles[ref.kind]) {
    const reader = await readerV3(language).catch(() => null)
    const found = reader ? await readArticleV3(reader, ref) : null
    if (found) return found
  }
  if (!stores || !index) return null
  const sources = sourcesFor(index, language)
  const key = ref.kind === 'tw' ? sources?.words : sources?.academy
  if (!key) return null
  const article = await stores.cache.get(`${key}/${ref.path}`)
  if (typeof article !== 'string' || !article.trim()) return null
  if (ref.kind === 'ta') return { title: article.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? ref.path, markdown: article }
  const stamp = resourceContentStamp(await stores.catalog.get(key))
  const entry = ref.path.replace(/^bible\//, '')
  const title = unwrapVersioned<string>(await stores.cache.get(`helps-text:tw-title:${key}@${stamp}:${entry}`), 1)
  return { title: title ?? entry.split('/').pop()!, markdown: article }
}

/** Where a book stands, in the language of the project the app is in unless said. */
export function bookState(book: string, language = languageOf(currentProject())): BookState {
  const kept = states.get(`${language}:${book}`)
  if (kept) return kept
  const found = availabilityOf(book, language)
  if (found?.here) return { state: 'loading', done: 0, total: 0 }
  if (language === EXAMPLE_LANGUAGE && isBundled(book)) return { state: 'example' }
  return { state: 'missing', availability: found }
}

/**
 * Reads a book from this device: its chapters, the lexicon entries of its original's words, what MACULA says of it.
 * Once a book and language at a time, however many ask; nothing when the device does not have it.
 */
export function loadBook(book: string, language = languageOf(currentProject())): Promise<void> {
  const key = `${language}:${book}`
  const running = loads.get(key)
  if (running) return running
  const run = (async () => {
    if (await readFromV3(book, language, key)) return
    if (!stores || !index) return
    const found = availability(index, language, book)
    if (!found.here || !found.sources) return
    const sources = found.sources
    const outline = (await booksOfText(stores, sources.literal)).find((b) => b.book === book)
    const numbers = outline?.chapters.map((c) => c.number) ?? []
    const total = numbers.length
    states.set(key, { state: 'loading', done: 0, total })
    changed()
    const chapters: PrototypeData[] = []
    for (const [i, chapter] of numbers.entries()) {
      chapters.push(await chapterData(stores, sources, book, chapter, { sections: sectionStartsOf(book, chapter) }))
      states.set(key, { state: 'loading', done: i + 1, total })
      changed()
      // A chapter at a time, so the screen stays answering while a long book is read.
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    if (sources.lexicon) keepLexicon(language, await rowsLexicon(stores, sources.lexicon, chapters))
    if (sources.macula) keepMacula(book, await readMacula(stores, sources.macula, book))
    keepBook(language, book, chapters)
    // A text that names the book and has none of its chapters is the same as not having it.
    states.set(key, chapters.length ? { state: 'ready' } : { state: 'missing', availability: found })
    changed()
  })().catch((error: unknown) => {
    states.set(key, { state: 'error', message: error instanceof Error ? error.message : String(error) })
    loads.delete(key)
    changed()
  })
  loads.set(key, run)
  return run
}

/**
 * Reads a book installed in format 3, as `loadBook` reads one from the rows: its chapters (told a chapter at a time),
 * the lexicon entries of its original's words and what MACULA says of it. False when the language does not have the
 * book there, so the rows are read.
 */
async function readFromV3(book: string, language: string, key: string): Promise<boolean> {
  const inV3 = v3.get(language)
  const code = book.toLowerCase()
  if (!inV3?.books.has(code)) return false
  const reader = await readerV3(language)
  if (!reader) return false
  states.set(key, { state: 'loading', done: 0, total: 0 })
  changed()
  const read = await readBookV3(reader, language, code, {
    sections: (chapter) => sectionStartsOf(book, chapter),
    titles: (k) => inV3.titles.get(k),
    onChapter: (done, total) => {
      states.set(key, { state: 'loading', done, total })
      changed()
    },
  })
  if (!read) return false
  // What format 3 does not have here (a lexicon group not installed, an original bridged without MACULA), the rows
  // give when they have it, so nothing the device showed before is lost by switching.
  const rows = stores && index ? availability(index, language, book).sources : null
  const lexicon = { ...(rows?.lexicon && stores ? await rowsLexicon(stores, rows.lexicon, read.chapters, read.lexicon) : {}), ...read.lexicon }
  keepLexicon(language, lexicon)
  if (read.macula.trees || read.macula.referents) keepMacula(book, read.macula)
  else if (rows?.macula && stores) keepMacula(book, await readMacula(stores, rows.macula, book))
  keepBook(language, book, read.chapters)
  states.set(key, read.chapters.length ? { state: 'ready' } : { state: 'missing', availability: availabilityOf(book, language) })
  changed()
  return true
}

/** The lexicon entries of a book's original words, from the rows of a lexicon, but those already read (`have`). */
async function rowsLexicon(from: ResourceStores, lexicon: string, chapters: PrototypeData[], have: Record<string, LexiconFile> = {}): Promise<Record<string, LexiconFile>> {
  const wanted = new Map<string, number>()
  for (const c of chapters)
    for (const w of c.texts.find((t) => t.original)?.words ?? []) for (const part of strongParts(w.strong)) wanted.set(`${part.kind}:${part.number}`, part.number)
  const entries: Record<string, LexiconFile> = {}
  for (const [k, number] of wanted) {
    if (have[k]) continue
    const entry = await readLexiconEntry(from, lexicon, number)
    if (entry) entries[k] = entry
  }
  return entries
}
