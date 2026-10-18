/**
 * The projects' books, read from what the language packs left on this device (design §7): when the app opens, what
 * each language has here, from keys alone; then each project's books, in the background, chapter by chapter, into the
 * chapters the screens read (`chapterOf`), with the lexicon entries of their words and what MACULA says of them. A
 * book opened first is read first. The example's Titus and Jonah are bundled and need nothing.
 *
 * What is read stays in memory while the app is open: a team works on a few books at a time.
 */

import { strongParts, type LexiconFile } from '../../lexicon/lexicon'
import { EXAMPLE_LANGUAGE, forgetBooks, isBundled, keepBook, keepLexicon, setLanguageResolver, type PrototypeData } from '../../prototype/data'
import { keepMacula } from '../../prototype/original'
import { readLexiconEntry, readMacula } from '../../resources/companions'
import { booksOfText } from '../../resources/reading'
import { chapterData } from '../../resources/screenData'
import { sectionStartsOf } from '../../resources/sections'
import { availability, deviceIndex, type Availability, type DeviceIndex } from '../../resources/sources'
import { openResourceStores, type ResourceStores } from '../../resources/store'
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
    index = await deviceIndex(stores)
  } catch {
    // A browser without IndexedDB (a private window, a page inside another): the example only.
    index = { resources: [] }
  }
  changed()
  void readAll()
}

/** After a pack was opened: what is on this device again, and its books read anew. */
export async function refreshLibrary(): Promise<void> {
  if (!stores) stores = openResourceStores()
  index = await deviceIndex(stores)
  forgetBooks()
  states.clear()
  loads.clear()
  changed()
  void readAll()
}

async function readAll() {
  for (const p of projects) for (const b of p.books) await loadBook(b.code, p.helpsLanguage).catch(() => {})
}

/** Whether a resource (a text, the originals, articles) is on this device. */
export const onDevice = (key: string): boolean => Boolean(index?.resources.some((r) => r.key === key && (r.books.length > 0 || r.articles)))

/** What this device has of a book in a language, and why not, when it can tell. */
export const availabilityOf = (book: string, language: string): Availability | null => (index ? availability(index, language, book) : null)

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
    if (sources.lexicon) {
      const wanted = new Map<string, number>()
      for (const c of chapters)
        for (const w of c.texts.find((t) => t.original)?.words ?? []) for (const part of strongParts(w.strong)) wanted.set(`${part.kind}:${part.number}`, part.number)
      const entries: Record<string, LexiconFile> = {}
      for (const [k, number] of wanted) {
        const entry = await readLexiconEntry(stores, sources.lexicon, number)
        if (entry) entries[k] = entry
      }
      keepLexicon(language, entries)
    }
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
