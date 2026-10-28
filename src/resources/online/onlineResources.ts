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
import { refreshLibrary as realRefreshLibrary } from '../../app/projects/library'
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

/** What is new for each language, offered one at a time in the projects' order. */
const offers = new Map<string, { bytes: number; code: string }>()

function showOffer() {
  const declined = mem().ahoraNo
  for (const language of languagesOf(projects)) {
    const o = offers.get(language)
    if (o && declined[language] !== o.code) {
      const current = state.offer
      if (current?.language !== language || current.bytes !== o.bytes || current.code !== o.code) set({ offer: { language, ...o } })
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

type Run = { kind: 'check' | 'download'; language?: string; units?: Set<string>; ctrl: AbortController; promise: Promise<void>; generation: number }
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

/** Languages that may choose the originals now: not refused in this run, nor waiting for the Worker. */
const choosing = (languages: string[], ctx: Ctx) => languages.filter((l) => !ctx.stopped.has(l) && !waiting(l))
const languagesWith = (language: string) => [...new Set([...languagesOf(projects), language])]

// ---------------------------------------------------------------------------------------------------------------
// The lists.

/** Asks for a language's list (with its ETag unless told not to): `ok` when a list is kept to plan from. */
async function refreshList(language: string, ctx: Ctx, withEtag: boolean): Promise<'ok' | 'blocked' | 'skip'> {
  if (waiting(language) || ctx.signal.aborted) return 'skip'
  const kept = mem().listas[language]
  const answer = await fetchList(d().server(), d().compat(), language, withEtag ? kept?.etag : null, clientOpts(ctx))
  if (ctx.signal.aborted) return 'skip'
  if (answer.kind === 'listo' || answer.kind === 'igual') {
    if (answer.kind === 'listo') {
      // Its originals list stays kept only if it still names the same one.
      const originals = kept?.originals && kept.originals.sha256 === answer.list.originals?.sha256 ? kept.originals : undefined
      mem().listas[language] = { etag: answer.etag, list: answer.list, at: iso(d().now()), ...(originals ? { originals } : {}) }
      save('listas')
    } else if (!kept) return 'skip'
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
 * The originals list every language plans from: the newest named among `languages`, kept or fetched. A 404 asks its
 * language's list again, once per run (a list naming an originals list that is gone is stale); another 404 is
 * `noDisponible`. A 429 waits its time; a failure waits for the next check. Null when there is none to plan from.
 */
async function resolveOriginals(languages: string[], ctx: Ctx): Promise<PartsList | null> {
  for (;;) {
    const ref = newestOriginals(mem().listas, languages)
    if (!ref) return null
    const kept = keptOriginals(mem().listas, ref.sha256)
    if (kept) return kept
    if (ctx.signal.aborted || !d().isOnline() || waiting(ref.from)) return null
    const answer = await fetchOriginals(d().server(), d().compat(), ref.sha256, clientOpts(ctx))
    if (ctx.signal.aborted) return null
    const needing = languages.filter((l) => mem().listas[l]?.list.originals)
    switch (answer.kind) {
      case 'listo': {
        const entry = mem().listas[ref.from]
        if (entry) {
          mem().listas[ref.from] = { ...entry, originals: { sha256: ref.sha256, list: answer.list } }
          save('listas')
        }
        return answer.list
      }
      case 'noEstá':
        if (!ctx.originalsRetried) {
          ctx.originalsRetried = true
          if ((await refreshList(ref.from, ctx, false)) === 'ok') continue
          return null
        }
        for (const l of needing) setBlocked(l, 'noDisponible')
        return null
      case 'espera':
        for (const l of needing) {
          retryLater(l, answer.retryAfter)
          setBlocked(l, 'noDisponible')
        }
        return null
      case 'falla':
        for (const l of needing) setBlocked(l, 'noDisponible')
        return null
    }
  }
}

/** The originals list to plan from without asking anyone (startup). */
function keptNewestOriginals(languages: string[]): PartsList | null {
  const ref = newestOriginals(mem().listas, languages)
  return ref ? keptOriginals(mem().listas, ref.sha256) : null
}

type Planned = { plan: PartsPlan; register: Register; list: PartsList; originals?: PartsList; chosen: string[] }

/** A language's plan for some units, from its kept list and the register as it is now. */
async function planFor(language: string, chosen: string[], originals: PartsList | null): Promise<Planned | null> {
  const kept = mem().listas[language]
  if (!kept) return null
  const register = await readPartsRegister(d().stores())
  const plan = planLanguage({ list: kept.list, originals, register, chosen })
  if (!plan) return null
  return { plan, register, list: kept.list, chosen, ...(kept.list.originals && originals ? { originals } : {}) }
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
 * applied, the library read again, and what changed kept. `missing` when a part is not staged after all.
 */
async function applyPlan(language: string, planned: Planned, ctx: Ctx): Promise<'applied' | 'missing' | 'stopped'> {
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
      setBlocked(language, 'actualizarApp')
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
        originals = await resolveOriginals(choosing(languagesWith(language), ctx), ctx)
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
    const kept = mem().listas[language]
    if (!kept) continue
    const planned = await planFor(language, unitsOf(projects, language), originals)
    if (!planned?.plan.download.length) continue
    // Originals parts are shared: staged for one language, they say nothing of what another was asked for.
    const own = new Set(kept.list.parts.map((p) => p.sha256))
    staged ??= new Set((await d().staging().list()).map((s) => s.sha))
    const units = new Set(planned.plan.download.filter((p) => own.has(p.sha256) && staged!.has(p.sha256)).map((p) => unitOfPart(p)))
    if (units.size) want(language, [SHARED, ...units])
  }
}

/** What is new for a language, offered unless it is being downloaded or refused. */
async function updateOffer(language: string, originals: PartsList | null, ctx: Ctx) {
  if (ctx.signal.aborted) return
  let offer: { bytes: number; code: string } | null = null
  if (!wanted.has(language) && !ctx.stopped.has(language) && !listBlocked(language)) {
    const planned = await planFor(language, unitsOf(projects, language), originals)
    if (planned?.plan.download.length) offer = { bytes: planned.plan.bytes, code: planned.list.code }
  }
  if (ctx.signal.aborted) return
  if (offer) offers.set(language, offer)
  else offers.delete(language)
  showOffer()
}

// ---------------------------------------------------------------------------------------------------------------
// The runs.

/** B's startup heal: each language's current plan applied as it is; nothing is asked of the Worker. */
async function heal(ctx: Ctx) {
  const languages = languagesOf(projects)
  const originals = keptNewestOriginals(languages)
  for (const language of languages) {
    if (ctx.signal.aborted) return
    const planned = await planFor(language, unitsOf(projects, language), originals)
    if (planned) await applyPlan(language, planned, ctx)
  }
}

async function check(force: boolean, ctx: Ctx) {
  if (!d().isOnline()) return
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
  const originals = await resolveOriginals(choosing(languages, ctx), ctx)
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
  const originals = await resolveOriginals(choosing(languagesWith(language), ctx), ctx)
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

/** Asks for the lists (every three hours unless forced; never before a wait the Worker asked for). */
export function checkForUpdates(opts: { force?: boolean } = {}): Promise<void> {
  if (current) return current.promise
  return startRun('check', (ctx) => check(Boolean(opts.force), ctx))
}

/** The project's book, now: its parts and the shared ones, downloaded and applied. */
export function downloadBook(language: string, book: string): Promise<void> {
  want(language, [SHARED, bookUnitOf(book)])
  return runDownload(language)
}

/** The Home card's «Bajar»: everything new for its language. */
export function downloadOffer(): Promise<void> {
  const offer = state.offer
  if (!offer) return Promise.resolve()
  want(offer.language, unitsOf(projects, offer.language))
  offers.delete(offer.language)
  showOffer()
  return runDownload(offer.language)
}

/**
 * What downloading a book would bring now (its parts and the shared ones not on the device), in bytes; null when its
 * language has no list to plan from or names no part of it. Asks for the list when none is kept.
 */
export async function bookDownloadSize(language: string, book: string): Promise<number | null> {
  try {
    const ctx = newCtx(new AbortController().signal)
    if (!mem().listas[language]) {
      if (!d().isOnline() || (await refreshList(language, ctx, true)) !== 'ok') return null
    }
    const kept = mem().listas[language]
    if (!kept || !listHasBook(kept.list, book)) return null
    const originals = await resolveOriginals(choosing(languagesWith(language), ctx), ctx)
    const planned = await planFor(language, [SHARED, bookUnitOf(book)], originals)
    return planned ? planned.plan.bytes : null
  } catch {
    return null
  }
}
