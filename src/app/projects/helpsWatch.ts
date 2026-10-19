/**
 * Reading the helps of the verses already translated, around the opening of a newer pack (helpsChanges.ts): which
 * projects read their books in the pack's language, their written verses, and each verse's notes and bridge texts.
 * A replaced resource's rows are written over, so what it said is read before the pack is opened.
 */

import { readVerseHelps, type VerseHelps } from '../../resources/reading'
import type { ResourceStores } from '../../resources/store'
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

/**
 * Before a pack is opened: the helps of the translated verses of each project that reads its books in the pack's
 * language, for the books the pack brings.
 */
export async function watchHelps(stores: ResourceStores, language: string, books: readonly string[]): Promise<Watched[]> {
  const brought = new Set(books.map((b) => b.toLowerCase()))
  const out: Watched[] = []
  for (const p of loadProjects()) {
    if (p.helpsLanguage !== language) continue
    for (const { code } of p.books) {
      if (!brought.has(code.toLowerCase())) continue
      const sources = availabilityOf(code, language)?.sources
      const places = inProject(p.id, () => translatedPlaces(code))
      if (!sources || !places.length) continue
      out.push({ project: p.id, book: code, places, before: await readVerseHelps(stores, sources, code, places) })
    }
  }
  return out
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
export async function keepHelpsChanges(stores: ResourceStores, language: string, watched: readonly Watched[], at = new Date().toISOString()): Promise<BookChanges[]> {
  const out: BookChanges[] = []
  for (const w of watched) {
    const sources = availabilityOf(w.book, language)?.sources
    if (!sources) continue
    const changes = compareHelps(w.before, await readVerseHelps(stores, sources, w.book, w.places), at)
    if (!changes.length) continue
    inProject(w.project, () => keepChanges(w.book, changes))
    out.push({ project: w.project, book: w.book, changes })
  }
  return out
}
