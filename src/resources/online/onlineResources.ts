/**
 * Servos online (spec §2–§4): the texts and helps a project needs come from the translation-helps Worker by parts, and
 * are kept up to date, without getting in the way of whoever translates.
 *
 * - At startup (`startOnline`), B's heal first: each language's current plan is applied as it is, which applies only
 *   when every part of it is staged and otherwise heals the catalog and receipts alone. Then a check, if online.
 * - A check (`checkForUpdates`) asks only for the lists (with their ETag), at most every three hours unless forced,
 *   and never before a wait the Worker asked for (`servos.enLinea.reintentar`, kept with the block it leaves, so a
 *   restart inside it still says why); a language whose wait is over is asked at the next check, which `watchOnline`
 *   times. It finishes a download the person asked for and that was cut, and offers what is new, with its size.
 * - A download (`downloadBook`, `downloadOffer`) goes into staging, then is applied once nobody is typing:
 *   `watchHelps` → `applyParts` → `refreshLibrary` → `keepHelpsChanges`, as when a pack is received.
 *
 * - Staging keeps only what a kept list still names (`pruneStaging`), after an apply and at the end of the heal.
 * - The lists are kept in IndexedDB (`keptLists.ts`), read once into memory before the first run reads one and
 *   written through; those of languages no project reads go. localStorage keeps only the small keys.
 * - Per window: the runs, the lock (`onlineLock.ts`) and the lists read into memory are this page's. Two tabs of the
 *   web app (PWA) are not coordinated with each other (accepted, final review M7).
 *
 * One run (a check or a download) at a time: a second call joins the running one, or waits for it. No apply goes
 * beside a pack being opened (`onlineLock.ts`): it waits for the opening, plans again from the register as the pack
 * left it, and an opening waits for an apply; a queue goes on beside an opening (staging is not the store). Every language
 * plans its originals from the newest originals list on the device (`planLanguage.ts`). The state lives in this
 * module (as `packsInside`), read by the screens through `useOnlineResources`. Everything outside is injectable
 * (`setOnlineDeps`), so the tests need neither network nor DOM. Nothing here throws to its caller.
 */

import { useSyncExternalStore } from 'react'
import { resourceContentStamp } from '@bt-synergy/resource-catalog'
import {
  PARTS_FORMAT_VERSION,
  applyParts as realApplyParts,
  sha256Hex,
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
import { indexedDbKeptStore, type KeptStore } from './keptLists'
import { asOnlineApply } from './onlineLock'
import { MAX_RETRY, RETRY, fetchList, fetchOriginals, fetchPart, type ClientOptions } from './packsClient'
import { packsServer, setPacksServer, type PacksServerId } from './packsServer'
import {
  NO_STAMP,
  SHARED,
  blockedByList,
  bookUnitOf,
  resourcesOf,
  unitsWorthPlanning,
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
  /**
   * The Home card: what is new for a language, its bytes, and the key of what it offers (a hash of its parts' shas):
   * «Ahora no» remembers the key, so the same download is not offered again and the next release is.
   */
  offer: { language: string; bytes: number; key: string } | null
  /** A download running, until it is applied. */
  busy: { language: string; books: string[]; progress: Progress } | null
  /** Why a language's texts and helps cannot come now (codes the interface translates). */
  blocked: Record<string, Blocked>
  /** The line that goes away: what was applied changed this many translated verses. */
  done: { language: string; changedVerses: number } | null
  /**
   * Moves whenever what a book's size depends on changes: a list kept or forgotten, an originals list fetched, the
   * projects, the server. A screen that shows a size asks again when it moves.
   */
  version: number
}

/** A book's download size: bytes; null when the kept list names no part of the book; undefined when it cannot be told now. */
export type BookSize = number | null | undefined

type WakeLock = { release(): Promise<void> }
type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem?(key: string): void }

/** Everything the flow reaches outside itself. */
export type OnlineDeps = {
  fetch?: typeof fetch
  server: () => string
  compat: () => string
  stores: () => ResourceStores
  staging: () => PartsStaging
  /** The small keys (waits, «Ahora no», the last check). */
  storage: StorageLike | null
  /** The languages' lists (`keptLists.ts`); null where there is no IndexedDB (then they last this visit). */
  kept: KeptStore | null
  now: () => number
  isOnline: () => boolean
  whenNotTyping: (run: () => void) => () => void
  /**
   * Whether something is being typed now (the apply looks again once it holds the lock). Without it, `whenNotTyping`
   * is asked (it runs at once when nobody types), so the two never disagree.
   */
  isTyping?: () => boolean
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
} as const
/** Where an earlier version kept the lists: moved to IndexedDB once (`loadLists`), then removed. */
const LEGACY_LISTS = 'servos.enLinea.listas'

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
    kept: typeof indexedDB === 'undefined' ? null : indexedDbKeptStore(),
    now: () => Date.now(),
    isOnline: realIsOnline,
    whenNotTyping: (run) => realWhenNotTyping(run),
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
// What is kept on the device: lists (for 304s and planning offline; IndexedDB), waits, «Ahora no», the last check
// (localStorage).

/**
 * A wait the Worker asked for (`Retry-After`), or one set for a «noDisponible» it gave no time for, and the block it
 * leaves meanwhile (rebuilt from it at startup). `by: 'originals'` when the originals list, not the language, could
 * not come: that wait goes as soon as the originals do.
 */
type Wait = { until: string; reason: Blocked | null; by?: 'originals' }

type Memory = {
  listas: Record<string, KeptList>
  reintentar: Record<string, Wait>
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
const BLOCKS: readonly string[] = ['preparando', 'actualizarApp', 'noDisponible', 'sinIdioma', 'sinEspacio']
/** Waits as kept: `{until, reason}`, or an ISO time alone (as an earlier version kept them). */
const waits = (o: Record<string, unknown>): Record<string, Wait> =>
  Object.fromEntries(
    Object.entries(o).flatMap(([key, v]): Array<[string, Wait]> => {
      if (typeof v === 'string') return [[key, { until: v, reason: null }]]
      const w = v as Partial<Wait> | null
      if (!w || typeof w !== 'object' || typeof w.until !== 'string') return []
      const reason = typeof w.reason === 'string' && BLOCKS.includes(w.reason) ? w.reason : null
      return [[key, { until: w.until, reason, ...(w.by === 'originals' ? { by: w.by } : {}) }]]
    }),
  )
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
    // Read from IndexedDB at the start of the first run (`listsReady`).
    listas: {},
    reintentar: waits(readObject(KEYS.reintentar)),
    ahoraNo: strings(readObject(KEYS.ahoraNo)),
    buscado,
  }
  return memory
}

/**
 * The kept lists, read once into memory: every run waits for it before it reads one (the reads are synchronous
 * after). Lists an earlier version kept in localStorage are moved over once, and the key removed when they all were.
 */
let listsLoaded: Promise<void> | null = null
const listsReady = (): Promise<void> => (listsLoaded ??= loadLists())

async function loadLists() {
  const store = d().kept
  let stored: Record<string, unknown> = {}
  try {
    stored = store ? await store.all() : {}
  } catch {
    /* unreadable now: the lists are asked for again */
  }
  const legacy = readObject(LEGACY_LISTS)
  let moved = !!store
  for (const [language, k] of Object.entries(legacy)) {
    if (!isKept(k) || isKept(stored[language])) continue
    stored[language] = k
    try {
      await store?.put(language, k)
    } catch {
      moved = false
    }
  }
  // Without a store to move them to (or when one would not take them), they stay where they are, and are read from
  // there for this visit.
  if (moved) {
    try {
      d().storage?.removeItem?.(LEGACY_LISTS)
    } catch {
      /* removed the next time */
    }
  }
  const m = mem()
  for (const [language, k] of Object.entries(stored)) if (isKept(k) && !(language in m.listas)) m.listas[language] = k
}

/** Writes to the lists' store, one after another (a later write never lands before an earlier one). */
let listWrites: Promise<void> = Promise.resolve()

/** A language's list kept: in memory now, and written through. */
function keepList(language: string, k: KeptList) {
  mem().listas[language] = k
  const store = d().kept
  if (store) listWrites = listWrites.then(() => store.put(language, k)).catch(() => {})
}

/** A language's list forgotten: in memory now, and in the store. */
function forgetList(language: string) {
  delete mem().listas[language]
  const store = d().kept
  if (store) listWrites = listWrites.then(() => store.delete(language)).catch(() => {})
}

/**
 * The lists of languages no project reads go (each weighs some 250 KB): once the lists are read, and never while a
 * run is going (it may be asking for one); the projects as they are then decide.
 */
let dropping: Promise<void> | null = null
function dropUnusedLists(): void {
  dropping ??= (async () => {
    try {
      await listsReady()
      while (current) await current.promise
      const read = new Set(languagesOf(projects))
      for (const language of Object.keys(mem().listas)) if (!read.has(language)) forgetList(language)
    } catch {
      /* dropped the next time */
    } finally {
      dropping = null
    }
  })()
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
 * Whether a kept list can be planned from: of this app's compat (one kept by an earlier version of the app names
 * parts this one cannot read) and from the server in use (one from `?packs=staging` names parts and originals
 * production may not have). Any other is neither planned from nor sent as an ETag.
 */
const usable = (k: KeptList | undefined): k is KeptList => !!k && k.list.compat === d().compat() && k.server === d().server()

function kept(language: string): KeptList | undefined {
  const k = mem().listas[language]
  return usable(k) ? k : undefined
}

/** Every usable kept list, by language. */
function keptLists(): Record<string, KeptList> {
  return Object.fromEntries(Object.entries(mem().listas).filter(([, k]) => usable(k)))
}

/** The usable kept lists of the projects' languages: those that choose the originals, whatever their state. */
function projectLists(): Record<string, KeptList> {
  const lists = keptLists()
  return Object.fromEntries(languagesOf(projects).flatMap((l) => (lists[l] ? [[l, lists[l]]] : [])))
}

/** The wait the originals route asked for, kept beside the languages' (`servos.enLinea.reintentar`). */
const ORIGINALS_WAIT = 'originals'

const iso = (ms: number) => new Date(ms).toISOString()

/**
 * When a key's wait ends, while it holds: null when there is none, it is over, or it ends later than the Worker can ask
 * for (`MAX_RETRY`): a time kept before the clock was set back would otherwise hold for days.
 */
function waitEnd(key: string): number | null {
  const until = Date.parse(mem().reintentar[key]?.until ?? '')
  const now = d().now()
  return Number.isFinite(until) && until > now && until <= now + MAX_RETRY * 1000 ? until : null
}
const waiting = (key: string) => waitEnd(key) !== null
/** A wait was kept for this key and holds no more: its list is asked again at the next check, whatever `RECHECK_MS`. */
const waitOver = (key: string) => key in mem().reintentar && !waiting(key)

/** What waits are told when one is kept or let go (`watchOnline` times the earliest). */
const waitListeners = new Set<() => void>()
function waitsMoved() {
  for (const fn of waitListeners) {
    try {
      fn()
    } catch {
      /* a listener's own trouble */
    }
  }
}

function retryLater(key: string, seconds: number, reason: Blocked | null, by?: 'originals') {
  mem().reintentar[key] = { until: iso(d().now() + seconds * 1000), reason, ...(by ? { by } : {}) }
  save('reintentar')
  waitsMoved()
}
function noWait(key: string) {
  if (!(key in mem().reintentar)) return
  delete mem().reintentar[key]
  save('reintentar')
  waitsMoved()
}

/**
 * «noDisponible» for a language, with a wait (`RETRY.unavailable`) unless one holds already: the timer `watchOnline`
 * keeps then looks again while the app stays in view. Without it, a phone that keeps its connection but gets no data
 * would say «se intentará más tarde» until the person leaves the app.
 */
function unavailableFor(language: string, by?: 'originals') {
  if (!waiting(language)) retryLater(language, RETRY.unavailable, 'noDisponible', by)
  setBlocked(language, 'noDisponible')
}

/** When the earliest wait the Worker asked for ends (a check then asks again), or null when nothing waits. */
export function nextWaitEnd(): number | null {
  let next: number | null = null
  for (const key of Object.keys(mem().reintentar)) {
    const end = waitEnd(key)
    if (end !== null && (next === null || end < next)) next = end
  }
  return next
}

/**
 * What a wait kept from the last visit still blocks says so from the start (the projects set before the first render,
 * then `startOnline`): inside a `parts-off` hour the book shows why, not a «Bajar» that would ask nothing. A block
 * set since is left as it is.
 */
function restoreBlocks() {
  for (const [key, wait] of Object.entries(mem().reintentar)) {
    if (key !== ORIGINALS_WAIT && wait.reason && waiting(key) && !state.blocked[key]) setBlocked(key, wait.reason)
  }
}

/** Told whenever a wait is kept or let go. */
export function onWaits(fn: () => void): () => void {
  waitListeners.add(fn)
  return () => void waitListeners.delete(fn)
}

/** The last check, unless it is in the future (a clock set back): then as never checked. */
function lastCheck(): number {
  const last = Date.parse(mem().buscado ?? '')
  return Number.isFinite(last) && last <= d().now() ? last : -Infinity
}

// ---------------------------------------------------------------------------------------------------------------
// The state the screens read.

const EMPTY: OnlineState = { offer: null, busy: null, blocked: {}, done: null, version: 0 }
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

/** What a book's size depends on changed. */
const moved = () => set({ version: state.version + 1 })

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
  wantedOfProjects()
  restoreBlocks()
  showOffer()
  moved()
  dropUnusedLists()
}

/** What is new for each language (and the units it covers), offered one at a time in the projects' order. */
const offers = new Map<string, { bytes: number; key: string; units: string[] }>()

function showOffer() {
  const declined = mem().ahoraNo
  for (const language of languagesOf(projects)) {
    const o = offers.get(language)
    if (o && declined[language] !== o.key) {
      const current = state.offer
      if (current?.language !== language || current.bytes !== o.bytes || current.key !== o.key) {
        set({ offer: { language, bytes: o.bytes, key: o.key } })
      }
      return
    }
  }
  if (state.offer) set({ offer: null })
}

/**
 * «Ahora no»: the offer goes away until something else is offered for its language. Not the list's `code`: that is the
 * build's (compat and builder code) and stays the same across content releases, so it would silence them for months.
 */
export function declineOffer(): void {
  const offer = state.offer
  if (!offer) return
  mem().ahoraNo[offer.language] = offer.key
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
  for (const u of units) if (!givenUp(language, u)) set.add(u)
  if (set.size) wanted.set(language, set)
}
function served(language: string, units: Iterable<string>) {
  const set = wanted.get(language)
  if (!set) return
  for (const u of units) set.delete(u)
  if (!set.size) wanted.delete(language)
}

/** What is wanted keeps to the projects: a book taken out of them (or a language none reads) is no longer wanted. */
function wantedOfProjects() {
  const languages = new Set(languagesOf(projects))
  for (const [language, set] of wanted) {
    const units = new Set(unitsOf(projects, language))
    for (const u of [...set]) if (!languages.has(language) || !units.has(u)) set.delete(u)
    if (!set.size) wanted.delete(language)
  }
}

/**
 * Units that failed to apply in this session, for a reason other than room (`sinEspacio` says that one), by
 * `language unit`. After three, the unit is no longer wanted, nor wanted again from what it left staged, until the
 * person asks for it again: a part B cannot apply would otherwise be tried at every check.
 */
const failures = new Map<string, number>()
const MAX_FAILURES = 3
const givenUp = (language: string, unit: string) => (failures.get(`${language} ${unit}`) ?? 0) >= MAX_FAILURES
function failedToApply(language: string, units: string[]) {
  for (const u of units) {
    const key = `${language} ${u}`
    failures.set(key, (failures.get(key) ?? 0) + 1)
    if (givenUp(language, u)) served(language, [u])
  }
}
/** Asked for again by the person: tried again, however often it failed. */
function askedAgain(language: string, units: Iterable<string>) {
  for (const u of units) failures.delete(`${language} ${u}`)
}

// ---------------------------------------------------------------------------------------------------------------
// Runs: one at a time.

type Ctx = {
  kind: Run['kind']
  signal: AbortSignal
  /** An originals list the Worker did not have made its language list be asked again (once per run). */
  originalsRetried: boolean
  /** Languages whose list was asked again for a part the Worker no longer has (once per run each). */
  replanned: Set<string>
  /** Languages refused in this run: nothing more is asked or planned for them. */
  stopped: Set<string>
}
const newCtx = (kind: Run['kind'], signal: AbortSignal): Ctx => ({ kind, signal, originalsRetried: false, replanned: new Set(), stopped: new Set() })

type Run = { kind: 'check' | 'download' | 'size'; language?: string; units?: Set<string>; ctrl: AbortController; promise: Promise<void>; generation: number }
let current: Run | null = null
let generation = 0

function startRun(kind: Run['kind'], body: (ctx: Ctx) => Promise<void>, about: { language?: string; units?: Set<string> } = {}): Promise<void> {
  const ctrl = new AbortController()
  const run: Run = { kind, ...about, ctrl, generation, promise: Promise.resolve() }
  run.promise = (async () => {
    try {
      await listsReady()
      await body(newCtx(kind, ctrl.signal))
    } catch (error) {
      // Never to the caller: what failed is tried again at the next check. But said: in the log always, and to the
      // person when a download was going (the book says «No se pueden bajar ahora», not a «Bajar» as if nothing
      // happened). A check that throws stays out of the person's way.
      console.error('[Servos online]', error)
      const language = run.language ?? state.busy?.language
      if (language && run.generation === generation && !ctrl.signal.aborted) unavailableFor(language)
    } finally {
      // What the run kept of the lists is written before it ends.
      await listWrites
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
  listsLoaded = null
  listWrites = Promise.resolve()
  dropping = null
  projects = []
  offers.clear()
  wanted.clear()
  failures.clear()
  for (const ask of sizeAsks.values()) ask.answer(undefined)
  sizeAsks.clear()
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
      keepList(language, {
        etag: answer.etag,
        list: answer.list,
        at: iso(d().now()),
        server: d().server(),
        ...(originals ? { originals } : {}),
      })
    } else if (!before) return 'skip'
    noWait(language)
    setBlocked(language, null)
    // Only a list the app can plan from changes a size: one it cannot use (another compat) would make a size screen
    // ask again, get the same list, and ask again.
    if (kept(language)) moved()
    return 'ok'
  }
  const { blocked, retryAfter } = blockedByList(answer)
  // The block is kept with its wait, so a restart inside it still says why; a refusal with no wait keeps none.
  if (retryAfter) retryLater(language, retryAfter, blocked)
  else noWait(language)
  // The Worker has no packs for it: its kept list names parts and originals no longer there, and is forgotten.
  if (blocked === 'sinIdioma' && language in mem().listas) {
    const wasUsable = !!kept(language)
    forgetList(language)
    if (wasUsable) moved()
  }
  setBlocked(language, blocked)
  ctx.stopped.add(language)
  return 'blocked'
}

/**
 * The originals list every language plans from: the newest named by the kept lists of the projects' languages (of
 * this compat and server), whatever their state (one refused or waiting now still holds its originals on the
 * device), kept or fetched. When it cannot be had now, null, and the languages that need it hear «noDisponible»:
 * languages whose lists name originals are not planned in this run, so no plan puts older originals back. A 404 asks
 * its language's list again, once per run (a list naming an originals list that is gone is stale); another 404 is
 * `noDisponible`. A 429 waits its time; a failure waits for the next check.
 */
async function resolveOriginals(ctx: Ctx): Promise<PartsList | null> {
  for (;;) {
    const lists = projectLists()
    const ref = newestOriginals(lists, Object.keys(lists))
    if (!ref) return null
    // The projects' languages that cannot be planned without it.
    const needing = Object.keys(lists).filter((l) => lists[l].list.originals)
    // Fetched under any language (of this server and compat), it is the same list.
    const found = keptOriginals(keptLists(), ref.sha256)
    if (found) {
      cleared(needing, ctx)
      return found
    }
    const unavailable = () => {
      for (const l of needing) if (!state.blocked[l]) unavailableFor(l, 'originals')
    }
    if (ctx.signal.aborted || !d().isOnline()) return null
    // Inside a wait the originals route asked for (kept across a restart): the languages that need it say why.
    if (waiting(ORIGINALS_WAIT)) {
      unavailable()
      return null
    }
    const answer = await fetchOriginals(d().server(), d().compat(), ref.sha256, clientOpts(ctx))
    if (ctx.signal.aborted) return null
    switch (answer.kind) {
      case 'listo': {
        const entry = mem().listas[ref.from]
        if (entry) keepList(ref.from, { ...entry, originals: { sha256: ref.sha256, list: answer.list } })
        noWait(ORIGINALS_WAIT)
        cleared(needing, ctx)
        moved()
        return answer.list
      }
      case 'noEstá':
        if (!ctx.originalsRetried) {
          ctx.originalsRetried = true
          const again = await refreshList(ref.from, ctx, false)
          if (again === 'ok') continue
          // Refused (its own block says why) or not asked: the others are told they cannot download now.
          if (!ctx.signal.aborted) unavailable()
          return null
        }
        unavailable()
        return null
      case 'espera':
        retryLater(ORIGINALS_WAIT, answer.retryAfter, null)
        unavailable()
        return null
      case 'falla':
        unavailable()
        return null
    }
  }
}

/**
 * Once the originals are had, a `noDisponible` they left goes (not one a wait of the language's own still holds). A
 * size run lifts only those of the languages whose sizes it was asked: another's may be a download cut, which only its
 * own next try tells.
 */
function cleared(languages: string[], ctx: Ctx) {
  for (const l of languages) {
    if (ctx.kind === 'size' && ![...sizeAsks.values()].some((ask) => ask.language === l)) continue
    const byOriginals = mem().reintentar[l]?.by === 'originals'
    if (state.blocked[l] !== 'noDisponible' || (waiting(l) && !byOriginals) || ctx.stopped.has(l)) continue
    if (byOriginals) noWait(l)
    setBlocked(l, null)
  }
}

/** The originals list to plan from without asking anyone (startup). */
function keptNewestOriginals(): PartsList | null {
  const lists = projectLists()
  const ref = newestOriginals(lists, Object.keys(lists))
  return ref ? keptOriginals(keptLists(), ref.sha256) : null
}

/** A plan, and the units it was made for: those asked (`asked`), less those already on the device (`chosen`). */
type Planned = { plan: PartsPlan; register: Register; list: PartsList; originals?: PartsList; chosen: string[]; asked: string[] }

/**
 * A language's plan for some units, from its kept list (of this compat) and the register as it is now, without the
 * units already on the device in the release the lists name (`unitsWorthPlanning`: what a whole pack brought, or a
 * pack whose slots were forgot, is not downloaded again for nothing).
 */
async function planFor(language: string, asked: string[], originals: PartsList | null): Promise<Planned | null> {
  const k = kept(language)
  return k ? planWith(language, k.list, originals, asked) : null
}

async function planWith(language: string, list: PartsList, originals: PartsList | null, asked: string[]): Promise<Planned | null> {
  const stores = d().stores()
  const register = await readPartsRegister(stores)
  const whole = planLanguage({ list, originals, register, chosen: asked })
  if (!whole) return null
  const stamps = new Map<string, string>()
  for (const key of resourcesOf(whole)) {
    stamps.set(key, resourceContentStamp(await stores.catalog.get(key).catch(() => null)))
  }
  const chosen = unitsWorthPlanning({
    list,
    originals,
    register,
    chosen: asked,
    plan: whole,
    here: (unit) => unit === SHARED || d().bookIsHere(unit.slice('book '.length), language),
    deviceStamp: (key) => stamps.get(key) ?? NO_STAMP,
    listStamp: resourceContentStamp,
  })
  const plan = chosen.length === asked.length ? whole : planLanguage({ list, originals, register, chosen })!
  return { plan, register, list, chosen, asked, ...(list.originals && originals ? { originals } : {}) }
}

/** The bytes of a plan still to fetch: those of its parts not staged yet (a cut download left them). */
async function toFetch(plan: PartsPlan): Promise<number> {
  const staged = new Set((await d().staging().list().catch(() => [])).map((s) => s.sha))
  return plan.download.reduce((n, p) => (staged.has(p.sha256) ? n : n + p.bytes), 0)
}

/**
 * The units the Home offer covers: the shared unit and the language's project books already on the device (slots
 * of its list, or a book the library can open, whole packs included; `planFor` then leaves out those whose release on
 * the device is the lists'). A book not on the device is not offered; it is downloaded from its own screen
 * (`downloadBook`). None when no book is here.
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

/** Whether something is typed now: the deps' `isTyping`, else their `whenNotTyping`, which runs at once when not. */
function typingNow(): boolean {
  const given = d().isTyping
  if (given) return given()
  let ran = false
  const cancel = d().whenNotTyping(() => void (ran = true))
  if (!ran) cancel()
  return !ran
}

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
 *
 * All of it holds the lock against opening a pack (`onlineLock.ts`), and the plan is made again under it, from the
 * same lists and the register as it is now: a pack opened while the parts came forgot the slots of what it brought,
 * and a plan made before would pass over them. When the new plan needs parts not staged, B applies no unit and says
 * `missing`, and the caller downloads them; staged parts it no longer needs are pruned.
 */
async function applyPlan(
  language: string,
  before: Planned,
  ctx: Ctx,
  options: { blockOnVersions?: boolean } = {},
): Promise<'applied' | 'missing' | 'stopped'> {
  for (;;) {
    if (!(await untilNotTyping(ctx.signal))) return 'stopped'
    // Typing may have started while the lock was awaited (a pack opening): then the lock is let go, and the pause
    // waited for again.
    const done = await asOnlineApply(() => (typingNow() ? Promise.resolve('typing' as const) : applyPlanLocked(language, before, ctx, options)))
    if (done !== 'typing') return done
  }
}

async function applyPlanLocked(
  language: string,
  before: Planned,
  ctx: Ctx,
  { blockOnVersions = true }: { blockOnVersions?: boolean },
): Promise<'applied' | 'missing' | 'stopped'> {
  if (ctx.signal.aborted) return 'stopped'
  // From the units asked, as the plan before: a unit a pack left in another release meanwhile is planned again.
  const planned = await planWith(language, before.list, before.originals ?? null, before.asked)
  if (!planned) return 'stopped'
  const { plan } = planned
  const lock = await d()
    .wakeLock()
    .catch(() => null)
  try {
    const stores = d().stores()
    const staging = d().staging()
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
    await pruneStaging()
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
    // A unit that failed for another reason keeps its parts staged; the next check tries it again, up to three times.
    const unitsFailed = result.failed.flatMap((f) => (f.scope === 'unit' && f.reason !== 'quota' ? [f.unit] : []))
    if (unitsFailed.length) failedToApply(language, unitsFailed)
    if (!result.failed.some((f) => f.scope === 'unit')) served(language, planned.asked)
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
          unavailableFor(language)
          return
        }
        ctx.replanned.add(language)
        if ((await refreshList(language, ctx, false)) !== 'ok') return
        originals = await resolveOriginals(ctx)
        continue
      case 'espera':
        retryLater(language, result.retryAfter, 'noDisponible')
        setBlocked(language, 'noDisponible')
        return
      case 'sinEspacio':
        setBlocked(language, 'sinEspacio')
        return
      case 'falla':
        // A dropped connection (not an abort, which returned above): what came is staged, the next check goes on
        // from it, and meanwhile the book says why it did not come (spec §2).
        unavailableFor(language)
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
    // Unreadable staging: nothing is known to be staged, and the check goes on.
    staged ??= new Set((await d().staging().list().catch(() => [])).map((s) => s.sha))
    const units = new Set(planned.plan.download.filter((p) => own.has(p.sha256) && staged!.has(p.sha256)).map((p) => unitOfPart(p)))
    if (units.size) want(language, [SHARED, ...units])
  }
}

/** What an offer brings, as «Ahora no» remembers it: the sha256 of its parts' shas, sorted. */
const offerKey = (plan: PartsPlan): Promise<string> =>
  sha256Hex(new TextEncoder().encode(plan.download.map((p) => p.sha256).sort().join(' ')))

/** What is new for a language's books on the device, offered unless it is being downloaded or refused. */
async function updateOffer(language: string, originals: PartsList | null, ctx: Ctx) {
  if (ctx.signal.aborted) return
  let offer: { bytes: number; key: string; units: string[] } | null = null
  if (!wanted.has(language) && !ctx.stopped.has(language) && !listBlocked(language) && kept(language)) {
    const register = await readPartsRegister(d().stores())
    const units = offerUnits(language, register)
    const planned = units.length ? await planFor(language, units, originals) : null
    if (planned?.plan.download.length) offer = { bytes: await toFetch(planned.plan), key: await offerKey(planned.plan), units }
  }
  if (ctx.signal.aborted) return
  if (offer) offers.set(language, offer)
  else offers.delete(language)
  showOffer()
}

/**
 * Deletes the staged parts that no usable kept list names: no language list, and no originals list kept with one, of
 * this server and compat. What a cut download left of a list that moved on, or of a language no longer asked for,
 * would otherwise stay on the phone for good. Without any usable list (offline at the first launch, or only lists of
 * another server or an earlier app) nothing is known to be useless, and nothing is deleted. Called only inside a run,
 * after its queue ended: a part being downloaded is never pruned under it.
 */
async function pruneStaging(): Promise<void> {
  try {
    const lists = Object.values(keptLists())
    if (!lists.length) return
    const named = new Set<string>()
    for (const k of lists) {
      for (const p of k.list.parts) named.add(p.sha256)
      for (const p of k.originals?.list.parts ?? []) named.add(p.sha256)
    }
    const staging = d().staging()
    for (const { sha } of await staging.list()) if (!named.has(sha)) await staging.delete(sha)
  } catch {
    // What is left is pruned at the next apply.
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The runs.

/**
 * B's startup heal: each language's current plan applied as it is; nothing is asked of the Worker. A list made with
 * other versions is left to the next check, which asks the Worker before saying «actualice la app». Then staging is
 * pruned from the lists kept.
 */
async function heal(ctx: Ctx) {
  const originals = keptNewestOriginals()
  for (const language of languagesOf(projects)) {
    if (ctx.signal.aborted) return
    const planned = await planFor(language, unitsOf(projects, language), originals)
    if (!planned) continue
    const done = await applyPlan(language, planned, ctx, { blockOnVersions: false })
    // B applies no unit while one part is missing: the units staged whole are applied on their own, so a book whose
    // download ended just before its apply opens without internet.
    if (done !== 'missing' || ctx.signal.aborted) continue
    const ready = await stagedUnits(planned.plan)
    const again = ready.length ? await planFor(language, ready, originals) : null
    if (again?.plan.units.length) await applyPlan(language, again, ctx, { blockOnVersions: false })
  }
  if (!ctx.signal.aborted) await pruneStaging()
}

/** The units of a plan whose every part to download is staged. */
async function stagedUnits(plan: PartsPlan): Promise<string[]> {
  const staged = new Set((await d().staging().list().catch(() => [])).map((s) => s.sha))
  const whole = new Map<string, boolean>()
  for (const p of plan.download) whole.set(unitOfPart(p), (whole.get(unitOfPart(p)) ?? true) && staged.has(p.sha256))
  return [...whole].flatMap(([unit, all]) => (all ? [unit] : []))
}

async function check(force: boolean, ctx: Ctx) {
  if (!d().isOnline()) return
  // The lists are asked for, and what they bring planned, at a pause in the typing (spec §4).
  if (!(await untilNotTyping(ctx.signal))) return
  const languages = languagesOf(projects)
  if (force || !(d().now() - lastCheck() < RECHECK_MS)) {
    for (const language of languages) {
      if (ctx.signal.aborted) return
      await refreshList(language, ctx, true)
    }
    if (ctx.signal.aborted) return
    // A check before the projects are known (startup not done yet) asked for nothing: it is not the last check.
    if (languages.length) {
      mem().buscado = iso(d().now())
      save('buscado')
    }
  } else {
    // Between the three-hourly checks, a language whose wait is over, or whose download was asked for, is asked again
    // now: a 202 asked for ten minutes, not three hours.
    for (const language of languages) {
      if (ctx.signal.aborted) return
      if (waitOver(language) || (wanted.has(language) && !waiting(language))) await refreshList(language, ctx, true)
    }
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
  moved()
  restoreBlocks()
  waitsMoved()
  dropUnusedLists()
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
  askedAgain(language, [SHARED, bookUnitOf(book)])
  want(language, [SHARED, bookUnitOf(book)])
  return runDownload(language)
}

/** The Home card's «Bajar»: the update of the language's books on the device, and its shared unit. */
export function downloadOffer(): Promise<void> {
  const offer = state.offer
  const units = offer && offers.get(offer.language)?.units
  if (!offer || !units?.length) return Promise.resolve()
  askedAgain(offer.language, units)
  want(offer.language, units)
  offers.delete(offer.language)
  showOffer()
  return runDownload(offer.language)
}

/** Sizes asked for and not yet answered, by language and book: one ask in flight each. */
type SizeAsk = { language: string; book: string; promise: Promise<BookSize>; answer: (size: BookSize) => void }
const sizeAsks = new Map<string, SizeAsk>()
let sizing = false

/**
 * What downloading a book would bring now (its parts and the shared ones not on the device), in bytes. Null only when
 * a usable kept list (this server and compat) names no part of the book; undefined whenever it cannot be told now:
 * no list (offline, a wait the Worker asked for, refused), or the originals it needs cannot be had yet (among them,
 * before the projects are known). Asks for the list when none is kept.
 *
 * The same book asked again while its answer is coming gets the same answer. Sizes are worked out in runs of their own
 * (never beside a check or a download: they wait for the one in flight), each answering every size asked by then, so
 * trying several books makes no queue of runs.
 */
export function bookDownloadSize(language: string, book: string): Promise<BookSize> {
  const key = `${language} ${book}`
  const asked = sizeAsks.get(key)
  if (asked) return asked.promise
  let answer!: (size: BookSize) => void
  const promise = new Promise<BookSize>((resolve) => (answer = resolve))
  sizeAsks.set(key, { language, book, promise, answer })
  if (!sizing) void answerSizes()
  return promise
}

async function answerSizes() {
  sizing = true
  try {
    while (sizeAsks.size) {
      while (current) await current.promise
      if (!sizeAsks.size) break
      // An aborted run leaves its asks; the next run answers them.
      await startRun('size', sizesRun)
    }
  } finally {
    sizing = false
  }
}

/** Answers the sizes asked, each list asked for at most once and the originals resolved once in the run. */
async function sizesRun(ctx: Ctx) {
  const listed = new Set<string>()
  let originals: PartsList | null | undefined
  const sizeOf = async (language: string, book: string): Promise<BookSize> => {
    if (!kept(language) && !listed.has(language)) {
      listed.add(language)
      if (d().isOnline() && (await refreshList(language, ctx, true)) === 'ok') originals = undefined
    }
    const k = kept(language)
    if (!k) return undefined
    if (!listHasBook(k.list, book)) return null
    if (originals === undefined) originals = await resolveOriginals(ctx)
    if (k.list.originals && !originals) return undefined
    const planned = await planFor(language, [SHARED, bookUnitOf(book)], originals)
    return planned ? toFetch(planned.plan) : undefined
  }
  for (;;) {
    if (ctx.signal.aborted) return
    const next = sizeAsks.entries().next()
    if (next.done) return
    const [key, ask] = next.value
    let size: BookSize
    try {
      size = await sizeOf(ask.language, ask.book)
    } catch {
      size = undefined
    }
    if (ctx.signal.aborted) return
    if (sizeAsks.get(key) === ask) {
      sizeAsks.delete(key)
      ask.answer(size)
    }
  }
}

/**
 * Another server chosen («Acerca de»): what was kept of the last one's answers goes (its waits, the last check, the
 * blocks and offers; its kept lists are ignored by themselves), then the new one is asked at once, after the run in
 * flight, which a check would otherwise join and so never ask.
 */
export async function choosePacksServer(id: PacksServerId): Promise<void> {
  setPacksServer(id)
  mem().reintentar = {}
  save('reintentar')
  waitsMoved()
  mem().buscado = ''
  save('buscado')
  offers.clear()
  set({ blocked: {}, offer: null })
  moved()
  for (;;) {
    const run = current
    if (!run) return startRun('check', (ctx) => check(true, ctx))
    await run.promise
  }
}
