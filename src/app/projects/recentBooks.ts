/**
 * The books of a project opened last on this device, newest first: what home lists under the moss field, so that a
 * project with many books (a New Testament has 27) keeps its glossary and settings close (asked by Abel, October 2026).
 * Kept by the project's id (`forget.ts` forgets it with the project).
 */

/** How many of the other books home lists before «See the N books». */
export const HOME_BOOKS = 3
/** At most this many are kept: more than home ever lists. */
const KEPT = 12

const key = (projectId: string) => `servos.prototipo.recientes.${projectId}`

export function recentBooksOf(projectId: string): string[] {
  try {
    const kept = JSON.parse(localStorage.getItem(key(projectId)) ?? '[]') as unknown
    return Array.isArray(kept) ? kept.filter((b): b is string => typeof b === 'string') : []
  } catch {
    return []
  }
}

/** Keeps that the book was opened now. */
export function noteRecentBook(projectId: string, book: string): void {
  const next = [book, ...recentBooksOf(projectId).filter((b) => b !== book)].slice(0, KEPT)
  try {
    localStorage.setItem(key(projectId), JSON.stringify(next))
  } catch {
    /* fine for this visit */
  }
}

/**
 * The other books home lists, and whether it lists all of them: those opened last first, then the rest in the
 * project's order. Hiding one or two books behind a row would save nothing, so then they are all listed.
 */
export function homeBooks(others: string[], recent: string[], shown = HOME_BOOKS): { listed: string[]; all: boolean } {
  const opened = recent.filter((b) => others.includes(b))
  const ordered = [...opened, ...others.filter((b) => !opened.includes(b))]
  return ordered.length <= shown + 2 ? { listed: ordered, all: true } : { listed: ordered.slice(0, shown), all: false }
}
