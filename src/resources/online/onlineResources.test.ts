import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyParts, memoryByteStore, stagingFrom, type ApplyInput, type PartEntry, type PartRow, type PartsList } from '@bt-synergy/language-pack'
import { RESOURCE_VERSIONS, openResourceStores, readPartsRegister, type ResourceStores } from '../store'
import { ANSWERS, fakeWorker } from './fakeWorker'
import {
  RECHECK_MS,
  bookDownloadSize,
  checkForUpdates,
  declineOffer,
  downloadBook,
  downloadOffer,
  onOnline,
  onlineState,
  setOnlineDeps,
  startOnline,
  stopOnline,
  type OnlineDeps,
} from './onlineResources'

type Worker = ReturnType<typeof fakeWorker>
type Project = Parameters<typeof startOnline>[0][number]

const UGNT = 'unfoldingWord/el-x-koine/ugnt'
const tnOf = (language: string) => `o/${language}/tn`
const twOf = (language: string) => `o/${language}/tw`
const meta = (key: string, type: string, subject: string) => {
  const [owner, language, resourceId] = key.split('/')
  return { resourceKey: key, owner, language, resourceId, type, subject, title: key, release: { tag_name: 'v1', published_at: '2026-10-01T00:00:00Z' } }
}
const resource = (key: string, type: string, subject: string, role: 'language' | 'original') => ({
  key, stamp: 'v1#2026-10-01T00:00:00Z', role, subject, title: key, metadata: meta(key, type, subject),
})
const row = (layer: PartRow['layer'], key: string, text: string): PartRow => ({ layer, key, value: { content: text } })

let n = 0
const unique = (what: string) => `${what}-${Date.now()}-${n++}`

/**
 * What the Worker serves for a language: an originals list with each book's original, and a language list with each
 * book's notes and the shared titles. `version` changes the notes (new shas), `originals` the originals list.
 */
async function publish(w: Worker, opts: { language?: string; books: string[]; version?: string; originals?: string; code?: string }) {
  const language = opts.language ?? 'es-419'
  const v = opts.version ?? '1'
  const o = opts.originals ?? '1'
  const orig: PartEntry[] = []
  for (const b of opts.books) orig.push(await w.addPart({ kind: 'original', resource: UGNT, book: b }, [row('sot', `scripture-usj:${UGNT}:${b}:1`, `ugnt ${o} ${b}`)]))
  const originals = {
    schema: 2, language: 'originals', compat: w.compat, code: `orig-${o}`, versions: RESOURCE_VERSIONS,
    resources: [resource(UGNT, 'scripture', 'Greek New Testament', 'original')], parts: orig,
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
    code: opts.code ?? `code-${v}`,
    versions: RESOURCE_VERSIONS,
    resources: [resource(tn, 'notes', 'TSV Translation Notes', 'language'), resource(tw, 'words', 'Translation Words', 'language')],
    originals: ref,
  } as Partial<PartsList>)
  return { list, originals, ref, parts, orig }
}

const memoryStorage = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m }
}

const project = (helpsLanguage: string, books: string[], id = `p-${helpsLanguage}`): Project =>
  ({ id, helpsLanguage, books: books.map((code) => ({ code, phase: 'traduccion' })) }) as unknown as Project

/** A device: fake stores, staging, clock, network, typing, and a library that knows a book once it was read again. */
function device(w: Worker, over: Partial<OnlineDeps> = {}, keep?: { storage?: ReturnType<typeof memoryStorage>; stores?: ResourceStores; staging?: ReturnType<typeof stagingFrom> }) {
  const d = {
    w,
    stores: keep?.stores ?? openResourceStores({ cache: unique('recursos'), catalog: unique('catalogo') }),
    staging: keep?.staging ?? stagingFrom(memoryByteStore()),
    storage: keep?.storage ?? memoryStorage(),
    clock: Date.parse('2026-10-28T12:00:00Z'),
    online: true,
    typing: false,
    waiting: [] as Array<() => void>,
    free: { quota: 1e12, usage: 0 } as { quota: number; usage: number } | null,
    log: [] as string[],
    here: new Set<string>(),
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
    estimate: async () => d.free ?? {},
    wakeLock: async () => {
      d.locks.taken++
      return { release: async () => void d.locks.released++ }
    },
    refreshLibrary: async () => {
      d.log.push('refreshLibrary')
      const register = await readPartsRegister(d.stores)
      d.here = new Set([...register.keys()].filter((id) => id.startsWith('book:')).map((id) => id.split(':').pop()!))
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
    const v2 = await publish(w, { books: ['tit'], version: '2', code: 'code-2' })
    const partsBefore = requests(w, 'part').length
    await checkForUpdates({ force: true })
    // The notes of tit and the shared titles changed; the originals did not.
    expect(onlineState().offer).toEqual({ language: 'es-419', bytes: v2.parts[0].bytes + v2.parts[1].bytes, code: 'code-2' })
    // A check only asks for the lists.
    expect(requests(w, 'part')).toHaveLength(partsBefore)

    d.changes = 3
    await downloadOffer()
    const register = await slots(d)
    expect([...register.values()].map((r) => r.sha256)).toEqual(expect.arrayContaining([v2.parts[0].sha256, v2.parts[1].sha256]))
    expect(onlineState()).toMatchObject({ offer: null, busy: null, done: { language: 'es-419', changedVerses: 3 } })
  })

  it('«Ahora no» hides the offer until the list has another code', async () => {
    const { w, d } = await applied()
    await publish(w, { books: ['tit'], version: '2', code: 'code-2' })
    await checkForUpdates({ force: true })
    expect(onlineState().offer?.code).toBe('code-2')
    declineOffer()
    expect(onlineState().offer).toBeNull()
    expect(JSON.parse(d.storage.getItem('servos.enLinea.ahoraNo')!)).toEqual({ 'es-419': 'code-2' })
    await checkForUpdates({ force: true })
    expect(onlineState().offer).toBeNull()
    await publish(w, { books: ['tit'], version: '3', code: 'code-3' })
    await checkForUpdates({ force: true })
    expect(onlineState().offer?.code).toBe('code-3')
  })

  it('never applies while the person types; it applies at the pause (Review Focus 3)', async () => {
    const { w, d } = await applied()
    await publish(w, { books: ['tit'], version: '2', code: 'code-2' })
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
    await startOnline([project('es-419', ['tit', 'rut', 'jon'])])
    expect(onlineState().offer?.language).toBe('es-419')
    // The list comes again (a 304), then two parts, then the connection drops.
    w.cutAfter(3)
    await downloadOffer()
    expect((await slots(d)).size).toBe(0)
    expect(await staged(d)).toHaveLength(2)
    expect(onlineState()).toMatchObject({ busy: null, blocked: {} })
    expect(d.log).not.toContain('applyParts')

    w.online()
    // Within the recheck time: no list is asked again, the wanted download goes on from staging.
    await checkForUpdates()
    const register = await slots(d)
    expect(register.size).toBe(7)
    expect(['tit', 'rut', 'jon'].every((b) => bookIsHere(d, b))).toBe(true)
    const shas = requests(w, 'part').map((c) => c.url.slice(c.url.lastIndexOf('/') + 1))
    expect(new Set(shas).size).toBe(shas.length)
    expect(await staged(d)).toEqual([])
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
    w.setAnswer('originals', ANSWERS.limite, 1)
    await startOnline([project('es-419', ['tit'])])
    expect(onlineState().blocked).toEqual({ 'es-419': 'noDisponible' })
    expect(JSON.parse(d.storage.getItem('servos.enLinea.reintentar')!)).toHaveProperty('es-419')
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
    expect(onlineState().offer?.language).toBe('es-419')
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
