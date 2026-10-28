import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { REGISTER_PREFIX, applyParts, memoryByteStore, stagingFrom, writePart, type ApplyInput, type PartEntry, type PartRow, type PartsList } from '@bt-synergy/language-pack'
import { resourceContentStamp } from '@bt-synergy/resource-catalog'
import { RESOURCE_VERSIONS, openResourceStores, readPartsRegister, type ResourceStores } from '../store'
import { ANSWERS, fakeWorker } from './fakeWorker'
import {
  RECHECK_MS,
  bookDownloadSize,
  checkForUpdates,
  choosePacksServer,
  setOnlineProjects,
  declineOffer,
  downloadBook,
  downloadOffer,
  nextWaitEnd,
  onOnline,
  onlineState,
  setOnlineDeps,
  startOnline,
  stopOnline,
  type OnlineDeps,
} from './onlineResources'
import { indexedDbKeptStore, type KeptStore } from './keptLists'
import { whileOnlineIdle } from './onlineLock'

type Worker = ReturnType<typeof fakeWorker>
type Project = Parameters<typeof startOnline>[0][number]

const UGNT = 'unfoldingWord/el-x-koine/ugnt'
const tnOf = (language: string) => `o/${language}/tn`
const twOf = (language: string) => `o/${language}/tw`
/** A catalog row of the release a stamp (`tag#published_at`) names. */
const meta = (key: string, type: string, subject: string, stamp: string) => {
  const [owner, language, resourceId] = key.split('/')
  const [tag_name, published_at] = stamp.split('#')
  return { resourceKey: key, owner, language, resourceId, type, subject, title: key, release: { tag_name, published_at } }
}
const V1 = 'v1#2026-10-01T00:00:00Z'
const resource = (key: string, type: string, subject: string, role: 'language' | 'original', stamp = V1) => ({
  key, stamp, role, subject, title: key, metadata: meta(key, type, subject, stamp),
})
const row = (layer: PartRow['layer'], key: string, text: string): PartRow => ({ layer, key, value: { content: text } })

let n = 0
const unique = (what: string) => `${what}-${Date.now()}-${n++}`

/**
 * What the Worker serves for a language: an originals list with each book's original, and a language list with each
 * book's notes and the shared titles. `version` changes the notes and titles (new shas), `releases` the release stamps
 * of the notes and words (`v1` unless given), `originals` the originals list (a higher digit is a later release of the
 * original, unless `stamp` says otherwise). The list's `code` stays the build's whatever the content, as the real
 * Worker's does, unless `code` names another.
 */
async function publish(
  w: Worker,
  opts: { language?: string; books: string[]; version?: string; originals?: string; stamp?: string; code?: string; releases?: { tn?: string; tw?: string } },
) {
  const language = opts.language ?? 'es-419'
  const v = opts.version ?? '1'
  const o = opts.originals ?? '1'
  const stamp = opts.stamp ?? `v${o}#2026-10-0${o}T00:00:00Z`
  const orig: PartEntry[] = []
  for (const b of opts.books) orig.push(await w.addPart({ kind: 'original', resource: UGNT, book: b }, [row('sot', `scripture-usj:${UGNT}:${b}:1`, `ugnt ${o} ${b}`)]))
  const originals = {
    schema: 2, language: 'originals', compat: w.compat, code: `orig-${o}`, versions: RESOURCE_VERSIONS,
    resources: [resource(UGNT, 'scripture', 'Greek New Testament', 'original', stamp)], parts: orig,
  } as unknown as PartsList
  const ref = await w.setOriginals(originals)
  const tn = tnOf(language)
  const tw = twOf(language)
  const parts: PartEntry[] = []
  for (const b of opts.books) {
    parts.push(await w.addPart({ kind: 'book', resource: tn, book: b }, [row('sot', `tn:${tn}:${b}`, `${v} ${b}`), row('sot', `tn:${tn}:${b}:1`, `${v} ${b} 1`)]))
  }
  parts.push(await w.addPart({ kind: 'titles', resource: tw }, [row('text', `helps-text:titles:${tw}@v1:all`, `titles ${v}`)]))
  const list = await w.setList(language, parts, {
    ...(opts.code ? { code: opts.code } : {}),
    versions: RESOURCE_VERSIONS,
    resources: [
      resource(tn, 'notes', 'TSV Translation Notes', 'language', opts.releases?.tn),
      resource(tw, 'words', 'Translation Words', 'language', opts.releases?.tw),
    ],
    originals: ref,
    // The stamps the build read: the originals' release among them.
    stamps: { [UGNT]: stamp, [tn]: opts.releases?.tn ?? V1, [tw]: opts.releases?.tw ?? V1 },
  } as Partial<PartsList>)
  return { list, originals, ref, parts, orig }
}

const memoryStorage = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m }
}

const project = (helpsLanguage: string, books: string[], id = `p-${helpsLanguage}`): Project =>
  ({ id, helpsLanguage, books: books.map((code) => ({ code, phase: 'traduccion' })) }) as unknown as Project

/** A device: fake stores, staging, clock, network, typing, and a library that knows a book once it was read again. */
function device(
  w: Worker,
  over: Partial<OnlineDeps> = {},
  keep?: { storage?: ReturnType<typeof memoryStorage>; stores?: ResourceStores; staging?: ReturnType<typeof stagingFrom>; kept?: KeptStore },
) {
  const d = {
    w,
    stores: keep?.stores ?? openResourceStores({ cache: unique('recursos'), catalog: unique('catalogo') }),
    staging: keep?.staging ?? stagingFrom(memoryByteStore()),
    storage: keep?.storage ?? memoryStorage(),
    kept: keep?.kept ?? indexedDbKeptStore(unique('enlinea')),
    clock: Date.parse('2026-10-28T12:00:00Z'),
    online: true,
    typing: false,
    waiting: [] as Array<() => void>,
    free: { quota: 1e12, usage: 0 } as { quota: number; usage: number } | null,
    log: [] as string[],
    here: new Set<string>(),
    /** Books a whole pack brought: here whatever the register says. */
    packed: new Set<string>(),
    applied: [] as ApplyInput[],
    locks: { taken: 0, released: 0 },
    changes: 0,
    stopTyping() {
      d.typing = false
      const runs = d.waiting
      d.waiting = []
      runs.forEach((r) => r())
    },
  }
  setOnlineDeps({
    fetch: w.fetch,
    server: () => w.server,
    compat: () => w.compat,
    stores: () => d.stores,
    staging: () => d.staging,
    storage: d.storage,
    kept: d.kept,
    now: () => d.clock,
    isOnline: () => d.online,
    whenNotTyping: (run) => {
      if (!d.typing) {
        run()
        return () => {}
      }
      d.waiting.push(run)
      return () => void (d.waiting = d.waiting.filter((r) => r !== run))
    },
    isTyping: () => d.typing,
    estimate: async () => d.free ?? {},
    wakeLock: async () => {
      d.locks.taken++
      return { release: async () => void d.locks.released++ }
    },
    bookIsHere: (book) => d.here.has(book),
    refreshLibrary: async () => {
      d.log.push('refreshLibrary')
      const register = await readPartsRegister(d.stores)
      d.here = new Set([...d.packed, ...[...register.keys()].filter((id) => id.startsWith('book:')).map((id) => id.split(':').pop()!)])
    },
    watchHelps: async (_stores, language, books) => {
      d.log.push(`watchHelps ${language} ${books.join(',')}`)
      return []
    },
    keepHelpsChanges: async () => {
      d.log.push('keepHelpsChanges')
      return d.changes ? [{ project: 'p', book: 'tit', changes: Array.from({ length: d.changes }, (_, i) => ({ chapter: 1, verse: i + 1, at: '', notes: [], texts: [] })) }] : []
    },
    applyParts: async (input) => {
      d.log.push('applyParts')
      d.applied.push(input)
      return applyParts(input)
    },
    ...over,
  })
  return d
}

/** The device "reads its library again": a book is here once the register holds its notes and it was read. */
const bookIsHere = (d: ReturnType<typeof device>, book: string) => d.here.has(book)
const slots = async (d: ReturnType<typeof device>) => readPartsRegister(d.stores)
const requests = (w: Worker, kind: 'list' | 'originals' | 'part', language = 'es-419') =>
  w.calls.filter((c) => {
    const path = c.url.slice(w.server.length)
    if (kind === 'part') return path.startsWith('parts/')
    if (kind === 'originals') return path.startsWith(`${w.compat}/originals/`)
    return path === `${w.compat}/${language}`
  })
const staged = async (d: ReturnType<typeof device>) => (await d.staging.list()).map((s) => s.sha)

beforeEach(() => {
  stopOnline()
})
afterEach(() => {
  stopOnline()
})

describe('a book downloaded when the person asks', () => {
  it('a new book is downloaded, applied with its watch around it, and is here after the library is read again', async () => {
    const w = fakeWorker()
    const { parts, orig } = await publish(w, { books: ['tit', 'rut'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    expect(bookIsHere(d, 'tit')).toBe(false)

    const seen: Array<ReturnType<typeof onlineState>> = []
    const off = onOnline((s) => seen.push(s))
    await downloadBook('es-419', 'tit')
    off()

    // Only the book asked for and the shared unit: rut is not downloaded.
    const register = await slots(d)
    expect([...register.values()].map((r) => r.sha256).sort()).toEqual(
      [parts[0].sha256, parts[2].sha256, orig[0].sha256].sort(),
    )
    expect(bookIsHere(d, 'tit')).toBe(true)
    expect(bookIsHere(d, 'rut')).toBe(false)
    // The order of ReceivePack: watch, apply, read the library again, keep what changed.
    expect(d.log).toEqual(['watchHelps es-419 tit', 'applyParts', 'refreshLibrary', 'keepHelpsChanges'])
    // Busy while it lasted, with its book and progress; nothing left busy or blocked.
    expect(seen.some((s) => s.busy?.language === 'es-419' && s.busy.books.includes('tit'))).toBe(true)
    expect(seen.some((s) => s.busy && s.busy.progress.done === s.busy.progress.total && s.busy.progress.total === 3)).toBe(true)
    expect(onlineState()).toMatchObject({ busy: null, blocked: {} })
    // Nothing translated changed: no line.
    expect(onlineState().done).toBeNull()
    // The screen stayed on while it applied, and was let go.
    expect(d.locks).toEqual({ taken: 1, released: 1 })
  })

  it('the size of a book is what its plan downloads, and none for a book the language does not have', async () => {
    const w = fakeWorker()
    const { parts, orig } = await publish(w, { books: ['tit', 'rut'] })
    device(w)
    await startOnline([project('es-419', ['tit'])])
    expect(await bookDownloadSize('es-419', 'tit')).toBe(parts[0].bytes + parts[2].bytes + orig[0].bytes)
    expect(await bookDownloadSize('es-419', 'jon')).toBeNull()
  })
})

describe('updates offered, and applied without getting in the way', () => {
  async function applied() {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    await downloadBook('es-419', 'tit')
    expect(bookIsHere(d, 'tit')).toBe(true)
    expect(onlineState().offer).toBeNull()
    return { w, d }
  }

  it('an offer appears with its bytes and code, and «Bajar» applies it with what changed', async () => {
    const { w, d } = await applied()
    const v2 = await publish(w, { books: ['tit'], version: '2' })
    const partsBefore = requests(w, 'part').length
    await checkForUpdates({ force: true })
    // The notes of tit and the shared titles changed; the originals did not.
    expect(onlineState().offer).toMatchObject({ language: 'es-419', bytes: v2.parts[0].bytes + v2.parts[1].bytes })
    // A check only asks for the lists.
    expect(requests(w, 'part')).toHaveLength(partsBefore)

    d.changes = 3
    await downloadOffer()
    const register = await slots(d)
    expect([...register.values()].map((r) => r.sha256)).toEqual(expect.arrayContaining([v2.parts[0].sha256, v2.parts[1].sha256]))
    expect(onlineState()).toMatchObject({ offer: null, busy: null, done: { language: 'es-419', changedVerses: 3 } })
  })

  it('«Ahora no» hides the offer until something else is offered, though the list keeps its code', async () => {
    const { w, d } = await applied()
    const code = w.lists.get('es-419')!.code
    await publish(w, { books: ['tit'], version: '2' })
    await checkForUpdates({ force: true })
    const first = onlineState().offer!.key
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    declineOffer()
    expect(onlineState().offer).toBeNull()
    expect(JSON.parse(d.storage.getItem('servos.enLinea.ahoraNo')!)).toEqual({ 'es-419': first })
    await checkForUpdates({ force: true })
    expect(onlineState().offer).toBeNull()
    // A new release: the build, and so the list's code, are the same; what is offered is not.
    await publish(w, { books: ['tit'], version: '3' })
    expect(w.lists.get('es-419')!.code).toBe(code)
    await checkForUpdates({ force: true })
    expect(onlineState().offer).toMatchObject({ language: 'es-419' })
    expect(onlineState().offer!.key).not.toBe(first)
  })

  it('never applies while the person types; it applies at the pause (Review Focus 3)', async () => {
    const { w, d } = await applied()
    await publish(w, { books: ['tit'], version: '2' })
    await checkForUpdates({ force: true })
    d.log.length = 0
    d.typing = true
    const running = downloadOffer()
    await vi.waitFor(() => expect(d.waiting).toHaveLength(1))
    // Every part is staged and nothing applied while the person types.
    expect(d.log).toEqual([])
    expect(onlineState().busy?.progress).toMatchObject({ done: 2, total: 2 })
    // A check meanwhile joins the run: no second queue, no list asked.
    const lists = requests(w, 'list').length
    await Promise.race([checkForUpdates({ force: true }), new Promise((r) => setTimeout(r, 20))])
    expect(requests(w, 'list')).toHaveLength(lists)
    expect(d.log).toEqual([])
    d.stopTyping()
    await running
    expect(d.log).toEqual(['watchHelps es-419 tit', 'applyParts', 'refreshLibrary', 'keepHelpsChanges'])
    expect(onlineState().busy).toBeNull()
  })
})

describe('a dropped connection, and one run at a time', () => {
  it('a cut queue leaves what came staged; the next check finishes it, fetching no part twice (Review Focus 2)', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit', 'rut', 'jon'] })
    const d = device(w)
    // The three books came in whole packs: here, without slots.
    d.here = new Set(['tit', 'rut', 'jon'])
    await startOnline([project('es-419', ['tit', 'rut', 'jon'])])
    expect(onlineState().offer?.language).toBe('es-419')
    // The list comes again (a 304), then two parts, then the connection drops.
    w.cutAfter(3)
    await downloadOffer()
    expect((await slots(d)).size).toBe(0)
    expect(await staged(d)).toHaveLength(2)
    // The book says why it did not come (spec §2); nothing waits for it, the next check goes on.
    expect(onlineState()).toMatchObject({ busy: null, blocked: { 'es-419': 'noDisponible' } })
    expect(d.log).not.toContain('applyParts')

    w.online()
    // Within the recheck time: no list is asked again, the wanted download goes on from staging.
    await checkForUpdates()
    expect(onlineState().blocked).toEqual({})
    const register = await slots(d)
    expect(register.size).toBe(7)
    expect(['tit', 'rut', 'jon'].every((b) => bookIsHere(d, b))).toBe(true)
    const shas = requests(w, 'part').map((c) => c.url.slice(c.url.lastIndexOf('/') + 1))
    expect(new Set(shas).size).toBe(shas.length)
    expect(await staged(d)).toEqual([])
    // Applied once, when everything was staged.
    expect(d.log.filter((l) => l === 'applyParts')).toHaveLength(1)
  })

  it('a second check while one runs makes no second queue', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    device(w)
    await startOnline([project('es-419', ['tit'])])
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    w.gate(() => gate)
    w.calls.length = 0
    const first = checkForUpdates({ force: true })
    const second = checkForUpdates({ force: true })
    expect(second).toBe(first)
    open()
    await Promise.all([first, second])
    expect(requests(w, 'list')).toHaveLength(1)

    // Two asks for the same book while it downloads: one queue, each part fetched once.
    w.calls.length = 0
    await Promise.all([downloadBook('es-419', 'tit'), downloadBook('es-419', 'tit')])
    const shas = requests(w, 'part').map((c) => c.url)
    expect(shas).toHaveLength(3)
    expect(new Set(shas).size).toBe(3)
  })

  it('an abort ends the run quietly: nothing applied, nothing blocked', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    w.gate((url) => (url.includes('/parts/') ? gate : Promise.resolve()))
    const running = downloadBook('es-419', 'tit')
    await vi.waitFor(() => expect(w.inFlight).toBeGreaterThan(0))
    stopOnline()
    open()
    await running
    expect((await slots(d)).size).toBe(0)
    expect(onlineState()).toMatchObject({ busy: null, blocked: {} })
  })
})

describe('when it cannot', () => {
  const cases = [
    ['preparando', ANSWERS.preparando],
    ['actualizarApp', ANSWERS.oldCompat],
    ['noDisponible', ANSWERS.nodisponible],
    ['noDisponible', ANSWERS.partsOff],
  ] as const
  for (const [blocked, answer] of cases) {
    it(`a list answered «${blocked}» (${answer.status}) blocks the language and writes nothing`, async () => {
      const w = fakeWorker()
      await publish(w, { books: ['tit'] })
      const d = device(w)
      w.setAnswer('list', answer)
      await startOnline([project('es-419', ['tit'])])
      await downloadBook('es-419', 'tit')
      expect(onlineState().blocked).toEqual({ 'es-419': blocked })
      expect((await slots(d)).size).toBe(0)
      expect(await staged(d)).toEqual([])
      expect(requests(w, 'part')).toEqual([])
    })
  }

  it('a language the Worker has no packs for is «sinIdioma»', async () => {
    const w = fakeWorker()
    const d = device(w)
    await startOnline([project('xx', ['tit'])])
    await downloadBook('xx', 'tit')
    expect(onlineState().blocked).toEqual({ xx: 'sinIdioma' })
    expect((await slots(d)).size).toBe(0)
  })

  it('without room for twice the download, «sinEspacio» and nothing is fetched', async () => {
    const w = fakeWorker()
    const { parts } = await publish(w, { books: ['tit'] })
    const d = device(w)
    d.free = { quota: 1000, usage: 1000 - parts[0].bytes }
    await startOnline([project('es-419', ['tit'])])
    await downloadBook('es-419', 'tit')
    expect(onlineState().blocked).toEqual({ 'es-419': 'sinEspacio' })
    expect(requests(w, 'part')).toEqual([])
    expect((await slots(d)).size).toBe(0)
  })

  it('without a way to ask for free space, it downloads', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w, { estimate: null })
    await startOnline([project('es-419', ['tit'])])
    await downloadBook('es-419', 'tit')
    expect(bookIsHere(d, 'tit')).toBe(true)
  })

  it('a full disk while applying is «sinEspacio»', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w, {
      applyParts: async (input) => ({
        applied: [], completed: [], originalsReplaced: false, bytesApplied: 0,
        failed: input.plan.units.map((unit) => ({ scope: 'unit' as const, unit, reason: 'quota' as const, message: 'full' })),
      }),
    })
    await startOnline([project('es-419', ['tit'])])
    await downloadBook('es-419', 'tit')
    expect(onlineState().blocked).toEqual({ 'es-419': 'sinEspacio' })
    expect((await slots(d)).size).toBe(0)
  })

  it('a list made with other versions is «actualizarApp», and nothing is written to the resources', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const list = w.lists.get('es-419')!
    w.lists.set('es-419', { ...list, versions: { ...RESOURCE_VERSIONS, sot: { usjProcessing: 'other' } } })
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    await downloadBook('es-419', 'tit')
    expect(onlineState().blocked).toEqual({ 'es-419': 'actualizarApp' })
    expect((await slots(d)).size).toBe(0)
    expect(await d.stores.catalog.get(tnOf('es-419'))).toBeFalsy()
  })

  it('a wait the Worker asks for is kept, and no list is asked before it ends', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    w.setAnswer('list', ANSWERS.preparando, 1)
    await startOnline([project('es-419', ['tit'])])
    expect(onlineState().blocked).toEqual({ 'es-419': 'preparando' })
    expect(Object.keys(JSON.parse(d.storage.getItem('servos.enLinea.reintentar')!))).toEqual(['es-419'])
    expect(requests(w, 'list')).toHaveLength(1)

    d.clock += 599_000
    await checkForUpdates({ force: true })
    await downloadBook('es-419', 'tit')
    expect(requests(w, 'list')).toHaveLength(1)
    expect((await slots(d)).size).toBe(0)

    d.clock += 2_000
    await checkForUpdates({ force: true })
    expect(requests(w, 'list')).toHaveLength(2)
    expect(onlineState().blocked).toEqual({})
    // The book asked for during the wait is downloaded once the wait is over: «se intentará otra vez más tarde».
    expect(bookIsHere(d, 'tit')).toBe(true)
    expect(onlineState().offer).toBeNull()
  })

  it('a check within three hours of the last one asks for no list', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    expect(requests(w, 'list')).toHaveLength(1)
    d.clock += RECHECK_MS - 1
    await checkForUpdates()
    expect(requests(w, 'list')).toHaveLength(1)
    d.clock += 1
    await checkForUpdates()
    expect(requests(w, 'list')).toHaveLength(2)
    // Without internet, nothing is asked.
    d.online = false
    d.clock += RECHECK_MS
    await checkForUpdates({ force: true })
    expect(requests(w, 'list')).toHaveLength(2)
  })
})

describe('the originals', () => {
  it('two languages plan the originals once, from the newest originals list (Review Focus 4)', async () => {
    const w = fakeWorker()
    const es = await publish(w, { language: 'es-419', books: ['tit'], originals: '1' })
    const pt = await publish(w, { language: 'pt-br', books: ['tit'], originals: '2' })
    // pt-br's list is fetched after es-419's: its originals list is the newest.
    let tick = Date.parse('2026-10-28T12:00:00Z')
    const d = device(w, { now: () => (tick += 1000) })
    await startOnline([project('es-419', ['tit']), project('pt-br', ['tit'])])
    expect(requests(w, 'originals').map((c) => c.url.split('/').pop())).toEqual([pt.ref.sha256])

    await downloadBook('es-419', 'tit')
    await downloadBook('pt-br', 'tit')
    const register = await slots(d)
    const originals = [...register.values()].filter((r) => r.list === 'originals').map((r) => r.sha256)
    expect(originals).toEqual([pt.orig[0].sha256])
    // The older originals were never asked for, and the newest original was fetched once.
    expect(requests(w, 'originals')).toHaveLength(1)
    const parts = requests(w, 'part').map((c) => c.url.split('/').pop())
    expect(parts).not.toContain(es.orig[0].sha256)
    expect(parts.filter((s) => s === pt.orig[0].sha256)).toHaveLength(1)
  })

  it('an originals list the Worker does not have: its language list is asked again once, then «noDisponible»', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    w.setAnswer('originals', ANSWERS.originalsNoEsta)
    await startOnline([project('es-419', ['tit'])])
    expect(requests(w, 'list')).toHaveLength(2)
    expect(requests(w, 'originals')).toHaveLength(2)
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    expect(requests(w, 'part')).toEqual([])
    expect((await slots(d)).size).toBe(0)
  })

  it('an originals list missing once is found after the language list is asked again', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    w.setAnswer('originals', ANSWERS.originalsNoEsta, 1)
    await startOnline([project('es-419', ['tit'])])
    await downloadBook('es-419', 'tit')
    expect(requests(w, 'originals')).toHaveLength(2)
    expect(bookIsHere(d, 'tit')).toBe(true)
    expect(onlineState().blocked).toEqual({})
  })

  it('an originals list that cannot come waits for the next check; a 429 for its time', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    d.here = new Set(['tit'])
    w.setAnswer('originals', ANSWERS.limite, 1)
    await startOnline([project('es-419', ['tit'])])
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    expect(JSON.parse(d.storage.getItem('servos.enLinea.reintentar')!)).toHaveProperty('originals')
    // During the wait nothing is asked.
    await checkForUpdates({ force: true })
    expect(requests(w, 'originals')).toHaveLength(1)
    d.clock += 31_000
    await checkForUpdates({ force: true })
    expect(requests(w, 'originals')).toHaveLength(2)
    expect(onlineState().offer?.language).toBe('es-419')
  })
})

describe('a part the Worker no longer has', () => {
  it('the list is asked again and planned again, once', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    w.setAnswer('part', ANSWERS.parteNoEsta, 1)
    const lists = requests(w, 'list').length
    await downloadBook('es-419', 'tit')
    // One more for downloadBook, one for the stale part.
    expect(requests(w, 'list')).toHaveLength(lists + 2)
    expect(bookIsHere(d, 'tit')).toBe(true)
  })

  it('still missing after the list was asked again: «noDisponible», with no loop', async () => {
    const w = fakeWorker()
    const { parts } = await publish(w, { books: ['tit'] })
    w.parts.delete(parts[0].sha256)
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    const lists = requests(w, 'list').length
    await downloadBook('es-419', 'tit')
    expect(requests(w, 'list')).toHaveLength(lists + 2)
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    expect((await slots(d)).size).toBe(0)
  })
})

describe('a part gone from staging before it was applied', () => {
  it('is downloaded again, once, and the plan applied', async () => {
    const w = fakeWorker()
    const { parts } = await publish(w, { books: ['tit'] })
    let lost = false
    const d = device(w, {
      applyParts: async (input) => {
        // The first time, a staged part has gone (a browser that cleared it): nothing is applied.
        if (!lost) {
          lost = true
          await input.staging.delete(parts[0].sha256)
        }
        return applyParts(input)
      },
    })
    await startOnline([project('es-419', ['tit'])])
    await downloadBook('es-419', 'tit')
    expect(bookIsHere(d, 'tit')).toBe(true)
    expect(requests(w, 'part').filter((c) => c.url.endsWith(parts[0].sha256))).toHaveLength(2)
    expect(onlineState().blocked).toEqual({})
  })
})

describe('at startup', () => {
  async function kept() {
    const w = fakeWorker()
    const published = await publish(w, { books: ['tit'] })
    const d = device(w)
    // A first visit keeps the list and the originals list; nothing is downloaded.
    await startOnline([project('es-419', ['tit'])])
    expect(await d.kept.all()).toHaveProperty('es-419')
    return { w, d, published }
  }

  it('the heal applies what is fully staged, without internet and without downloading', async () => {
    const { w, d, published } = await kept()
    for (const p of [...published.parts, ...published.orig]) await d.staging.put(p.sha256, w.parts.get(p.sha256)!)
    const again = device(w, {}, d)
    again.online = false
    const before = w.calls.length
    await startOnline([project('es-419', ['tit'])])
    expect(w.calls).toHaveLength(before)
    expect(again.applied).toHaveLength(1)
    expect(again.applied[0].plan.download).toHaveLength(3)
    expect(bookIsHere(again, 'tit')).toBe(true)
  })

  it('the heal with parts still missing applies no unit and asks for nothing', async () => {
    const { w, d, published } = await kept()
    await d.staging.put(published.parts[0].sha256, w.parts.get(published.parts[0].sha256)!)
    const again = device(w, {}, d)
    again.online = false
    const before = w.calls.length
    await startOnline([project('es-419', ['tit'])])
    expect(w.calls).toHaveLength(before)
    expect(again.applied).toHaveLength(1)
    expect((await slots(again)).size).toBe(0)
    expect(again.log).not.toContain('refreshLibrary')
  })
})

describe('the screen stays on only while applying', () => {
  it('the wake lock is let go when applying fails', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w, {
      applyParts: async () => {
        throw new Error('broken store')
      },
    })
    await startOnline([project('es-419', ['tit'])])
    await downloadBook('es-419', 'tit')
    expect(d.locks.taken).toBeGreaterThan(0)
    expect(d.locks.released).toBe(d.locks.taken)
    expect(onlineState().busy).toBeNull()
  })
})

describe('what the Home offer counts', () => {
  it('the shared unit and the books on the device; a missing book has its own size', async () => {
    const w = fakeWorker()
    const { parts, orig } = await publish(w, { books: ['tit', 'jon', 'rut'] })
    const d = device(w)
    // As the example project: Titus and Jonah here, Ruth not.
    d.here = new Set(['tit', 'jon'])
    await startOnline([project('es-419', ['tit', 'jon', 'rut'])])
    const [tit, jon, rut, titles] = parts
    expect(onlineState().offer).toMatchObject({
      language: 'es-419', bytes: tit.bytes + jon.bytes + titles.bytes + orig[0].bytes + orig[1].bytes,
    })
    expect(await bookDownloadSize('es-419', 'rut')).toBe(rut.bytes + titles.bytes + orig[2].bytes)
    await downloadOffer()
    const held = [...(await slots(d)).values()].map((r) => r.sha256)
    expect(held).not.toContain(rut.sha256)
    expect(held).toEqual(expect.arrayContaining([tit.sha256, jon.sha256]))
  })

  it('a book with slots of its language counts as here, whatever the library says', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    expect(onlineState().offer).toBeNull()
    await downloadBook('es-419', 'tit')
    d.here = new Set()
    const v2 = await publish(w, { books: ['tit'], version: '2' })
    await checkForUpdates({ force: true })
    expect(onlineState().offer).toMatchObject({ bytes: v2.parts[0].bytes + v2.parts[1].bytes })
  })
})

describe('the originals never go back', () => {
  const originalsHeld = async (d: ReturnType<typeof device>) =>
    [...(await slots(d)).values()].filter((r) => r.list === 'originals').map((r) => r.sha256)
  const last = (c: { url: string }) => c.url.split('/').pop()

  it('a language refused or waiting still takes part in the choice', async () => {
    const w = fakeWorker()
    const es = await publish(w, { language: 'es-419', books: ['tit'], originals: '2' })
    const pt = await publish(w, { language: 'pt-br', books: ['tit'], originals: '1' })
    const d = device(w)
    await startOnline([project('es-419', ['tit']), project('pt-br', ['tit'])])
    await downloadBook('es-419', 'tit')
    expect(await originalsHeld(d)).toEqual([es.orig[0].sha256])

    // es-419's list is being prepared again (and waits); pt-br, built on the older originals, is downloaded.
    w.setAnswer('list', ANSWERS.preparando, 1)
    await checkForUpdates({ force: true })
    expect(onlineState().blocked).toEqual({ 'es-419': 'preparando' })
    await downloadBook('pt-br', 'tit')
    expect(await originalsHeld(d)).toEqual([es.orig[0].sha256])
    expect(requests(w, 'originals').map(last)).not.toContain(pt.ref.sha256)
    expect(requests(w, 'part').map(last)).not.toContain(pt.orig[0].sha256)
  })

  it('a stale list fetched last does not choose', async () => {
    const w = fakeWorker()
    const es = await publish(w, { language: 'es-419', books: ['tit'], originals: '2' })
    const pt = await publish(w, { language: 'pt-br', books: ['tit'], originals: '1' })
    let tick = Date.parse('2026-10-28T12:00:00Z')
    const d = device(w, { now: () => (tick += 1000) })
    // pt-br's list is asked for last, yet it was built on older originals.
    await startOnline([project('es-419', ['tit']), project('pt-br', ['tit'])])
    expect(requests(w, 'originals').map(last)).toEqual([es.ref.sha256])
    await downloadBook('pt-br', 'tit')
    expect(await originalsHeld(d)).toEqual([es.orig[0].sha256])
    expect(requests(w, 'part').map(last)).not.toContain(pt.orig[0].sha256)
  })

  it('when the newest originals list cannot come now, an older one kept on the device is not used', async () => {
    const w = fakeWorker()
    const pt = await publish(w, { language: 'pt-br', books: ['tit'], originals: '1' })
    const d = device(w)
    // pt-br alone first: its originals list (O1) is kept, and Titus applied with it.
    await startOnline([project('pt-br', ['tit'])])
    await downloadBook('pt-br', 'tit')
    expect(await originalsHeld(d)).toEqual([pt.orig[0].sha256])

    // es-419 comes, built on newer originals (O2) that cannot be had now; pt-br's notes change meanwhile.
    const es = await publish(w, { language: 'es-419', books: ['tit'], originals: '2' })
    const pt2 = await publish(w, { language: 'pt-br', books: ['tit'], originals: '1', version: '2' })
    w.setAnswer('originals', { status: 500, body: 'down', contentType: 'text/plain' })
    setOnlineProjects([project('es-419', ['tit']), project('pt-br', ['tit'])])
    await checkForUpdates({ force: true })
    expect(requests(w, 'originals').map(last)).toContain(es.ref.sha256)
    // O1 is kept and would plan pt-br's update: it is not used, nothing is offered or downloaded.
    expect(onlineState().offer).toBeNull()
    const parts = requests(w, 'part').length
    await downloadBook('pt-br', 'tit')
    expect(requests(w, 'part')).toHaveLength(parts)
    expect([...(await slots(d)).values()].map((r) => r.sha256)).not.toContain(pt2.parts[0].sha256)
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible', 'pt-br': 'noDisponible' })
  })

  it('a stale «noDisponible» goes once the originals come', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    device(w)
    w.setAnswer('originals', { status: 500, body: 'down', contentType: 'text/plain' }, 1)
    await startOnline([project('es-419', ['tit'])])
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    // A check within three hours asks no list; the originals list comes this time.
    await checkForUpdates()
    expect(requests(w, 'list')).toHaveLength(1)
    expect(onlineState().blocked).toEqual({})
  })
})

describe('after the app is updated', () => {
  it('a kept list of another compat is ignored: no plan from it, no «actualice la app»', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const first = device(w)
    await startOnline([project('es-419', ['tit'])])
    // The app was updated: its compat moved, and the kept list is of the old one.
    const again = device(fakeWorker({ compat: 'f2.0-new' }), {}, first)
    again.online = false
    await startOnline([project('es-419', ['tit'])])
    expect(again.applied).toEqual([])
    expect(onlineState().blocked).toEqual({})
    // No usable list: the size cannot be told (not «nothing for this book»).
    expect(await bookDownloadSize('es-419', 'tit')).toBeUndefined()
  })

  it('the heal does not say «actualice la app» for a list made with other versions; the next check decides', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const list = w.lists.get('es-419')!
    w.lists.set('es-419', { ...list, versions: { ...RESOURCE_VERSIONS, sot: { usjProcessing: 'other' } } })
    const first = device(w)
    await startOnline([project('es-419', ['tit'])])
    const again = device(w, {}, first)
    again.online = false
    await startOnline([project('es-419', ['tit'])])
    expect(again.applied).toHaveLength(1)
    expect(onlineState().blocked).toEqual({})
  })
})

describe('typing, and one run at a time (more)', () => {
  it('a check asks for no list while the person types', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    d.typing = true
    const starting = startOnline([project('es-419', ['tit'])])
    await vi.waitFor(() => expect(d.waiting).toHaveLength(1))
    expect(w.calls).toEqual([])
    d.stopTyping()
    await starting
    expect(requests(w, 'list')).toHaveLength(1)
  })

  it('the heal waits while the person types', async () => {
    const w = fakeWorker()
    const published = await publish(w, { books: ['tit'] })
    const first = device(w)
    await startOnline([project('es-419', ['tit'])])
    for (const p of [...published.parts, ...published.orig]) await first.staging.put(p.sha256, w.parts.get(p.sha256)!)
    const again = device(w, {}, first)
    again.online = false
    again.typing = true
    const starting = startOnline([project('es-419', ['tit'])])
    await vi.waitFor(() => expect(again.waiting).toHaveLength(1))
    expect(again.log).toEqual([])
    again.stopTyping()
    await starting
    expect(again.log).toEqual(['watchHelps es-419 tit', 'applyParts', 'refreshLibrary', 'keepHelpsChanges'])
  })

  it('the size of a book waits for the run in flight: nothing is asked beside it', async () => {
    const w = fakeWorker()
    const { parts, orig } = await publish(w, { books: ['tit'] })
    device(w)
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    w.gate(() => gate)
    const starting = startOnline([project('es-419', ['tit'])])
    let size: number | null | undefined
    const sizing = bookDownloadSize('es-419', 'tit').then((s) => (size = s))
    await vi.waitFor(() => expect(w.inFlight).toBe(1))
    await new Promise((r) => setTimeout(r, 20))
    expect(w.calls).toHaveLength(1)
    expect(size).toBeUndefined()
    open()
    await Promise.all([starting, sizing])
    expect(size).toBe(parts[0].bytes + parts[1].bytes + orig[0].bytes)
    expect(requests(w, 'list')).toHaveLength(1)
  })
})

describe('what the queue brings back', () => {
  it('an abort wins over a wait the queue brought back: nothing blocked, no wait kept', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    let partNo = 0
    w.gate((url) => (url.includes('/parts/') && ++partNo > 1 ? gate : Promise.resolve()))
    // The first part is refused with a 429; the others stay in flight until the run is stopped.
    w.setAnswer('part', ANSWERS.limite, 1)
    const running = downloadBook('es-419', 'tit')
    await vi.waitFor(() => expect(partNo).toBe(3))
    await new Promise((r) => setTimeout(r, 20))
    stopOnline()
    open()
    await running
    expect(onlineState().blocked).toEqual({})
    expect(d.storage.getItem('servos.enLinea.reintentar') ?? '{}').not.toContain('es-419')
  })

  it('a full disk while staging is «sinEspacio»', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const full = stagingFrom(memoryByteStore())
    full.put = async () => {
      throw new DOMException('full', 'QuotaExceededError')
    }
    const d = device(w, { staging: () => full })
    await startOnline([project('es-419', ['tit'])])
    await downloadBook('es-419', 'tit')
    expect(onlineState().blocked).toEqual({ 'es-419': 'sinEspacio' })
    expect((await slots(d)).size).toBe(0)
  })

  it('a 429 on a part is «noDisponible», with its wait kept', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    w.setAnswer('part', ANSWERS.limite)
    await downloadBook('es-419', 'tit')
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    expect(JSON.parse(d.storage.getItem('servos.enLinea.reintentar')!)).toHaveProperty('es-419')
  })
})

describe('which kept lists choose the originals', () => {
  const originalsHeld = async (d: ReturnType<typeof device>) =>
    [...(await slots(d)).values()].filter((r) => r.list === 'originals').map((r) => r.sha256)

  it('a list kept from another server is not used: after `?packs=staging`, production plans again', async () => {
    const staging = fakeWorker({ server: 'https://staging.test/v2/packs/' })
    await publish(staging, { language: 'es-419', books: ['tit'], originals: '1' })
    // A test language only staging has, built on the newest originals.
    await publish(staging, { language: 'xx', books: ['tit'], originals: '9' })
    const first = device(staging)
    const both = [project('es-419', ['tit']), project('xx', ['tit'])]
    await startOnline(both)

    // Back to production, which has es-419 (on O1) and neither xx nor O9.
    const production = fakeWorker({ server: 'https://prod.test/v2/packs/' })
    const es = await publish(production, { language: 'es-419', books: ['tit'], originals: '1' })
    const d = device(production, {}, first)
    await startOnline(both)
    await checkForUpdates({ force: true })
    await downloadBook('es-419', 'tit')
    expect(await originalsHeld(d)).toEqual([es.orig[0].sha256])
    expect(d.here.has('tit')).toBe(true)
    expect(onlineState().blocked).toEqual({ xx: 'sinIdioma' })
  })

  it('a list kept for a language no project reads any more does not choose', async () => {
    const w = fakeWorker()
    const es = await publish(w, { language: 'es-419', books: ['tit'], originals: '1' })
    const xx = await publish(w, { language: 'xx', books: ['tit'], originals: '9' })
    const d = device(w)
    await startOnline([project('es-419', ['tit']), project('xx', ['tit'])])
    // The xx project is gone, and the Worker no longer has xx nor its originals.
    w.lists.delete('xx')
    w.originals.delete(xx.ref.sha256)
    setOnlineProjects([project('es-419', ['tit'])])
    // A new device session: what the last one fetched of O9 is not kept, only its list.
    const xxKept = (await d.kept.all()).xx
    delete xxKept.originals
    await d.kept.put('xx', xxKept)
    const again = device(w, {}, d)
    await startOnline([project('es-419', ['tit'])])
    await downloadBook('es-419', 'tit')
    expect(await originalsHeld(again)).toEqual([es.orig[0].sha256])
  })

  it('a language list answered «sinIdioma» is forgotten', async () => {
    const w = fakeWorker()
    await publish(w, { language: 'xx', books: ['tit'] })
    const d = device(w)
    await startOnline([project('xx', ['tit'])])
    expect(await d.kept.all()).toHaveProperty('xx')
    w.lists.delete('xx')
    await checkForUpdates({ force: true })
    expect(onlineState().blocked).toEqual({ xx: 'sinIdioma' })
    expect(await d.kept.all()).not.toHaveProperty('xx')
    d.online = false
    expect(await bookDownloadSize('xx', 'tit')).toBeUndefined()
  })

  it('an originals list gone whose language list is then refused says «noDisponible» to the others', async () => {
    const w = fakeWorker()
    const es = await publish(w, { language: 'es-419', books: ['tit'], originals: '2' })
    await publish(w, { language: 'pt-br', books: ['tit'], originals: '1' })
    w.originals.delete(es.ref.sha256)
    device(w)
    // es-419's list is asked for again after the 404, and is being prepared.
    let lists = 0
    w.gate(async (url) => {
      if (url.endsWith('/es-419') && ++lists === 2) w.setAnswer('list', ANSWERS.preparando, 1)
    })
    await startOnline([project('es-419', ['tit']), project('pt-br', ['tit'])])
    expect(onlineState().blocked).toEqual({ 'es-419': 'preparando', 'pt-br': 'noDisponible' })
  })
})

describe('staging keeps only what a list still names', () => {
  /** A part no list names, staged: what a download cut before the lists moved on leaves behind. */
  async function stray(d: ReturnType<typeof device>, text = 'stray') {
    const made = await writePart([row('sot', `tn:o/xx/tn:tit:${text}`, text)])
    await d.staging.put(made.sha256, made.bytes)
    return made.sha256
  }

  it('a part named by no list is deleted after an apply', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    const sha = await stray(d)
    await downloadBook('es-419', 'tit')
    expect(bookIsHere(d, 'tit')).toBe(true)
    expect(await staged(d)).not.toContain(sha)
  })

  it('a part named by another project language\'s kept list is kept', async () => {
    const w = fakeWorker()
    await publish(w, { language: 'es-419', books: ['tit'] })
    const pt = await publish(w, { language: 'pt-br', books: ['tit'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit']), project('pt-br', ['tit'])])
    // pt-br's notes of Titus came before the download was cut.
    await d.staging.put(pt.parts[0].sha256, w.parts.get(pt.parts[0].sha256)!)
    const sha = await stray(d)
    await downloadBook('es-419', 'tit')
    expect(await staged(d)).toContain(pt.parts[0].sha256)
    expect(await staged(d)).not.toContain(sha)
  })

  it('the startup heal prunes, without internet, from the lists kept', async () => {
    const w = fakeWorker()
    const published = await publish(w, { books: ['tit'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    // A part of the kept list, staged and not applied (its unit lacks its original), stays for the next check.
    await d.staging.put(published.parts[0].sha256, w.parts.get(published.parts[0].sha256)!)
    const sha = await stray(d)
    const again = device(w, {}, d)
    again.online = false
    await startOnline([project('es-419', ['tit'])])
    expect(await staged(again)).toEqual([published.parts[0].sha256])
    expect(sha).not.toBe(published.parts[0].sha256)
  })

  it('nothing is pruned when no usable list is kept: offline at the first launch, or lists of another server', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    d.online = false
    const sha = await stray(d)
    await startOnline([project('es-419', ['tit'])])
    expect(await staged(d)).toEqual([sha])

    // Lists kept from another Worker (`?packs=staging`) name nothing this one can use.
    d.online = true
    await startOnline([project('es-419', ['tit'])])
    const again = device(w, { server: () => 'https://other.test/v2/packs/' }, d)
    again.online = false
    await startOnline([project('es-419', ['tit'])])
    expect(await staged(again)).toEqual([sha])
  })

  it('prune never runs while a queue runs', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    const sha = await stray(d)
    // Every delete from staging is seen with the requests in flight at that moment.
    const deletes: number[] = []
    const remove = d.staging.delete.bind(d.staging)
    d.staging.delete = async (s) => {
      deletes.push(w.inFlight)
      return remove(s)
    }
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    w.gate((url) => (url.includes('/parts/') ? gate : Promise.resolve()))
    const running = downloadBook('es-419', 'tit')
    await vi.waitFor(() => expect(w.inFlight).toBeGreaterThan(0))
    // A check asked meanwhile joins the run; nothing is pruned under the queue.
    const joined = checkForUpdates({ force: true })
    await new Promise((r) => setTimeout(r, 20))
    expect(await staged(d)).toContain(sha)
    expect(deletes).toEqual([])
    open()
    await Promise.all([running, joined])
    expect(await staged(d)).not.toContain(sha)
    expect(deletes.length).toBeGreaterThan(0)
    expect(deletes.every((inFlight) => inFlight === 0)).toBe(true)
  })
})

describe('the size of a book: nothing for it, or cannot be told now (Task 7, fix round 1)', () => {
  it('unknown before any list while offline; with the list, a number, or null for a book it does not name', async () => {
    const w = fakeWorker()
    const { parts, orig } = await publish(w, { books: ['tit'] })
    const d = device(w)
    setOnlineProjects([project('es-419', ['tit'])])
    d.online = false
    expect(await bookDownloadSize('es-419', 'tit')).toBeUndefined()
    expect(w.calls).toEqual([])
    d.online = true
    expect(await bookDownloadSize('es-419', 'tit')).toBe(parts[0].bytes + parts[1].bytes + orig[0].bytes)
    expect(await bookDownloadSize('es-419', 'rut')).toBeNull()
  })

  it('unknown while the list waits for its Retry-After, asking nothing; told once the wait is over', async () => {
    const w = fakeWorker()
    const { parts, orig } = await publish(w, { books: ['tit'] })
    const d = device(w)
    setOnlineProjects([project('es-419', ['tit'])])
    w.setAnswer('list', ANSWERS.nodisponible, 1)
    await checkForUpdates({ force: true })
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    w.calls.length = 0
    expect(await bookDownloadSize('es-419', 'tit')).toBeUndefined()
    expect(w.calls).toEqual([])
    d.clock += 301_000
    expect(await bookDownloadSize('es-419', 'tit')).toBe(parts[0].bytes + parts[1].bytes + orig[0].bytes)
  })

  it('unknown while the originals cannot be chosen (before the projects are known), told once they are', async () => {
    const w = fakeWorker()
    const { parts, orig } = await publish(w, { books: ['tit'] })
    device(w)
    expect(await bookDownloadSize('es-419', 'tit')).toBeUndefined()
    expect(requests(w, 'list')).toHaveLength(1)
    setOnlineProjects([project('es-419', ['tit'])])
    expect(await bookDownloadSize('es-419', 'tit')).toBe(parts[0].bytes + parts[1].bytes + orig[0].bytes)
    expect(requests(w, 'list')).toHaveLength(1)
  })

  it('unknown when the originals list cannot be fetched now', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    device(w)
    setOnlineProjects([project('es-419', ['tit'])])
    w.setAnswer('originals', ANSWERS.red, 1)
    expect(await bookDownloadSize('es-419', 'tit')).toBeUndefined()
  })

  it('what a size depends on moves the version; a size that changes nothing does not (no asking in a loop)', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    device(w)
    const before = onlineState().version
    setOnlineProjects([project('es-419', ['tit'])])
    const projects = onlineState().version
    expect(projects).toBeGreaterThan(before)
    await bookDownloadSize('es-419', 'tit')
    const listed = onlineState().version
    expect(listed).toBeGreaterThan(projects)
    await bookDownloadSize('es-419', 'tit')
    await bookDownloadSize('es-419', 'rut')
    expect(onlineState().version).toBe(listed)
  })

  it('one ask in flight per book; several books asked together are all answered, asking nothing twice', async () => {
    const w = fakeWorker()
    const { parts, orig } = await publish(w, { books: ['tit', 'rut', 'jon'] })
    device(w)
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    w.gate(() => gate)
    const starting = startOnline([project('es-419', ['tit'])])
    await vi.waitFor(() => expect(w.inFlight).toBe(1))
    const tit = bookDownloadSize('es-419', 'tit')
    expect(bookDownloadSize('es-419', 'tit')).toBe(tit)
    const rut = bookDownloadSize('es-419', 'rut')
    const jon = bookDownloadSize('es-419', 'jon')
    expect(bookDownloadSize('es-419', 'jon')).toBe(jon)
    open()
    await starting
    expect(await Promise.all([tit, rut, jon])).toEqual([
      parts[0].bytes + parts[3].bytes + orig[0].bytes,
      parts[1].bytes + parts[3].bytes + orig[1].bytes,
      parts[2].bytes + parts[3].bytes + orig[2].bytes,
    ])
    expect(requests(w, 'list')).toHaveLength(1)
    expect(requests(w, 'originals')).toHaveLength(1)
    // Answered, an ask is asked anew (the next one may know more).
    expect(bookDownloadSize('es-419', 'tit')).not.toBe(tit)
  })
})

describe('switching the server (Task 7, fix round 1)', () => {
  it('forgets the waits, the last check and the blocks, and asks the new server after the run in flight', async () => {
    const prod = fakeWorker()
    const staging = fakeWorker({ server: 'https://staging.test/v2/packs/' })
    await publish(prod, { books: ['tit'] })
    await publish(staging, { books: ['tit'] })
    let server = prod
    const d = device(prod, {
      server: () => server.server,
      fetch: ((input: RequestInfo | URL, init?: RequestInit) =>
        (String(input).startsWith(staging.server) ? staging : prod).fetch(input, init)) as typeof fetch,
    })
    prod.setAnswer('list', ANSWERS.nodisponible, 1)
    await startOnline([project('es-419', ['tit'])])
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    expect(JSON.parse(d.storage.getItem('servos.enLinea.reintentar')!)).toHaveProperty('es-419')
    expect(d.storage.getItem('servos.enLinea.buscado')).toBeTruthy()

    // A download in flight when the server changes: the check is not swallowed by it.
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    prod.gate(() => gate)
    const downloading = downloadBook('xx', 'tit')
    await vi.waitFor(() => expect(prod.inFlight).toBe(1))
    server = staging
    const switched = choosePacksServer('staging')
    expect(onlineState().blocked).toEqual({})
    expect(JSON.parse(d.storage.getItem('servos.enLinea.reintentar')!)).toEqual({})
    expect(d.storage.getItem('servos.enLinea.buscado')).toBeFalsy()
    open()
    await Promise.all([downloading, switched])
    expect(requests(staging, 'list')).toHaveLength(1)
    expect(onlineState().blocked['es-419']).toBeUndefined()
    expect(d.storage.getItem('servos.enLinea.buscado')).toBeTruthy()
  })
})

describe('a pack opened while Servos online works (Task 8)', () => {
  /** What `openPack` does to the register before it writes: the slots of what the pack brings are forgotten. */
  const forget = (d: ReturnType<typeof device>, slot: (id: string) => boolean) =>
    d.stores.cache.transactRaw!({ keys: [], prefixes: [REGISTER_PREFIX] }, (found) => ({
      puts: [],
      deletes: (found.prefixKeys.get(REGISTER_PREFIX) ?? []).filter((key) => slot(key.slice(REGISTER_PREFIX.length))),
    }))

  it('a pack opens while a queue runs, without waiting for it', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    setOnlineProjects([project('es-419', ['tit'])])
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    w.gate((url) => (url.includes('/parts/') ? gate : Promise.resolve()))
    const downloading = downloadBook('es-419', 'tit')
    await vi.waitFor(() => expect(w.inFlight).toBeGreaterThan(0))
    await whileOnlineIdle(async () => void d.log.push('pack'))
    expect(d.log).toEqual(['pack'])
    open()
    await downloading
    expect(d.log).toContain('applyParts')
    expect(bookIsHere(d, 'tit')).toBe(true)
  })

  it('the apply plans again under the lock: a slot a pack forgot during the queue is planned, not passed over', async () => {
    const w = fakeWorker()
    const { parts } = await publish(w, { books: ['tit', 'rut'] })
    const titles = parts[2]
    const d = device(w)
    await startOnline([project('es-419', ['tit', 'rut'])])
    await downloadBook('es-419', 'tit')
    expect([...(await slots(d)).values()].map((r) => r.sha256)).toContain(titles.sha256)

    // Ruth comes; while its parts come, a pack that brings the titles of another release is opened.
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    w.gate((url) => (url.includes('/parts/') ? gate : Promise.resolve()))
    d.applied.length = 0
    w.calls.length = 0
    const downloading = downloadBook('es-419', 'rut')
    await vi.waitFor(() => expect(requests(w, 'part').length).toBeGreaterThan(0))
    // The queue was planned before the pack: Ruth's parts only, the titles held.
    expect(requests(w, 'part').map((c) => c.url.split('/').pop())).not.toContain(titles.sha256)
    await whileOnlineIdle(async () => {
      await forget(d, (id) => id.startsWith('titles:'))
      const tw = w.lists.get('es-419')!.resources.find((r) => r.key === twOf('es-419'))!
      await d.stores.catalog.set(tw.key, meta(tw.key, 'words', 'Translation Words', 'v0#2026-09-01T00:00:00Z'))
    })
    open()
    await downloading

    // The first apply's plan is made after the pack: it needs the titles again (not staged, so nothing is applied
    // and they are downloaded); the next applies Ruth and the titles.
    expect(d.applied[0].plan.download.map((p) => p.sha256)).toContain(titles.sha256)
    expect(d.applied.at(-1)!.plan.download.map((p) => p.sha256)).toEqual(expect.arrayContaining([titles.sha256, parts[1].sha256]))
    const held = [...(await slots(d)).values()].map((r) => r.sha256)
    expect(held).toEqual(expect.arrayContaining([titles.sha256, parts[1].sha256]))
    expect(bookIsHere(d, 'rut')).toBe(true)
  })

  it('an apply in flight still delays the opening', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    const d = device(w, {
      applyParts: async (input) => {
        d.log.push('applyParts')
        await gate
        const result = await applyParts(input)
        d.log.push('applied')
        return result
      },
    })
    setOnlineProjects([project('es-419', ['tit'])])
    const downloading = downloadBook('es-419', 'tit')
    await vi.waitFor(() => expect(d.log).toContain('applyParts'))
    const opening = whileOnlineIdle(async () => void d.log.push('pack'))
    await new Promise((r) => setTimeout(r, 20))
    expect(d.log).not.toContain('pack')
    open()
    await Promise.all([downloading, opening])
    // Everything the apply does (the library read again, what changed kept) comes before the pack.
    expect(d.log.indexOf('pack')).toBeGreaterThan(d.log.indexOf('keepHelpsChanges'))
  })

  it('a download asked during an opening fetches its parts, and applies only once the opening ends', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    setOnlineProjects([project('es-419', ['tit'])])
    let ending!: () => void
    const importing = new Promise<void>((r) => (ending = r))
    const opening = whileOnlineIdle(async () => {
      d.log.push('pack')
      await importing
      d.log.push('pack opened')
    })
    const downloading = downloadBook('es-419', 'tit')
    await vi.waitFor(async () => expect(await staged(d)).toHaveLength(3))
    await new Promise((r) => setTimeout(r, 20))
    expect(d.log).toEqual(['pack'])
    ending()
    await Promise.all([opening, downloading])
    expect(d.log.slice(0, 3)).toEqual(['pack', 'pack opened', 'watchHelps es-419 tit'])
    expect(bookIsHere(d, 'tit')).toBe(true)
  })
})

describe('small guards (Task 8)', () => {
  it('a list the app cannot plan from (another compat) moves no version: a size screen does not ask again and again', async () => {
    const w = fakeWorker()
    const { parts } = await publish(w, { books: ['tit'] })
    await w.setList('es-419', parts, { compat: 'f9.9-other' } as Partial<PartsList>)
    device(w)
    setOnlineProjects([project('es-419', ['tit'])])
    const before = onlineState().version
    expect(await bookDownloadSize('es-419', 'tit')).toBeUndefined()
    expect(requests(w, 'list')).toHaveLength(1)
    expect(onlineState().version).toBe(before)
  })

  it('a check before the projects are known is not the last check: the first real one asks for the lists', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    await checkForUpdates({ force: true })
    expect(d.storage.getItem('servos.enLinea.buscado')).toBeNull()
    await startOnline([project('es-419', ['tit'])])
    expect(requests(w, 'list')).toHaveLength(1)
  })
})

describe('waits and blocks agree (final review, I1)', () => {
  it('a restart inside a `parts-off` wait shows the notice, not a silent «Bajar»', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const first = device(w)
    w.setAnswer('list', ANSWERS.partsOff)
    await startOnline([project('es-419', ['tit'])])
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    expect(JSON.parse(first.storage.getItem('servos.enLinea.reintentar')!)['es-419']).toMatchObject({ reason: 'noDisponible' })

    // The app is closed and opened again an hour later... minus a minute: the wait (an hour) still holds.
    const again = device(w, {}, first)
    again.clock += 59 * 60_000
    const lists = requests(w, 'list').length
    await startOnline([project('es-419', ['tit'])])
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    expect(requests(w, 'list')).toHaveLength(lists)
    expect(await bookDownloadSize('es-419', 'tit')).toBeUndefined()
  })

  it('a 202 with Retry-After 600 is asked again after 600 s, not after three hours', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    w.setAnswer('list', ANSWERS.preparando, 1)
    await startOnline([project('es-419', ['tit'])])
    expect(onlineState().blocked).toEqual({ 'es-419': 'preparando' })
    expect(nextWaitEnd()).toBe(d.clock + 600_000)
    d.clock += 300_000
    await checkForUpdates()
    expect(requests(w, 'list')).toHaveLength(1)
    d.clock += 301_000
    await checkForUpdates()
    expect(requests(w, 'list')).toHaveLength(2)
    expect(onlineState().blocked).toEqual({})
    expect(nextWaitEnd()).toBeNull()
  })

  it('a time saved in the future (a clock set back) is ignored', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const storage = memoryStorage()
    const now = Date.parse('2026-10-28T12:00:00Z')
    // A wait of two days, saved the old way (an ISO time), and a last check tomorrow.
    storage.setItem('servos.enLinea.reintentar', JSON.stringify({ 'es-419': new Date(now + 2 * 86_400_000).toISOString() }))
    storage.setItem('servos.enLinea.buscado', new Date(now + 86_400_000).toISOString())
    device(w, {}, { storage })
    await startOnline([project('es-419', ['tit'])])
    expect(requests(w, 'list')).toHaveLength(1)
    expect(onlineState().blocked).toEqual({})
  })

  it('a size worked out does not lift another language\'s «noDisponible»', async () => {
    const w = fakeWorker()
    await publish(w, { language: 'es-419', books: ['tit'] })
    await publish(w, { language: 'pt-br', books: ['tit'] })
    device(w)
    await startOnline([project('es-419', ['tit']), project('pt-br', ['tit'])])
    // es-419's download is cut: «noDisponible», with no wait.
    w.cutAfter(2)
    await downloadBook('es-419', 'tit')
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    w.online()
    expect(await bookDownloadSize('pt-br', 'tit')).toBeGreaterThan(0)
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
  })
})

/** What a whole pack of these lists leaves: its books here, the catalog rows of their releases, and no slot. */
async function wholePack(d: ReturnType<typeof device>, published: { list: PartsList; originals: PartsList }, books: string[]) {
  for (const r of [...published.list.resources, ...published.originals.resources]) {
    await d.stores.catalog.set(r.key, r.metadata as Record<string, unknown>)
  }
  d.packed = new Set(books)
  d.here = new Set(books)
}

describe('only what differs is downloaded again (final review, I2; spec §3 «con internet y algo distinto»)', () => {
  const last = (c: { url: string }) => c.url.split('/').pop()

  it('after whole packs of the same release nothing is offered, and a missing book still downloads alone', async () => {
    const w = fakeWorker()
    const v1 = await publish(w, { books: ['tit', 'jon', 'rut'] })
    const d = device(w)
    await wholePack(d, v1, ['tit', 'jon'])
    await startOnline([project('es-419', ['tit', 'jon', 'rut'])])
    expect(onlineState().offer).toBeNull()
    expect(requests(w, 'part')).toEqual([])

    // Ruth is not here: its notes and original come; the titles, of the release on the device, do not.
    const [, , rut, titles] = v1.parts
    expect(await bookDownloadSize('es-419', 'rut')).toBe(rut.bytes + v1.orig[2].bytes)
    await downloadBook('es-419', 'rut')
    expect(requests(w, 'part').map(last).sort()).toEqual([rut.sha256, v1.orig[2].sha256].sort())
    expect(requests(w, 'part').map(last)).not.toContain(titles.sha256)
    expect(bookIsHere(d, 'rut')).toBe(true)
  })

  it('a newer release of one resource offers only the units that have it', async () => {
    const w = fakeWorker()
    const v1 = await publish(w, { books: ['tit', 'jon'] })
    const d = device(w)
    await wholePack(d, v1, ['tit', 'jon'])
    await startOnline([project('es-419', ['tit', 'jon'])])
    expect(onlineState().offer).toBeNull()

    // A new build: every part has new bytes, but only the words have a new release. Only the shared unit has them.
    const v2 = await publish(w, { books: ['tit', 'jon'], version: '2', releases: { tw: 'v2#2026-10-02T00:00:00Z' } })
    await checkForUpdates({ force: true })
    expect(onlineState().offer).toMatchObject({ language: 'es-419', bytes: v2.parts[2].bytes })
    await downloadOffer()
    expect(requests(w, 'part').map(last)).toEqual([v2.parts[2].sha256])

    // Then the notes: both books, whole (a unit is planned as one, its original with it).
    const v3 = await publish(w, { books: ['tit', 'jon'], version: '3', releases: { tn: 'v2#2026-10-02T00:00:00Z', tw: 'v2#2026-10-02T00:00:00Z' } })
    await checkForUpdates({ force: true })
    // The titles were applied from parts: their slot holds v2, so v3's new bytes are an update too.
    const [tit, jon, titles] = v3.parts
    expect(onlineState().offer).toMatchObject({ bytes: tit.bytes + jon.bytes + titles.bytes + v3.orig[0].bytes + v3.orig[1].bytes })
  })

  it('a size leaves out the parts already staged (M5)', async () => {
    const w = fakeWorker()
    const { parts, orig } = await publish(w, { books: ['tit'] })
    const d = device(w)
    setOnlineProjects([project('es-419', ['tit'])])
    await d.staging.put(parts[0].sha256, w.parts.get(parts[0].sha256)!)
    expect(await bookDownloadSize('es-419', 'tit')).toBe(parts[1].bytes + orig[0].bytes)
  })
})

describe('the lists are kept in IndexedDB (final review, I3)', () => {
  it('a list is kept in its own database, not in localStorage, and plans without internet the next time', async () => {
    const w = fakeWorker()
    const published = await publish(w, { books: ['tit'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit'])])
    expect(Object.keys(await d.kept.all())).toEqual(['es-419'])
    expect([...d.storage.m.keys()].filter((k) => k.startsWith('servos.enLinea.'))).not.toContain('servos.enLinea.listas')
    expect(d.storage.m.get('servos.enLinea.listas')).toBeUndefined()
    for (const p of [...published.parts, ...published.orig]) await d.staging.put(p.sha256, w.parts.get(p.sha256)!)
    const again = device(w, {}, d)
    again.online = false
    await startOnline([project('es-419', ['tit'])])
    expect(bookIsHere(again, 'tit')).toBe(true)
  })

  it('lists an earlier version kept in localStorage are moved over once, and the key goes', async () => {
    const w = fakeWorker()
    const published = await publish(w, { books: ['tit'] })
    const first = device(w)
    await startOnline([project('es-419', ['tit'])])
    // As an earlier version kept them.
    const storage = memoryStorage()
    storage.setItem('servos.enLinea.listas', JSON.stringify(await first.kept.all()))
    for (const p of [...published.parts, ...published.orig]) await first.staging.put(p.sha256, w.parts.get(p.sha256)!)
    const again = device(w, {}, { storage, stores: first.stores, staging: first.staging })
    again.online = false
    await startOnline([project('es-419', ['tit'])])
    expect(bookIsHere(again, 'tit')).toBe(true)
    expect(storage.getItem('servos.enLinea.listas')).toBeNull()
    expect(Object.keys(await again.kept.all())).toEqual(['es-419'])
  })

  it('the list of a language no project reads goes, but never while a run is going', async () => {
    const w = fakeWorker()
    await publish(w, { language: 'es-419', books: ['tit'] })
    await publish(w, { language: 'pt-br', books: ['tit'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit']), project('pt-br', ['tit'])])
    expect(Object.keys(await d.kept.all()).sort()).toEqual(['es-419', 'pt-br'])

    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    w.gate((url) => (url.includes('/parts/') ? gate : Promise.resolve()))
    const downloading = downloadBook('pt-br', 'tit')
    await vi.waitFor(() => expect(w.inFlight).toBeGreaterThan(0))
    setOnlineProjects([project('es-419', ['tit'])])
    await new Promise((r) => setTimeout(r, 20))
    expect(await d.kept.all()).toHaveProperty('pt-br')
    open()
    await downloading
    await vi.waitFor(async () => expect(Object.keys(await d.kept.all())).toEqual(['es-419']))
  })
})

describe('typing, once more (final review, I4)', () => {
  it('typing that starts while the apply waits for the lock makes it wait again, without the lock', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w)
    setOnlineProjects([project('es-419', ['tit'])])
    let ending!: () => void
    const importing = new Promise<void>((r) => (ending = r))
    const opening = whileOnlineIdle(async () => {
      await importing
    })
    const downloading = downloadBook('es-419', 'tit')
    await vi.waitFor(async () => expect(await staged(d)).toHaveLength(3))
    await new Promise((r) => setTimeout(r, 20))
    // The person starts typing; then the pack's opening ends.
    d.typing = true
    ending()
    await opening
    await vi.waitFor(() => expect(d.waiting).toHaveLength(1))
    expect(d.log).not.toContain('applyParts')
    // Not holding the lock while it waits: another opening goes at once.
    let opened = false
    await whileOnlineIdle(async () => void (opened = true))
    expect(opened).toBe(true)
    d.stopTyping()
    await downloading
    expect(d.log).toContain('applyParts')
    expect(bookIsHere(d, 'tit')).toBe(true)
  })
})

describe('small things of the final review', () => {
  it('the heal applies on its own a book fully staged, though another is missing parts (M1)', async () => {
    const w = fakeWorker()
    const published = await publish(w, { books: ['tit', 'rut'] })
    const first = device(w)
    await startOnline([project('es-419', ['tit', 'rut'])])
    // Titus came whole (its notes, its original, the shared titles); the app closed before its apply. Ruth: nothing.
    const [tit, , titles] = published.parts
    for (const p of [tit, titles, published.orig[0]]) await first.staging.put(p.sha256, w.parts.get(p.sha256)!)
    const again = device(w, {}, first)
    again.online = false
    await startOnline([project('es-419', ['tit', 'rut'])])
    expect(w.calls.filter((c) => c.url.includes('/parts/'))).toEqual([])
    expect(bookIsHere(again, 'tit')).toBe(true)
    expect(bookIsHere(again, 'rut')).toBe(false)
  })

  it('a book taken out of the projects is no longer wanted (M6)', async () => {
    const w = fakeWorker()
    const { parts } = await publish(w, { books: ['tit', 'rut'] })
    const d = device(w)
    await startOnline([project('es-419', ['tit', 'rut'])])
    // Ruth's download is cut after the list.
    w.cutAfter(1)
    await downloadBook('es-419', 'rut')
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    w.online()
    setOnlineProjects([project('es-419', ['tit'])])
    w.calls.length = 0
    await checkForUpdates()
    expect(requests(w, 'part').map((c) => c.url)).not.toContain(`${w.server}parts/${parts[1].sha256}`)
    expect(bookIsHere(d, 'rut')).toBe(false)
  })

  it('a unit that fails three times in a session (not for room) is no longer wanted (M6)', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const d = device(w, {
      applyParts: async (input) => {
        d.applied.push(input)
        return {
          applied: [], completed: [], originalsReplaced: false, bytesApplied: 0,
          failed: input.plan.units.map((unit) => ({ scope: 'unit' as const, unit, reason: 'error' as const, message: 'broken' })),
        }
      },
    })
    await startOnline([project('es-419', ['tit'])])
    await downloadBook('es-419', 'tit')
    for (let i = 0; i < 5; i++) await checkForUpdates()
    expect(d.applied).toHaveLength(3)
    // Asked for again, it is tried again.
    await downloadBook('es-419', 'tit')
    expect(d.applied).toHaveLength(4)
  })
})

describe('deps given without `isTyping` (the real Worker test, after F1)', () => {
  it('an apply asks the given `whenNotTyping` whether someone types, and never a page that is not there', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const stores = openResourceStores({ cache: unique('recursos'), catalog: unique('catalogo') })
    const staging = stagingFrom(memoryByteStore())
    let typing = false
    let waiting: Array<() => void> = []
    // As realWorker.test.ts gives them: `whenNotTyping`, and no `isTyping`; no `document` in Node.
    setOnlineDeps({
      fetch: w.fetch,
      server: () => w.server,
      compat: () => w.compat,
      stores: () => stores,
      staging: () => staging,
      storage: memoryStorage(),
      kept: indexedDbKeptStore(unique('enlinea')),
      isOnline: () => true,
      whenNotTyping: (run) => {
        if (!typing) {
          run()
          return () => {}
        }
        waiting.push(run)
        return () => void (waiting = waiting.filter((r) => r !== run))
      },
      estimate: null,
      wakeLock: async () => null,
      bookIsHere: () => false,
      refreshLibrary: async () => {},
      watchHelps: async () => [],
      keepHelpsChanges: async () => [],
      applyParts,
    })
    setOnlineProjects([project('es-419', ['tit'])])
    await downloadBook('es-419', 'tit')
    expect([...(await readPartsRegister(stores)).keys()].some((id) => id.startsWith('book:') && id.endsWith(':tit'))).toBe(true)
    expect(onlineState().blocked).toEqual({})

    // The same `whenNotTyping` says when someone types: an update staged then waits for the pause.
    await publish(w, { books: ['tit'], version: '2' })
    await checkForUpdates({ force: true })
    typing = true
    const running = downloadOffer()
    await vi.waitFor(() => expect(waiting).toHaveLength(1))
    typing = false
    waiting.splice(0).forEach((r) => r())
    await running
    expect(onlineState().offer).toBeNull()
  })
})

describe('the final re-review of F1', () => {
  const last = (c: { url: string }) => c.url.split('/').pop()

  it('a book downloaded in a new release does not make the books a pack brought look current (Important)', async () => {
    const w = fakeWorker()
    const v1 = await publish(w, { books: ['tit', 'jon', 'rut'] })
    const d = device(w)
    // The bundled pack: Titus and Jonah at tn v1.
    await wholePack(d, v1, ['tit', 'jon'])
    await startOnline([project('es-419', ['tit', 'jon'])])
    expect(onlineState().offer).toBeNull()
    // The Worker publishes tn v2: Home offers Titus and Jonah.
    const v2 = await publish(w, { books: ['tit', 'jon', 'rut'], version: '2', releases: { tn: 'v2#2026-10-02T00:00:00Z' } })
    await checkForUpdates({ force: true })
    const [tit, jon, rut] = v2.parts
    const offered = tit.bytes + jon.bytes + v2.orig[0].bytes + v2.orig[1].bytes
    expect(onlineState().offer).toMatchObject({ bytes: offered })
    // The person adds Ruth instead: B writes tn's catalog row as v2.
    setOnlineProjects([project('es-419', ['tit', 'jon', 'rut'])])
    await downloadBook('es-419', 'rut')
    expect(requests(w, 'part').map(last)).toContain(rut.sha256)
    const v2Row = meta(tnOf('es-419'), 'notes', 'TSV Translation Notes', 'v2#2026-10-02T00:00:00Z')
    expect(resourceContentStamp(await d.stores.catalog.get(tnOf('es-419')))).toBe(resourceContentStamp(v2Row))
    // Titus and Jonah are still v1 here: still offered.
    await checkForUpdates({ force: true })
    expect(onlineState().offer).toMatchObject({ bytes: offered })
  })

  it('a block kept with its wait shows as soon as the projects are known, before startOnline (minor)', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const storage = memoryStorage()
    const now = Date.parse('2026-10-28T12:00:00Z')
    storage.setItem('servos.enLinea.reintentar', JSON.stringify({ 'es-419': { until: new Date(now + 3_600_000).toISOString(), reason: 'noDisponible' } }))
    device(w, {}, { storage })
    setOnlineProjects([project('es-419', ['tit'])])
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
  })

  it('an IndexedDB that never opens holds no run: the lists last the session in memory (minor)', async () => {
    const w = fakeWorker()
    await publish(w, { books: ['tit'] })
    const hung = indexedDbKeptStore(unique('enlinea'), { open: () => new Promise<IDBDatabase>(() => {}), timeoutMs: 50 })
    const d = device(w, {}, { kept: hung })
    await startOnline([project('es-419', ['tit'])])
    await downloadBook('es-419', 'tit')
    expect(bookIsHere(d, 'tit')).toBe(true)
    // Kept in memory: a check within three hours asks no list, and the size is told from it.
    await checkForUpdates()
    expect(requests(w, 'list')).toHaveLength(2)
    d.online = false
    expect(await bookDownloadSize('es-419', 'tit')).toBe(0)
  }, 5_000)
})
