/**
 * How far a book has gone, counted the same way wherever it is shown (home, the book's screen): a mini app's verses
 * done (`MiniApp.done`), and a step's, all its mini apps that count together. Whole percents, rounded down, so a book
 * with one verse left never says 100 %.
 */

import { chapterOf, chaptersOf, type PrototypeData } from '../../prototype/data'
import type { T } from '../i18n/i18n'
import { BOOK_INTRO, CHAPTER_INTRO, type MiniApp } from '../miniapps/contract'
import { miniApp } from '../miniapps/registry'
import type { Phase, Project } from './model'

export const percent = (done: number, total: number) => (total ? Math.floor((100 * done) / total) : 0)

/** The chapters of a book this device has, with their verses. */
export const chaptersHere = (book: string): PrototypeData[] => chaptersOf(book).map((c) => chapterOf(book, c)!).filter(Boolean)

export const versesOf = (c: PrototypeData) => c.verses.map((v) => v.verse)

/** The verses of a chapter a mini app has done. */
export const doneIn = (app: MiniApp, book: string, c: PrototypeData) => versesOf(c).filter((v) => app.done!({ book, chapter: c.chapter, verse: v })).length

/** The mini apps of a step that count progress. */
export const countedApps = (project: Project, phase: Phase) =>
  project.miniApps[phase].map((id) => miniApp(id)).filter((a): a is MiniApp => Boolean(a && !a.comingSoon && a.done))

/** The first verse of a book a mini app has still to do, in the chapters this device has; none when all is done. */
export function firstUndone(app: MiniApp, book: string): { chapter: number; verse: number } | null {
  if (!app.done) return null
  for (const c of chaptersHere(book)) for (const v of versesOf(c)) if (!app.done({ book, chapter: c.chapter, verse: v })) return { chapter: c.chapter, verse: v }
  return null
}

/** How far a step has gone in a book: the verses done in all its mini apps that count, of all they have to do. */
export function stepPercent(project: Project, book: string, phase: Phase, chapters = chaptersHere(book)): number | null {
  const apps = countedApps(project, phase)
  const total = chapters.reduce((n, c) => n + c.verses.length, 0)
  if (!apps.length || !total) return null
  const done = apps.reduce((n, a) => n + chapters.reduce((m, c) => m + doneIn(a, book, c), 0), 0)
  return percent(done, apps.length * total)
}

/** A place in a book as a person says it: «Jonás 1:6», or the book's or a chapter's introduction. */
export function placeLabel(t: T, name: string, place: { chapter: number; verse: number }): string {
  if (place.verse === BOOK_INTRO) return t('libro.introLibro', { libro: name })
  if (place.verse === CHAPTER_INTRO) return t('libro.introCapitulo', { libro: name, capitulo: place.chapter })
  return `${name} ${place.chapter}:${place.verse}`
}
