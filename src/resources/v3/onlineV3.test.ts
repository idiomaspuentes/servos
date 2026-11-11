/**
 * Servos online over format 3: the same `OnlineState` the screens read, from the format 3 client and a fake packs
 * Worker (the signed sample of es-419 Titus behind an injected `fetch`). Opt-in: `SERVOS_WORKER=staging` installs
 * es-419 Titus from the staging Worker (read-only GETs).
 */
import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { memoryStore, type BlobStore, type InstalledState, type LanguagePackClient } from '@bt-synergy/language-pack-client'
import es from '../../app/i18n/es.json'
import { blockedKey } from '../../app/projects/onlineWords'
import type { Progress } from '../online/downloads'
import {
  bookDownloadSize,
  checkForUpdates,
  choosePacksServer,
  declineOffer,
  downloadBook,
  downloadOffer,
  forgetOwnWaits,
  onOnline,
  onlineState,
  setOnlineDeps,
  setOnlineProjects,
  type OnlineDeps,
} from '../online/onlineResources'
import { V3_ORIGINS, packsFormat, setPacksServer } from '../online/packsServer'
import { createPacksV3, packsV3, resetPacksV3 } from './client'
import { lexUnitsFor, testamentLexOf } from './onlineV3'
import { lexGroupsOf } from './companionsV3'
import { trustedKeys } from './keys'
import { zipSource } from '@bt-synergy/language-pack-v3'
import { exportBookV3, exportableV3, importOldPackV3 } from './filesV3'
import { buildSample, fakeFetch, specData, type Sample } from './testing/sample'

type Project = Parameters<typeof setOnlineProjects>[0][number]
const project = (helpsLanguage: string, books: string[]): Project =>
  ({ id: `p-${helpsLanguage}`, helpsLanguage, books: books.map((code) => ({ code, phase: 'traduccion' })) }) as unknown as Project

const memoryStorage = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

const SEG = /\/v3\/packs\/seg\/([0-9a-f]{64})$/
const CATALOG = /\/v3\/packs\/[^/]+\/catalog$/

/**
 * The fake Worker: the sample's answers, unless `rule` answers first. `served` are the segments answered 200, `asked`
 * every URL. `sample` can be changed to serve another revision.
 */
function worker(first: Sample) {
  const w = {
    sample: first,
    rule: null as ((url: string) => Response | undefined) | null,
    asked: [] as string[],
    served: [] as string[],
    fetch: (async (input: RequestInfo | URL) => {
      const url = String(input)
      w.asked.push(url)
      const res = w.rule?.(url) ?? (await fakeFetch(w.sample)(url))
      const seg = SEG.exec(url)
      if (seg && res.status === 200) w.served.push(seg[1])
      return res
    }) as typeof fetch,
  }
  return w
}

let unsubscribe = () => {}

/** A device on staging: a clock, a network, nobody typing, the library and the helps watch as spies. */
function device(client: LanguagePackClient, over: Partial<OnlineDeps> = {}) {
  const dev = {
    clock: Date.parse('2026-11-06T12:00:00Z'),
    online: true,
    storage: memoryStorage(),
    refreshed: 0,
    watched: [] as string[][],
    progress: [] as Progress[],
  }
  setOnlineDeps({
    format: () => 3,
    packsV3: async () => client,
    fetch: (() => Promise.reject(new Error('no format 2.0 request in format 3'))) as typeof fetch,
    storage: dev.storage,
    kept: null,
    now: () => dev.clock,
    isOnline: () => dev.online,
    isTyping: () => false,
    whenNotTyping: (run) => {
      run()
      return () => {}
    },
    estimate: null,
    wakeLock: async () => null,
    bookIsHere: () => false,
    refreshLibrary: async () => void dev.refreshed++,
    watchHelpsV3: async (_language, books) => {
      dev.watched.push([...books])
      return []
    },
    keepHelpsChangesV3: async () => [],
    ...over,
  })
  unsubscribe = onOnline((s) => {
    if (s.busy) dev.progress.push(s.busy.progress)
  })
  setOnlineProjects([project('es-419', ['tit'])])
  return dev
}

async function setup(o: { store?: BlobStore; keys?: Record<string, Uint8Array> } = {}) {
  const sample = await buildSample()
  const w = worker(sample)
  const store = o.store ?? memoryStore()
  const client = await createPacksV3({ fetch: w.fetch, store, trustedKeys: o.keys ?? { [sample.keyId]: sample.publicKey } })
  return { sample, w, store, client, dev: device(client) }
}

const installed = async (client: LanguagePackClient, key: string) => (await client.status('es-419')).units.find((u) => u.key === key)?.installed

afterEach(() => {
  unsubscribe()
  setOnlineDeps()
  resetPacksV3()
  vi.unstubAllGlobals()
})

describe('format 3 online', () => {
  it('downloads a book and the library reads it', async () => {
    // The app's own client and library: `?packs=staging` chooses format 3.
    vi.stubGlobal('location', { search: '?packs=staging' })
    const sample = await buildSample()
    const w = worker(sample)
    const client = await packsV3({ fetch: w.fetch, store: memoryStore(), trustedKeys: { [sample.keyId]: sample.publicKey } })
    const library = await import('../../app/projects/library')
    const dev = device(client, { refreshLibrary: async () => (dev.refreshed++, library.refreshLibrary()) })

    const size = await bookDownloadSize('es-419', 'tit')
    expect(size).toBeGreaterThan(0)
    expect(library.v3Books().get('es-419')?.has('tit')).toBeFalsy()

    await downloadBook('es-419', 'tit')
    expect(onlineState().blocked).toEqual({})
    expect(onlineState().busy).toBeNull()
    expect(w.asked.every((u) => u.startsWith(`${V3_ORIGINS.staging}/v3/packs/`))).toBe(true)
    // The progress went from nothing to all of it, by bytes; the size said before is never less than what came.
    expect(dev.progress[0]).toMatchObject({ bytesDone: 0, bytesTotal: size })
    const last = dev.progress.at(-1)!
    expect(last.bytesDone).toBe(last.bytesTotal)
    expect(last.bytesDone).toBeLessThanOrEqual(size!)
    // The book, what it needs, and only the lexicon groups its original's Strong numbers fall in.
    expect(await installed(client, 'es-419/book:tit')).toBe(true)
    const units = (await client.status('es-419')).units
    const orig = await (await client.open('es-419')).orig('tit')
    const used = lexGroupsOf(orig!.words.map((w) => w.strong))
    const lexHere = units.filter((u) => /\/lex:/.test(u.key) && u.installed).map((u) => u.key.slice(u.key.indexOf('/') + 1))
    expect(lexHere.length).toBeGreaterThan(0)
    expect(new Set(lexHere)).toEqual(new Set([...used].filter((g) => units.some((u) => u.key.endsWith(`/${g}`)))))
    console.log(`[sample] lex listed ${units.filter((u) => /\/lex:/.test(u.key)).map((u) => u.key).join(' ')}; installed ${lexHere.join(' ')}; size ${size}, fetched ${last.bytesDone}`)
    // Watched before, the library read again after: it reads Titus from format 3.
    expect(dev.watched).toEqual([['tit']])
    expect(dev.refreshed).toBe(1)
    expect(library.v3Books().get('es-419')?.has('tit')).toBe(true)
    expect(library.bookIsHere('tit', 'es-419')).toBe(true)
    expect(await bookDownloadSize('es-419', 'tit')).toBe(0)
  }, 30_000)

  it('Titus installs only the lex groups its Strong numbers fall in', async () => {
    // The sample's catalog lists only `lex:G0`: the choice is checked against every group a catalog could list.
    const { client } = await setup()
    await downloadBook('es-419', 'tit')
    const orig = await (await client.open('es-419')).orig('tit')
    const strongs = orig!.words.map((w) => w.strong)
    const listed = ['G', 'H'].flatMap((l) => Array.from({ length: 10 }, (_, i) => `es-419/lex:${l}${i}`))
    const chosen = lexUnitsFor(strongs, listed)
    const numbers = strongs.flatMap((s) => (/^G(\d+)\d$/.exec(s) ? [Number(/^G(\d+)\d$/.exec(s)![1])] : []))
    expect(chosen).toEqual([...new Set(numbers.map((n) => `es-419/lex:G${Math.floor(n / 1000)}`))].sort((a, b) => listed.indexOf(a) - listed.indexOf(b)))
    expect(chosen.length).toBeLessThan(testamentLexOf('tit', listed).length)
    expect(chosen.every((u) => /lex:G/.test(u))).toBe(true)
  })

  it('choosing the server reads the library again in its format', async () => {
    vi.stubGlobal('localStorage', memoryStorage())
    setPacksServer('staging')
    const sample = await buildSample()
    const client = await packsV3({ fetch: worker(sample).fetch, store: memoryStore(), trustedKeys: { [sample.keyId]: sample.publicKey } })
    const library = await import('../../app/projects/library')
    device(client, { format: () => packsFormat(), refreshLibrary: () => library.refreshLibrary() })
    await downloadBook('es-419', 'tit')
    expect(library.v3Books().get('es-419')?.has('tit')).toBe(true)

    // Production is format 2: the library stops reading format 3 at once.
    await choosePacksServer('produccion')
    expect(packsFormat()).toBe(2)
    expect(library.v3Books().size).toBe(0)

    // And back.
    await choosePacksServer('staging')
    expect(packsFormat()).toBe(3)
    expect(library.v3Books().get('es-419')?.has('tit')).toBe(true)
  })

  it('a second download fetches only what is missing', async () => {
    const { w, client, dev } = await setup()
    const whole = await bookDownloadSize('es-419', 'tit')
    // The connection drops after three segments.
    let ok = 0
    w.rule = (url) => (SEG.test(url) && ++ok > 3 ? new Response('busy', { status: 503 }) : undefined)
    await downloadBook('es-419', 'tit')
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    const first = [...w.served]
    expect(first.length).toBeGreaterThanOrEqual(3)
    expect(await installed(client, 'es-419/book:tit')).toBe(false)

    const rest = await bookDownloadSize('es-419', 'tit')
    expect(rest).toBeGreaterThan(0)
    expect(rest).toBeLessThan(whole!)

    // The connection comes back: the waits the app set for itself go, and the book is asked again.
    w.rule = null
    w.served.length = 0
    forgetOwnWaits()
    await downloadBook('es-419', 'tit')
    expect(onlineState().blocked).toEqual({})
    expect(await installed(client, 'es-419/book:tit')).toBe(true)
    expect(w.served.filter((id) => first.includes(id))).toEqual([])
    expect(dev.refreshed).toBe(2)
  })

  it('a 429 waits and says espera', async () => {
    const { w, client, dev } = await setup()
    w.rule = (url) => (SEG.test(url) ? new Response('slow down', { status: 429, headers: { 'Retry-After': '120' } }) : undefined)
    await downloadBook('es-419', 'tit')
    // The words of format 2.0's `espera`: «No se pueden bajar ahora; se intentará más tarde», with the Worker's wait.
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    const wait = JSON.parse(dev.storage.getItem('servos.enLinea.reintentar')!)['es-419']
    expect(Date.parse(wait.until)).toBe(dev.clock + 120_000)
    expect(wait.own).toBeUndefined()

    // Inside the wait nothing is asked, even by a forced check.
    w.rule = null
    const asked = w.asked.length
    await checkForUpdates({ force: true })
    expect(w.asked.length).toBe(asked)

    // After it, the next check finishes the download the person asked for.
    dev.clock += 121_000
    await checkForUpdates()
    expect(await installed(client, 'es-419/book:tit')).toBe(true)
    expect(onlineState().blocked).toEqual({})
  })

  it('v3-off says noDisponible and keeps the book', async () => {
    const { w, client } = await setup()
    await downloadBook('es-419', 'tit')
    expect(await installed(client, 'es-419/book:tit')).toBe(true)

    w.rule = (url) => (CATALOG.test(url) ? new Response(JSON.stringify({ state: 'unavailable', reason: 'v3-off' }), { status: 404 }) : undefined)
    await checkForUpdates({ force: true })
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    expect(onlineState().offer).toBeNull()
    expect(await installed(client, 'es-419/book:tit')).toBe(true)
    expect((await client.open('es-419')).installed('book:tit')).toBe(true)
  })

  it('E_SIGNATURE installs nothing and says noConfiable', async () => {
    const store = memoryStore()
    // bt-synergy's real keys: the sample was signed with a key made for the test.
    const { dev } = await setup({ store, keys: trustedKeys() })
    await downloadBook('es-419', 'tit')
    expect(onlineState().blocked).toEqual({ 'es-419': 'noConfiable' })
    expect(await store.ids()).toEqual([])
    expect(dev.refreshed).toBe(0)
    expect(blockedKey('noConfiable')).toBe('paquetes3.noConfiable')
    expect((es as Record<string, string>)['paquetes3.noConfiable']).toBe(
      'No se pudo comprobar que estos textos vienen de Idiomas Puentes. No se instaló nada.',
    )
  })

  it('a full store says no hay espacio and activates nothing new', async () => {
    // The two catalogs go in; the store is full a few segments later.
    const inner = memoryStore()
    let puts = 0
    const store: BlobStore = {
      ...inner,
      has: (id) => inner.has(id),
      get: (id) => inner.get(id),
      delete: (id) => inner.delete(id),
      ids: () => inner.ids(),
      getState: () => inner.getState(),
      setState: (s) => inner.setState(s),
      put: async (id, bytes) => {
        if (++puts > 2 + 5) throw new DOMException('full', 'QuotaExceededError')
        return inner.put(id, bytes)
      },
    }
    const { client, dev } = await setup({ store })
    await downloadBook('es-419', 'tit')
    expect(onlineState().blocked).toEqual({ 'es-419': 'sinEspacio' })
    expect(dev.refreshed).toBe(0)
    const units = (await client.status('es-419')).units
    expect(units.filter((u) => u.installed)).toEqual([])
  })

  it('an update is offered with its bytes and Ahora no hides it until the next revision', async () => {
    const one = await buildSample(1)
    const two = await buildSample(2)
    const store = memoryStore()
    const { w, client, dev } = await setup({ store, keys: { [one.keyId]: one.publicKey, [two.keyId]: two.publicKey } })
    await downloadBook('es-419', 'tit')
    expect(onlineState().offer).toBeNull()

    // The book here is an older one: one of its segments is not the catalog's.
    const state = (await store.getState()) as InstalledState & { units: Record<string, { segments: string[]; revision: number }> }
    const book = state.units['es-419/book:tit']
    const replaced = book.segments[0]
    book.segments = ['0'.repeat(64), ...book.segments.slice(1)]
    book.revision = 0
    await store.setState(state as never)
    const bytes = (await client.status('es-419')).updates.reduce((n, u) => n + u.bytes, 0)
    expect(bytes).toBe((await store.get(replaced))!.byteLength)

    await checkForUpdates({ force: true })
    const offer = onlineState().offer
    expect(offer).toMatchObject({ language: 'es-419', bytes })

    declineOffer()
    expect(onlineState().offer).toBeNull()
    dev.clock += 4 * 60 * 60 * 1000
    await checkForUpdates()
    expect(onlineState().offer).toBeNull()

    // The next revision of the catalogs: offered again.
    w.sample = two
    await checkForUpdates({ force: true })
    expect(onlineState().offer).toMatchObject({ language: 'es-419', bytes })
    expect(onlineState().offer!.key).not.toBe(offer!.key)

    dev.watched.length = 0
    const refreshed = dev.refreshed
    await downloadOffer()
    expect(dev.watched).toEqual([['tit']])
    expect(dev.refreshed).toBe(refreshed + 1)
    expect(onlineState().offer).toBeNull()
    expect((await client.status('es-419')).updates).toEqual([])
    expect(onlineState().blocked).toEqual({})
  })

  it('a book made from an old pack is replaced by the published one the offer brings, and can be passed', async () => {
    const sample = await buildSample()
    const w = worker(sample)
    const client = await createPacksV3({ fetch: w.fetch, store: memoryStore(), trustedKeys: { [sample.keyId]: sample.publicKey } })
    // The packs the app carries, opened offline at first start: Titus is bridged.
    const deps = { client: async () => client, originals: async () => zipSource(specData('originals-tit.langpack.zip')), keepOriginals: async () => {} }
    expect(await importOldPackV3(specData('es-419-tit.langpack.zip'), deps)).toMatchObject({ state: 'added', books: ['tit'] })
    expect(await exportableV3('es-419', 'tit', deps)).toBe(false)
    // The book is here, so nothing is wanted: only the offer can bring the published one.
    device(client, { bookIsHere: () => true })

    await checkForUpdates({ force: true })
    const offer = onlineState().offer
    expect(offer).toMatchObject({ language: 'es-419' })
    await downloadOffer()
    expect(onlineState().offer).toBeNull()
    const units = (await client.status('es-419')).units.filter((u) => u.installed)
    expect(units.filter((u) => u.local)).toEqual([])
    expect(units.map((u) => u.key)).toEqual(expect.arrayContaining(['es-419/book:tit', 'common/orig:tit']))
    expect(await exportableV3('es-419', 'tit', deps)).toBe(true)
    expect((await exportBookV3('es-419', 'tit', deps)).byteLength).toBeGreaterThan(0)
  }, 60_000)
})

describe.runIf(process.env.SERVOS_WORKER === 'staging')('format 3 from the staging Worker', () => {
  it('installs es-419 Titus', { timeout: 300_000 }, async () => {
    const client = await createPacksV3({ store: memoryStore() })
    const dev = device(client, { fetch: undefined })
    const size = await bookDownloadSize('es-419', 'tit')
    const started = Date.now()
    await downloadBook('es-419', 'tit')
    const seconds = (Date.now() - started) / 1000
    const lex = (await client.status('es-419')).units.filter((u) => /\/lex:G\d+$/.test(u.key))
    const here = lex.filter((u) => u.installed)
    const sum = (us: typeof lex) => us.reduce((b, u) => b + u.bytes, 0)
    console.log(
      `[staging] es-419 Titus: said ${size} bytes before, fetched ${dev.progress.at(-1)?.bytesDone} in ${seconds.toFixed(1)} s; ` +
        `lexicon ${here.map((u) => u.key).join(' ')} (${sum(here)} bytes) of ${lex.length} G groups (${sum(lex)} bytes)`,
    )
    expect(onlineState().blocked).toEqual({})
    expect(await installed(client, 'es-419/book:tit')).toBe(true)
    expect(dev.refreshed).toBe(1)
  })
})
