/**
 * Servos online (spec §2–§4): the texts and helps a project needs come from the translation-helps Worker by parts, and
 * are kept up to date, without getting in the way of whoever translates.
 *
 * - At startup (`startOnline`), B's heal first: each language's current plan is applied as it is, which applies only
 *   when every part of it is staged and otherwise heals the catalog and receipts alone. Then a check, if online.
 * - A check (`checkForUpdates`) asks only for the lists (with their ETag), at most every three hours unless forced,
 *   and never before a wait the Worker asked for (`servos.enLinea.reintentar`). It finishes a download the person
 *   asked for and that was cut, and offers what is new, with its size.
 * - A download (`downloadBook`, `downloadOffer`) goes into staging, then is applied once nobody is typing:
 *   `watchHelps` → `applyParts` → `refreshLibrary` → `keepHelpsChanges`, as when a pack is received.
 *
 * One run (a check or a download) at a time: a second call joins the running one, or waits for it. Every language
 * plans its originals from the newest originals list on the device (`planLanguage.ts`). The state lives in this
 * module (as `packsInside`), read by the screens through `useOnlineResources`. Everything outside is injectable
 * (`setOnlineDeps`), so the tests need neither network nor DOM. Nothing here throws to its caller.
 */

import { useSyncExternalStore } from 'react'
import {
  PARTS_FORMAT_VERSION,
  applyParts as realApplyParts,
  compatKeyOf,
  packTargetFrom,
  unitOfPart,
  unitOfSlotId,
  type ApplyInput,
  type ApplyResult,
  type PackVersions,
  type PartsList,
  type PartsPlan,
  type PartsStaging,
  type Register,
} from '@bt-synergy/language-pack'
import { isOnline as realIsOnline, whenNotTyping as realWhenNotTyping } from '../../app/frame/online'
import { keepHelpsChanges as realKeepHelpsChanges, watchHelps as realWatchHelps, type BookChanges, type Watched } from '../../app/projects/helpsWatch'
import { bookIsHere as realBookIsHere, refreshLibrary as realRefreshLibrary } from '../../app/projects/library'
import type { Project } from '../../app/projects/model'
import { RESOURCE_VERSIONS, openPartsStaging, openResourceStores, readPartsRegister, type ResourceStores } from '../store'
import { downloadParts, type Progress } from './downloads'
import { fetchList, fetchOriginals, fetchPart, type ClientOptions } from './packsClient'
import { packsServer } from './packsServer'
import {
  SHARED,
  blockedByList,
  bookUnitOf,
  booksOfUnits,
  keptOriginals,
  languagesOf,
  listHasBook,
  newestOriginals,
  planLanguage,
  unitsOf,
  type Blocked,
  type KeptList,
} from './planLanguage'

export type { Blocked } from './planLanguage'

/** How long after a check the next one asks for the lists again. */
export const RECHECK_MS = 3 * 60 * 60 * 1000

export type OnlineState = {
  /** The Home card: what is new for a language, its bytes, and its list's code («Ahora no» remembers it). */
  offer: { language: string; bytes: number; code: string } | null
  /** A download running, until it is applied. */
  busy: { language: string; books: string[]; progress: Progress } | null
  /** Why a language's texts and helps cannot come now (codes the interface translates). */
  blocked: Record<string, Blocked>
  /** The line that goes away: what was applied changed this many translated verses. */
  done: { language: string; changedVerses: number } | null
}

type WakeLock = { release(): Promise<void> }
type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void }

/** Everything the flow reaches outside itself. */
export type OnlineDeps = {
  fetch?: typeof fetch
  server: () => string
  compat: () => string
  stores: () => ResourceStores
  staging: () => PartsStaging
  storage: StorageLike | null
  now: () => number
  isOnline: () => boolean
  whenNotTyping: (run: () => void) => () => void
  /** `navigator.storage.estimate`; null where there is none (then the free-space check is skipped). */
  estimate: (() => Promise<{ quota?: number; usage?: number }>) | null
  wakeLock: () => Promise<WakeLock | null>
  /** Whether a book can be opened in a language: on the device (from parts or whole packs), or bundled. */
  bookIsHere: (book: string, language: string) => boolean
  refreshLibrary: () => Promise<void>
  watchHelps: (stores: ResourceStores, language: string, books: readonly string[]) => Promise<Watched[]>
  keepHelpsChanges: (stores: ResourceStores, language: string, watched: readonly Watched[]) => Promise<BookChanges[]>
  applyParts: (input: ApplyInput) => Promise<ApplyResult>
  versions: PackVersions
}

const KEYS = {
  buscado: 'servos.enLinea.buscado',
  reintentar: 'servos.enLinea.reintentar',
  ahoraNo: 'servos.enLinea.ahoraNo',
  listas: 'servos.enLinea.listas',
} as const

let openedStores: ResourceStores | null = null
let openedStaging: PartsStaging | null = null

function defaults(): OnlineDeps {
  const nav = typeof navigator === 'undefined' ? undefined : (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLock> } })
  let storage: StorageLike | null = null
  try {
    storage = globalThis.localStorage ?? null
  } catch {
    /* blocked storage: what is kept lasts this visit */
  }
  return {
    server: () => packsServer(),
    compat: () => compatKeyOf(PARTS_FORMAT_VERSION, RESOURCE_VERSIONS),
    stores: () => (openedStores ??= openResourceStores()),
    staging: () => (openedStaging ??= openPartsStaging()),
    storage,
    now: () => Date.now(),
    isOnline: realIsOnline,
    whenNotTyping: realWhenNotTyping,
    estimate: nav?.storage?.estimate ? () => nav.storage.estimate() : null,
    wakeLock: async () => (nav?.wakeLock ? nav.wakeLock.request('screen') : null),
    bookIsHere: realBookIsHere,
    refreshLibrary: realRefreshLibrary,
    watchHelps: realWatchHelps,
    keepHelpsChanges: realKeepHelpsChanges,
    applyParts: realApplyParts,
    versions: RESOURCE_VERSIONS,
  }
}

let deps: OnlineDeps | null = null
const d = (): OnlineDeps => (deps ??= defaults())

// ---------------------------------------------------------------------------------------------------------------
// What is kept on the device: lists (for 304s and planning offline), waits, «Ahora no», the last check.

type Memory = {
  listas: Record<string, KeptList>
  reintentar: Record<string, string>
  ahoraNo: Record<string, string>
  buscado: string | null
}
let memory: Memory | null = null

function readObject(key: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(d().storage?.getItem(key) ?? 'null')
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}
const strings = (o: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(Object.entries(o).filter((e): e is [string, string] => typeof e[1] === 'string'))
const isKept = (v: unknown): v is KeptList => {
  const k = v as Partial<KeptList> | null
  return !!k && typeof k === 'object' && typeof k.at === 'string' && !!k.list && k.list.schema === 2 && Array.isArray(k.list.parts)
}

function mem(): Memory {
  if (memory) return memory
  let buscado: string | null = null
  try {
    buscado = d().storage?.getItem(KEYS.buscado) ?? null
  } catch {
    /* as never checked */
  }
  memory = {
    listas: Object.fromEntries(Object.entries(readObject(KEYS.listas)).filter((e): e is [string, KeptList] => isKept(e[1]))),
    reintentar: strings(readObject(KEYS.reintentar)),
    ahoraNo: strings(readObject(KEYS.ahoraNo)),
    buscado,
  }
  return memory
}

/** Kept for the next times when it can be; for this visit in any case. */
function save(key: keyof typeof KEYS) {
  try {
    const value = mem()[key]
    if (value !== null) d().storage?.setItem(KEYS[key], typeof value === 'string' ? value : JSON.stringify(value))
  } catch {
    /* a full or blocked storage: kept in memory for this visit */
  }
}

/**
 * A language's kept list, when it is of this app's compat: one kept by an earlier version of the app names parts
 * this one cannot read (its catalog folder), and is neither planned from nor sent as an ETag.
 */
function kept(language: string): KeptList | undefined {
  const k = mem().listas[language]
  return k && k.list.compat === d().compat() ? k : undefined
}

/** Every kept list of this app's compat, by language. */
function keptLists(): Record<string, KeptList> {
  const compat = d().compat()
  return Object.fromEntries(Object.entries(mem().listas).filter(([, k]) => k.list.compat === compat))
}

/** The wait the originals route asked for, kept beside the languages' (`servos.enLinea.reintentar`). */
const ORIGINALS_WAIT = 'originals'

const iso = (ms: number) => new Date(ms).toISOString()
const waiting = (language: string) => {
  const until = Date.parse(mem().reintentar[language] ?? '')
  return Number.isFinite(until) && until > d().now()
}
function retryLater(language: string, seconds: number) {
  mem().reintentar[language] = iso(d().now() + seconds * 1000)
  save('reintentar')
}
function noWait(language: string) {
  if (!(language in mem().reintentar)) return
  delete mem().reintentar[language]
  save('reintentar')
}

// ---------------------------------------------------------------------------------------------------------------
// The state the screens read.

const EMPTY: OnlineState = { offer: null, busy: null, blocked: {}, done: null }
let state: OnlineState = EMPTY
const listeners = new Set<(s: OnlineState) => void>()

function set(patch: Partial<OnlineState>) {
  state = { ...state, ...patch }
  for (const fn of listeners) {
    try {
      fn(state)
    } catch {
      /* a listener's own trouble */
    }
  }
}

function setBlocked(language: string, why: Blocked | null) {
  if ((state.blocked[language] ?? null) === why) return
  const blocked = { ...state.blocked }
  if (why) blocked[language] = why
  else delete blocked[language]
  set({ blocked })
}

/** Refusals only a fresh answer of the list lifts: until then, nothing of that language is planned. */
const listBlocked = (language: string) => {
  const b = state.blocked[language]
  return b === 'preparando' || b === 'actualizarApp' || b === 'sinIdioma'
}

export const onlineState = (): OnlineState => state

/** Told whenever the state changes. */
export function onOnline(fn: (s: OnlineState) => void): () => void {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

const subscribe = (fn: () => void) => onOnline(() => fn())
export const useOnlineResources = (): OnlineState => useSyncExternalStore(subscribe, onlineState)

/** The projects whose books are planned (their helps languages); set at startup and whenever they change. */
let projects: Project[] = []
export function setOnlineProjects(next: Project[]) {
  projects = next
  showOffer()
}

/** What is new for each language (and the units it covers), offered one at a time in the projects' order. */
const offers = new Map<string, { bytes: number; code: string; units: string[] }>()

function showOffer() {
  const declined = mem().ahoraNo
  for (const language of languagesOf(projects)) {
    const o = offers.get(language)
    if (o && declined[language] !== o.code) {
      const current = state.offer
      if (current?.language !== language || current.bytes !== o.bytes || current.code !== o.code) {
        set({ offer: { language, bytes: o.bytes, code: o.code } })
      }
      return
    }
  }
  if (state.offer) set({ offer: null })
}

/** «Ahora no»: the offer goes away until its language's list has another code. */
export function declineOffer(): void {
  const offer = state.offer
  if (!offer) return
  mem().ahoraNo[offer.language] = offer.code
  save('ahoraNo')
  showOffer()
}

/** The line that goes away, gone. */
export function clearDone(): void {
  if (state.done) set({ done: null })
}

/** Units the person asked for, by language, until they are applied (a cut download goes on at the next check). */
const wanted = new Map<string, Set<string>>()
function want(language: string, units: Iterable<string>) {
  const set = wanted.get(language) ?? new Set<string>()
  for (const u of units) set.add(u)
  wanted.set(language, set)
}
function served(language: string, units: Iterable<string>) {
  const set = wanted.get(language)
  if (!set) return
  for (const u of units) set.delete(u)
  if (!set.size) wanted.delete(language)
}

// ---------------------------------------------------------------------------------------------------------------
// Runs: one at a time.

type Ctx = {
  signal: AbortSignal
  /** An originals list the Worker did not have made its language list be asked again (once per run). */
  originalsRetried: boolean
  /** Languages whose list was asked again for a part the Worker no longer has (once per run each). */
  replanned: Set<string>
  /** Languages refused in this run: nothing more is asked or planned for them. */
  stopped: Set<string>
}
const newCtx = (signal: AbortSignal): Ctx => ({ signal, originalsRetried: false, replanned: new Set(), stopped: new Set() })

type Run = { kind: 'check' | 'download' | 'size'; language?: string; units?: Set<string>; ctrl: AbortController; promise: Promise<void>; generation: number }
let current: Run | null = null
let generation = 0

function startRun(kind: Run['kind'], body: (ctx: Ctx) => Promise<void>, about: { language?: string; units?: Set<string> } = {}): Promise<void> {
  const ctrl = new AbortController()
  const run: Run = { kind, ...about, ctrl, generation, promise: Promise.resolve() }
  run.promise = (async () => {
    try {
      await body(newCtx(ctrl.signal))
    } catch {
      // Never to the caller: what failed is tried again at the next check.
    } finally {
      if (current === run) current = null
      if (run.generation === generation && state.busy) set({ busy: null })
    }
  })()
  current = run
  return run.promise
}

/** Ends the run in flight: requests stop, nothing more is applied. */
export function stopOnline(): void {
  current?.ctrl.abort()
}

/** Replaces what the flow reaches outside itself, and starts from nothing (tests). */
export function setOnlineDeps(over: Partial<OnlineDeps> = {}): void {
  current?.ctrl.abort()
  current = null
  generation++
  deps = { ...defaults(), ...over }
  memory = null
  projects = []
  offers.clear()
  wanted.clear()
  state = EMPTY
  set({})
}

const clientOpts = (ctx: Ctx): ClientOptions => ({ fetch: d().fetch, signal: ctx.signal })

// ---------------------------------------------------------------------------------------------------------------
// The lists.

/** Asks for a language's list (with its ETag unless told not to): `ok` when a list is kept to plan from. */
async function refreshList(language: string, ctx: Ctx, withEtag: boolean): Promise<'ok' | 'blocked' | 'skip'> {
  if (waiting(language) || ctx.signal.aborted) return 'skip'
  const before = kept(language)
  const answer = await fetchList(d().server(), d().compat(), language, withEtag ? before?.etag : null, clientOpts(ctx))
  if (ctx.signal.aborted) return 'skip'
  if (answer.kind === 'listo' || answer.kind === 'igual') {
    if (answer.kind === 'listo') {
      // Its originals list stays kept only if it still names the same one.
      const originals = before?.originals && before.originals.sha256 === answer.list.originals?.sha256 ? before.originals : undefined
      mem().listas[language] = { etag: answer.etag, list: answer.list, at: iso(d().now()), ...(originals ? { originals } : {}) }
      save('listas')
    } else if (!before) return 'skip'
    noWait(language)
    setBlocked(language, null)
    return 'ok'
  }
  const { blocked, retryAfter } = blockedByList(answer)
  if (retryAfter) retryLater(language, retryAfter)
  setBlocked(language, blocked)
  ctx.stopped.add(language)
  return 'blocked'
}

/**
 * The originals list every language plans from: the newest named by any kept list of this compat, whatever its
 * language's state (one refused or waiting now still holds its originals on the device), kept or fetched. When it
 * cannot be had now, null: languages whose lists name originals are not planned in this run, so no plan puts older
 * originals back. A 404 asks its language's list again, once per run (a list naming an originals list that is gone
 * is stale); another 404 is `noDisponible`. A 429 waits its time; a failure waits for the next check.
 */
async function resolveOriginals(ctx: Ctx): Promise<PartsList | null> {
  for (;;) {
    const lists = keptLists()
    const ref = newestOriginals(lists, Object.keys(lists))
    if (!ref) return null
    // The projects' languages that cannot be planned without it.
    const needing = languagesOf(projects).filter((l) => lists[l]?.list.originals)
    const found = keptOriginals(lists, ref.sha256)
    if (found) {
      cleared(needing, ctx)
      return found
    }
    if (ctx.signal.aborted || !d().isOnline() || waiting(ORIGINALS_WAIT)) return null
    const answer = await fetchOriginals(d().server(), d().compat(), ref.sha256, clientOpts(ctx))
    if (ctx.signal.aborted) return null
    const unavailable = () => {
      for (const l of needing) if (!state.blocked[l]) setBlocked(l, 'noDisponible')
    }
    switch (answer.kind) {
      case 'listo': {
        const entry = mem().listas[ref.from]
        if (entry) {
          mem().listas[ref.from] = { ...entry, originals: { sha256: ref.sha256, list: answer.list } }
          save('listas')
        }
        noWait(ORIGINALS_WAIT)
        cleared(needing, ctx)
        return answer.list
      }
      case 'noEstá':
        if (!ctx.originalsRetried) {
          ctx.originalsRetried = true
          if ((await refreshList(ref.from, ctx, false)) === 'ok') continue
          return null
        }
        unavailable()
        return null
      case 'espera':
        retryLater(ORIGINALS_WAIT, answer.retryAfter)
        unavailable()
        return null
      case 'falla':
        unavailable()
        return null
    }
  }
}

/** Once the originals are had, a `noDisponible` they left goes (not one a wait of the language's own still holds). */
function cleared(languages: string[], ctx: Ctx) {
  for (const l of languages) {
    if (state.blocked[l] === 'noDisponible' && !waiting(l) && !ctx.stopped.has(l)) setBlocked(l, null)
  }
}

/** The originals list to plan from without asking anyone (startup). */
function keptNewestOriginals(): PartsList | null {
  const lists = keptLists()
  const ref = newestOriginals(lists, Object.keys(lists))
  return ref ? keptOriginals(lists, ref.sha256) : null
}

type Planned = { plan: PartsPlan; register: Register; list: PartsList; originals?: PartsList; chosen: string[] }

/** A language's plan for some units, from its kept list (of this compat) and the register as it is now. */
async function planFor(language: string, chosen: string[], originals: PartsList | null): Promise<Planned | null> {
  const k = kept(language)
  if (!k) return null
  const register = await readPartsRegister(d().stores())
  const plan = planLanguage({ list: k.list, originals, register, chosen })
  if (!plan) return null
  return { plan, register, list: k.list, chosen, ...(k.list.originals && originals ? { originals } : {}) }
}

/**
 * The units the Home offer covers: the shared unit and the language's project books already on the device (slots
 * of its list, or a book the library can open, whole packs included: spec §3's accepted cost). A book not on the
 * device is not offered; it is downloaded from its own screen (`downloadBook`). None when no book is here.
 */
function offerUnits(language: string, register: Register): string[] {
  const held = new Set<string>()
  for (const [id, record] of register) if (record.list === language) held.add(unitOfSlotId(id))
  const books = unitsOf(projects, language).filter((u) => u !== SHARED)
  const here = books.filter((u) => held.has(u) || d().bookIsHere(u.slice('book '.length), language))
  return here.length ? [SHARED, ...here] : []
}

/** Room for twice the download, when the browser can say (spec §3). */
async function roomFor(bytes: number): Promise<boolean> {
  const estimate = d().estimate
  if (!estimate || bytes <= 0) return true
  try {
    const { quota, usage } = await estimate()
    if (typeof quota !== 'number' || typeof usage !== 'number') return true
    return quota - usage >= 2 * bytes
  } catch {
    return true
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Downloading and applying.

/** Waits until nobody is typing: false when the run was stopped meanwhile. */
function untilNotTyping(signal: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal.aborted) return resolve(false)
    let cancel = () => {}
    const onAbort = () => {
      cancel()
      resolve(false)
    }
    signal.addEventListener('abort', onAbort, { once: true })
    cancel = d().whenNotTyping(() => {
      signal.removeEventListener('abort', onAbort)
      resolve(!signal.aborted)
    })
  })
}

/**
 * Applies a plan once nobody is typing, with the screen kept on: what the translated verses read is watched, the plan
 * applied, the library read again, and what changed kept. `missing` when a part is not staged after all. A list made
 * with other versions says «actualice la app» unless told not to (the startup heal, which asked no one).
 */
async function applyPlan(
  language: string,
  planned: Planned,
  ctx: Ctx,
  { blockOnVersions = true }: { blockOnVersions?: boolean } = {},
): Promise<'applied' | 'missing' | 'stopped'> {
  if (!(await untilNotTyping(ctx.signal))) return 'stopped'
  const lock = await d()
    .wakeLock()
    .catch(() => null)
  try {
    const stores = d().stores()
    const staging = d().staging()
    const { plan } = planned
    const books = booksOfUnits(plan.units)
    // Watched only when the plan will apply: a heal with parts still missing writes no row of these books.
    const ready = (await Promise.all(plan.download.map((p) => staging.has(p.sha256)))).every(Boolean)
    const watched = ready && books.length ? await d().watchHelps(stores, language, books).catch(() => []) : []
    const result = await d().applyParts({
      target: packTargetFrom({ cache: stores.cache, catalog: stores.catalog }),
      staging,
      plan,
      list: planned.list,
      originals: planned.originals,
      register: planned.register,
      chosen: planned.chosen,
      versions: d().versions,
      now: d().now,
    })
    if (result.refused?.reason === 'versions') {
      if (blockOnVersions) setBlocked(language, 'actualizarApp')
      return 'stopped'
    }
    if (result.refused?.reason === 'missing') return 'missing'
    if (result.applied.length) {
      await d()
        .refreshLibrary()
        .catch(() => {})
      const changed = await d()
        .keepHelpsChanges(stores, language, watched)
        .catch((): BookChanges[] => [])
      const verses = changed.reduce((n, c) => n + c.changes.length, 0)
      if (verses && !ctx.signal.aborted) set({ done: { language, changedVerses: verses } })
    }
    if (result.failed.some((f) => f.reason === 'quota')) {
      setBlocked(language, 'sinEspacio')
      return 'stopped'
    }
    // A unit that failed for another reason keeps its parts staged; the next check tries it again.
    if (!result.failed.some((f) => f.scope === 'unit')) served(language, planned.chosen)
    return 'applied'
  } finally {
    try {
      void lock?.release().catch(() => {})
    } catch {
      /* already let go */
    }
  }
}

/**
 * Downloads what the person asked for in a language (`wanted`) into staging, then applies it. A part the Worker no
 * longer has asks for the list again and plans again, once; a part not staged at apply time is downloaded again, once.
 */
async function fetchAndApply(language: string, ctx: Ctx, originalsIn: PartsList | null): Promise<void> {
  let originals = originalsIn
  let missingAgain = false
  for (;;) {
    const units = [...(wanted.get(language) ?? [])]
    if (!units.length || ctx.signal.aborted) return
    const planned = await planFor(language, units, originals)
    if (!planned) return
    const { plan } = planned
    if (!plan.units.length) {
      served(language, units)
      return
    }
    if (!(await roomFor(plan.bytes))) {
      setBlocked(language, 'sinEspacio')
      return
    }
    if (ctx.signal.aborted) return
    setBlocked(language, null)
    const books = booksOfUnits(plan.units)
    const show = (progress: Progress) => {
      if (!ctx.signal.aborted) set({ busy: { language, books, progress } })
    }
    const result = await downloadParts({
      server: d().server(),
      parts: plan.download,
      originals: new Set(planned.originals?.parts.map((p) => p.sha256) ?? []),
      staging: d().staging(),
      onProgress: show,
      fetchPart: (server, sha, opts) => fetchPart(server, sha, { ...opts, fetch: d().fetch }),
      signal: ctx.signal,
    })
    // An abort is the caller's: it ends here, whatever the queue said.
    if (ctx.signal.aborted) return
    switch (result.kind) {
      case 'listaOtraVez':
        if (ctx.replanned.has(language)) {
          setBlocked(language, 'noDisponible')
          return
        }
        ctx.replanned.add(language)
        if ((await refreshList(language, ctx, false)) !== 'ok') return
        originals = await resolveOriginals(ctx)
        continue
      case 'espera':
        retryLater(language, result.retryAfter)
        setBlocked(language, 'noDisponible')
        return
      case 'sinEspacio':
        setBlocked(language, 'sinEspacio')
        return
      case 'falla':
        // A dropped connection: what came is staged, the next check goes on from it.
        return
      case 'listo':
        break
    }
    const applied = await applyPlan(language, planned, ctx)
    if (applied === 'missing' && !missingAgain) {
      missingAgain = true
      continue
    }
    return
  }
}

/** A download the person asked for that a closed app cut: units with parts of the language's own list staged. */
async function wantedFromStaging(languages: string[], originals: PartsList | null) {
  let staged: Set<string> | null = null
  for (const language of languages) {
    if (wanted.has(language) || listBlocked(language)) continue
    const planned = await planFor(language, unitsOf(projects, language), originals)
    if (!planned?.plan.download.length) continue
    // Originals parts are shared: staged for one language, they say nothing of what another was asked for.
    const own = new Set(planned.list.parts.map((p) => p.sha256))
    staged ??= new Set((await d().staging().list()).map((s) => s.sha))
    const units = new Set(planned.plan.download.filter((p) => own.has(p.sha256) && staged!.has(p.sha256)).map((p) => unitOfPart(p)))
    if (units.size) want(language, [SHARED, ...units])
  }
}

/** What is new for a language's books on the device, offered unless it is being downloaded or refused. */
async function updateOffer(language: string, originals: PartsList | null, ctx: Ctx) {
  if (ctx.signal.aborted) return
  let offer: { bytes: number; code: string; units: string[] } | null = null
  if (!wanted.has(language) && !ctx.stopped.has(language) && !listBlocked(language) && kept(language)) {
    const register = await readPartsRegister(d().stores())
    const units = offerUnits(language, register)
    const planned = units.length ? await planFor(language, units, originals) : null
    if (planned?.plan.download.length) offer = { bytes: planned.plan.bytes, code: planned.list.code, units }
  }
  if (ctx.signal.aborted) return
  if (offer) offers.set(language, offer)
  else offers.delete(language)
  showOffer()
}

// ---------------------------------------------------------------------------------------------------------------
// The runs.

/**
 * B's startup heal: each language's current plan applied as it is; nothing is asked of the Worker. A list made with
 * other versions is left to the next check, which asks the Worker before saying «actualice la app».
 */
async function heal(ctx: Ctx) {
  const originals = keptNewestOriginals()
  for (const language of languagesOf(projects)) {
    if (ctx.signal.aborted) return
    const planned = await planFor(language, unitsOf(projects, language), originals)
    if (planned) await applyPlan(language, planned, ctx, { blockOnVersions: false })
  }
}

async function check(force: boolean, ctx: Ctx) {
  if (!d().isOnline()) return
  // The lists are asked for, and what they bring planned, at a pause in the typing (spec §4).
  if (!(await untilNotTyping(ctx.signal))) return
  const languages = languagesOf(projects)
  const last = Date.parse(mem().buscado ?? '')
  if (force || !(d().now() - last < RECHECK_MS)) {
    for (const language of languages) {
      if (ctx.signal.aborted) return
      await refreshList(language, ctx, true)
    }
    if (ctx.signal.aborted) return
    mem().buscado = iso(d().now())
    save('buscado')
  }
  const originals = await resolveOriginals(ctx)
  await wantedFromStaging(languages, originals)
  for (const language of languages) {
    if (ctx.signal.aborted) return
    if (!wanted.has(language) || ctx.stopped.has(language) || waiting(language) || listBlocked(language)) continue
    await fetchAndApply(language, ctx, originals)
  }
  for (const language of languages) await updateOffer(language, originals, ctx)
}

async function download(language: string, ctx: Ctx) {
  if (!d().isOnline()) return
  if ((await refreshList(language, ctx, true)) !== 'ok') return
  const originals = await resolveOriginals(ctx)
  await fetchAndApply(language, ctx, originals)
  await updateOffer(language, originals, ctx)
}

/** A download of a language: joins one running with the same units, else waits for the run in flight. */
async function runDownload(language: string): Promise<void> {
  for (;;) {
    const run = current
    if (!run) break
    const asked = wanted.get(language)
    if (run.kind === 'download' && run.language === language && [...(asked ?? [])].every((u) => run.units?.has(u))) return run.promise
    await run.promise
  }
  return startRun('download', (ctx) => download(language, ctx), { language, units: new Set(wanted.get(language)) })
}

// ---------------------------------------------------------------------------------------------------------------
// What the app calls.

/** At startup, after the library is read: B's heal with each language's current plan, then a check if online. */
export async function startOnline(next: Project[]): Promise<void> {
  projects = next
  while (current) await current.promise
  return startRun('check', async (ctx) => {
    await heal(ctx)
    await check(false, ctx)
  })
}

/**
 * Asks for the lists (every three hours unless forced; never before a wait the Worker asked for; never while the
 * person types). A check or download in flight is joined; a size being worked out is waited for.
 */
export function checkForUpdates(opts: { force?: boolean } = {}): Promise<void> {
  const run = current
  if (run?.kind === 'size') return run.promise.then(() => checkForUpdates(opts))
  if (run) return run.promise
  return startRun('check', (ctx) => check(Boolean(opts.force), ctx))
}

/** The project's book, now: its parts and the shared ones, downloaded and applied. */
export function downloadBook(language: string, book: string): Promise<void> {
  want(language, [SHARED, bookUnitOf(book)])
  return runDownload(language)
}

/** The Home card's «Bajar»: the update of the language's books on the device, and its shared unit. */
export function downloadOffer(): Promise<void> {
  const offer = state.offer
  const units = offer && offers.get(offer.language)?.units
  if (!offer || !units?.length) return Promise.resolve()
  want(offer.language, units)
  offers.delete(offer.language)
  showOffer()
  return runDownload(offer.language)
}

/**
 * What downloading a book would bring now (its parts and the shared ones not on the device), in bytes; null when its
 * language has no list to plan from or names no part of it. Asks for the list when none is kept. A run of its own, so
 * it never asks the Worker or changes the state beside a check or a download: it waits for the one in flight.
 */
export async function bookDownloadSize(language: string, book: string): Promise<number | null> {
  while (current) await current.promise
  let size: number | null = null
  await startRun('size', async (ctx) => {
    if (!kept(language)) {
      if (!d().isOnline() || (await refreshList(language, ctx, true)) !== 'ok') return
    }
    const k = kept(language)
    if (!k || !listHasBook(k.list, book)) return
    const originals = await resolveOriginals(ctx)
    const planned = await planFor(language, [SHARED, bookUnitOf(book)], originals)
    size = planned ? planned.plan.bytes : null
  })
  return size
}
