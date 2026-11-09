/**
 * Reading the helps of the verses already translated, around the opening of a newer pack (helpsChanges.ts): which
 * projects read their books in the pack's language, their written verses, and each verse's notes and bridge texts.
 * A replaced resource's rows are written over, so what it said is read before the pack is opened.
 */

import { readVerseHelps, type VerseHelps } from '../../resources/reading'
import type { ResourceStores } from '../../resources/store'
import { readerV3 } from '../../resources/v3/client'
import { verseHelpsV3 } from '../../resources/v3/helpsV3'
import { compareHelps, keepChanges, type VerseChange } from './helpsChanges'
import { availabilityOf } from './library'
import { loadProjects } from './model'
import { inProject } from './scope'
import { writtenVerses } from './work'

type Place = { chapter: number; verse: number }

/** The verses of a book of the project the app is in that have text, each verse of a join on its own. */
export function translatedPlaces(book: string): Place[] {
  return writtenVerses(book)
    .filter((w) => w.text.trim())
    .flatMap((w) => Array.from({ length: (w.joinedTo ?? w.verse) - w.verse + 1 }, (_, i) => ({ chapter: w.chapter, verse: w.verse + i })))
}

/** A project's book whose translated verses' helps were read before a pack was opened. */
export interface Watched {
  project: string
  book: string
  places: Place[]
  before: VerseHelps[]
}

/** How a book's helps are read for some verses; null when the book cannot be read that way here. */
type ReadHelps = (book: string, places: Place[]) => Promise<VerseHelps[] | null>

const fromRows = (stores: ResourceStores, language: string): ReadHelps => async (book, places) => {
  const sources = availabilityOf(book, language)?.sources
  return sources ? readVerseHelps(stores, sources, book, places) : null
}

/**
 * From the language's format 3 book (`verseHelpsV3`), read with a fresh reader each time it is asked: null for a book
 * not installed there. Notes are compared in format 3's own form on both sides.
 */
const fromV3 = async (language: string): Promise<ReadHelps> => {
  const reader = await readerV3(language).catch(() => null)
  return async (book, places) =>
    reader?.installed(`book:${book.toLowerCase()}`) ? verseHelpsV3(reader, language, book.toLowerCase(), places) : null
}

async function watchWith(read: ReadHelps, language: string, books: readonly string[]): Promise<Watched[]> {
  const brought = new Set(books.map((b) => b.toLowerCase()))
  const out: Watched[] = []
  for (const p of loadProjects()) {
    if (p.helpsLanguage !== language) continue
    for (const { code } of p.books) {
      if (!brought.has(code.toLowerCase())) continue
      const places = inProject(p.id, () => translatedPlaces(code))
      if (!places.length) continue
      const before = await read(code, places)
      if (before) out.push({ project: p.id, book: code, places, before })
    }
  }
  return out
}

async function keepWith(read: ReadHelps, watched: readonly Watched[], at: string): Promise<BookChanges[]> {
  const out: BookChanges[] = []
  for (const w of watched) {
    const after = await read(w.book, w.places)
    if (!after) continue
    const changes = compareHelps(w.before, after, at)
    if (!changes.length) continue
    inProject(w.project, () => keepChanges(w.book, changes))
    out.push({ project: w.project, book: w.book, changes })
  }
  return out
}

/**
 * Before a pack is opened: the helps of the translated verses of each project that reads its books in the pack's
 * language, for the books the pack brings.
 */
export function watchHelps(stores: ResourceStores, language: string, books: readonly string[]): Promise<Watched[]> {
  return watchWith(fromRows(stores, language), language, books)
}

/** What changed in a project's book. */
export interface BookChanges {
  project: string
  book: string
  changes: VerseChange[]
}

/**
 * After the pack was opened (and the library read this device again): the same verses read again and compared, and
 * what changed kept for each project's book. Only the books where something changed are returned.
 */
export function keepHelpsChanges(stores: ResourceStores, language: string, watched: readonly Watched[], at = new Date().toISOString()): Promise<BookChanges[]> {
  return keepWith(fromRows(stores, language), watched, at)
}

/**
 * Format 3: before an install, the helps of the translated verses of the books installed in format 3 now. A book not
 * there yet is not watched (its rows' notes are in another form, so comparing them would show changes that are not).
 */
export async function watchHelpsV3(language: string, books: readonly string[]): Promise<Watched[]> {
  return watchWith(await fromV3(language), language, books)
}

/** Format 3: after the install and `refreshLibrary` (which forgets the old readers), what changed, kept. */
export async function keepHelpsChangesV3(language: string, watched: readonly Watched[], at = new Date().toISOString()): Promise<BookChanges[]> {
  if (!watched.length) return []
  return keepWith(await fromV3(language), watched, at)
}
