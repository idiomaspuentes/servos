/**
 * The pure part of choosing what to download for a language (spec §3): which units its projects need, which originals
 * list every language plans from, and what each answer of the Worker means for the person. Nothing here fetches,
 * reads a store or keeps state; `onlineResources.ts` does that around it.
 */

import { planParts, slotId, slotOfEntry, unitOfPart, type PartEntry, type PartsList, type PartsPlan, type Register } from '@bt-synergy/language-pack'
import { compareStamps } from '../freshness'
import type { ListAnswer } from './packsClient'

/** What stops a language's texts and helps from coming: codes the interface translates (`enLinea.*`). */
export type Blocked = 'preparando' | 'actualizarApp' | 'noDisponible' | 'sinIdioma' | 'sinEspacio'

/** A language's list as kept on the device (`servos.enLinea.listas`): for a 304, and for planning without internet. */
export type KeptList = {
  etag: string | null
  list: PartsList
  /** When this list's content was fetched (ISO): a 304 does not change it. */
  at: string
  /** The Worker it came from (`packsServer()`): a list of another server is not planned from. */
  server?: string
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
 * The release stamps of the originals a kept list was built on, by resource key: the language list's `stamps` (every
 * resource its build read), and its originals list's own resources when it is kept.
 */
const originalsStampsOf = (k: KeptList): Record<string, string> => ({
  ...(k.list.stamps ?? {}),
  ...Object.fromEntries((k.originals?.list.resources ?? []).map((r) => [r.key, r.stamp])),
})

/**
 * Whether the originals behind `a` are newer (> 0), the same (0) or older (< 0) than those behind `b`, by the release
 * stamps of the resources both name (`keys`, when the originals' keys are known; else every key they share). Null
 * when the stamps cannot tell: one is newer in a resource and older in another, or a stamp cannot be compared.
 */
function compareOriginals(a: Record<string, string>, b: Record<string, string>, keys: ReadonlySet<string> | null): number | null {
  let sign = 0
  for (const key of Object.keys(a)) {
    if (keys && !keys.has(key)) continue
    const sa = a[key]
    const sb = b[key]
    if (!sb) continue
    const c = compareStamps(sa, sb)
    if (c === null) return null
    if (c === 0) continue
    if (sign && Math.sign(c) !== sign) return null
    sign = Math.sign(c)
  }
  return sign
}

/**
 * The originals list every language plans from: the newest named among these languages' lists, by the release
 * stamps of the originals they were built on; when the stamps cannot tell (the same, mixed, or none in common), the
 * list fetched last. Planned from an older one, a language would put older originals back over newer ones, and the
 * next language the newer ones again (B's spec §2, "Originals between languages"). Null when none names one.
 */
export function newestOriginals(
  kept: Readonly<Record<string, KeptList | undefined>>,
  languages: readonly string[],
): { sha256: string; path: string; from: string } | null {
  // The originals' own keys, from any originals list kept: a language's own resources never decide.
  const known = new Set(Object.values(kept).flatMap((k) => (k?.originals?.list.resources ?? []).map((r) => r.key)))
  const keys = known.size ? known : null
  type Candidate = { sha256: string; path: string; from: string; at: number; stamps: Record<string, string> }
  const candidates: Candidate[] = []
  for (const language of languages) {
    const k = kept[language]
    const ref = k?.list.originals
    if (!k || !ref) continue
    const parsed = Date.parse(k.at)
    candidates.push({ ...ref, from: language, at: Number.isFinite(parsed) ? parsed : -Infinity, stamps: originalsStampsOf(k) })
  }
  if (!candidates.length) return null
  // Over all of them, whatever their order: those no other is newer than by its stamps (all of them, should the
  // stamps contradict each other in a circle), then the one fetched last, then the greatest sha256 and language.
  const newerThan = (a: Candidate, b: Candidate) => a.sha256 !== b.sha256 && (compareOriginals(a.stamps, b.stamps, keys) ?? 0) > 0
  const maximal = candidates.filter((c) => !candidates.some((o) => newerThan(o, c)))
  const pool = maximal.length ? maximal : candidates
  const best = pool.reduce((x, y) => {
    if (x.at !== y.at) return y.at > x.at ? y : x
    if (x.sha256 !== y.sha256) return y.sha256 > x.sha256 ? y : x
    return y.from > x.from ? y : x
  })
  return { sha256: best.sha256, path: best.path, from: best.from }
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

/**
 * The chosen units worth planning (spec §3: what a pack left, or forgot the slots of, is downloaded again only «con
 * internet y algo distinto»). A unit is left out when everything its plan would download is already on the device
 * without a slot: every part it needs fills an empty slot (none holds another sha: that is a part of this list on the
 * device, and only the register tells its content), the unit is here (`here`: a book the library opens; the shared
 * unit), and each of those parts' resources has on the device the release the lists name (`deviceStamp`, the
 * catalog row's `resourceContentStamp`, compared with that of the list's row, B's own measure). A book not here, a
 * resource the lists give no row for, or a part of another sha keeps the unit. The rest are left as they are, so
 * their register stays empty, as after a whole pack.
 */
export function unitsWorthPlanning(input: {
  list: PartsList
  originals: PartsList | null
  register: Register
  chosen: string[]
  /** Its whole plan for `chosen`. */
  plan: PartsPlan
  here: (unit: string) => boolean
  deviceStamp: (resource: string) => string
  listStamp: (metadata: unknown) => string
}): string[] {
  const listed = new Map<string, unknown>()
  for (const r of input.list.resources) listed.set(r.key, r.metadata)
  if (input.list.originals) for (const r of input.originals?.resources ?? []) listed.set(r.key, r.metadata)
  const needed = new Map<string, PartEntry[]>()
  for (const p of input.plan.download) {
    const unit = unitOfPart(p)
    needed.set(unit, [...(needed.get(unit) ?? []), p])
  }
  return input.chosen.filter((unit) => {
    const parts = needed.get(unit)
    // Nothing to download (or only slots to remove): planned as it is.
    if (!parts?.length || !input.here(unit)) return true
    return parts.some(
      (p) =>
        input.register.has(slotId(slotOfEntry(p))) ||
        !listed.has(p.resource) ||
        input.deviceStamp(p.resource) !== input.listStamp(listed.get(p.resource)),
    )
  })
}

/** The resources whose device release `unitsWorthPlanning` compares: those of the parts a plan downloads. */
export const resourcesOf = (plan: PartsPlan): string[] => [...new Set(plan.download.map((p) => p.resource))]

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
