/**
 * The pure part of choosing what to download for a language (spec §3): which units its projects need, which originals
 * list every language plans from, and what each answer of the Worker means for the person. Nothing here fetches,
 * reads a store or keeps state; `onlineResources.ts` does that around it.
 */

import { planParts, type PartsList, type PartsPlan, type Register } from '@bt-synergy/language-pack'
import type { ListAnswer } from './packsClient'

/** What stops a language's texts and helps from coming: codes the interface translates (`enLinea.*`). */
export type Blocked = 'preparando' | 'actualizarApp' | 'noDisponible' | 'sinIdioma' | 'sinEspacio'

/** A language's list as kept on the device (`servos.enLinea.listas`): for a 304, and for planning without internet. */
export type KeptList = {
  etag: string | null
  list: PartsList
  /** When this list's content was fetched (ISO): a 304 does not change it. */
  at: string
  /** The originals list it names, once fetched. */
  originals?: { sha256: string; list: PartsList }
}

export const SHARED = 'shared'
export const bookUnitOf = (book: string) => `book ${book.toLowerCase()}`

/** The books of a set of units (`book tit` → `tit`), in their order. */
export const booksOfUnits = (units: Iterable<string>): string[] =>
  [...units].filter((u) => u.startsWith('book ')).map((u) => u.slice('book '.length))

type ProjectLike = { helpsLanguage: string; books: Array<{ code: string }> }

/** The helps languages of the projects, once each, in the projects' order. */
export function languagesOf(projects: readonly ProjectLike[]): string[] {
  return [...new Set(projects.map((p) => p.helpsLanguage).filter(Boolean))]
}

/** The units a language's projects need: the shared unit, and every book of every project that reads in it. */
export function unitsOf(projects: readonly ProjectLike[], language: string): string[] {
  const units = new Set<string>([SHARED])
  for (const p of projects) if (p.helpsLanguage === language) for (const b of p.books) units.add(bookUnitOf(b.code))
  return [...units]
}

/**
 * The originals list every language plans from: the one named by the most recently fetched of these languages'
 * lists. Planned from an older one, a language would put older originals back over newer ones, and the next language
 * the newer ones again (B's spec §2, "Originals between languages"). Null when none of them names one.
 */
export function newestOriginals(
  kept: Readonly<Record<string, KeptList | undefined>>,
  languages: readonly string[],
): { sha256: string; path: string; from: string } | null {
  let best: { sha256: string; path: string; from: string; at: number } | null = null
  for (const language of languages) {
    const k = kept[language]
    const ref = k?.list.originals
    if (!k || !ref) continue
    const at = Date.parse(k.at)
    // Equal times (fetched in the same check): the later language in the projects' order.
    if (!best || !(at < best.at)) best = { ...ref, from: language, at: Number.isFinite(at) ? at : -Infinity }
  }
  return best && { sha256: best.sha256, path: best.path, from: best.from }
}

/** The originals list with this sha256 among the kept ones, whichever language fetched it. */
export function keptOriginals(kept: Readonly<Record<string, KeptList | undefined>>, sha256: string): PartsList | null {
  for (const k of Object.values(kept)) if (k?.originals?.sha256 === sha256) return k.originals.list
  return null
}

/**
 * A language's plan for some units. Its list's originals are always the shared newest ones, never its own when they
 * differ; a list that names originals cannot be planned without them (null). A list that names none plans alone.
 */
export function planLanguage(input: {
  list: PartsList
  originals: PartsList | null
  register: Register
  chosen: string[]
}): PartsPlan | null {
  if (input.list.originals && !input.originals) return null
  return planParts({
    list: input.list,
    originals: input.list.originals ? input.originals! : undefined,
    register: input.register,
    chosen: input.chosen,
  })
}

/** Whether a language's list names any part of a book (else that book cannot be downloaded in it). */
export const listHasBook = (list: PartsList, book: string): boolean =>
  list.parts.some((p) => p.book === book.toLowerCase())

/** What a list answer that is not a list means: what to tell the person, and when to ask again (seconds). */
export function blockedByList(answer: Exclude<ListAnswer, { kind: 'listo' } | { kind: 'igual' }>): {
  blocked: Blocked
  retryAfter?: number
} {
  switch (answer.kind) {
    case 'preparando':
      return { blocked: 'preparando', retryAfter: answer.retryAfter }
    case 'noDisponible':
      return { blocked: 'noDisponible', retryAfter: answer.retryAfter }
    // Too many requests: to the person it is the same as not available now; it is tried again after the wait.
    case 'espera':
      return { blocked: 'noDisponible', retryAfter: answer.retryAfter }
    case 'actualizarApp':
      return { blocked: 'actualizarApp' }
    case 'sinIdioma':
      return { blocked: 'sinIdioma' }
  }
}
