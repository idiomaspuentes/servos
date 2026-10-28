import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'

/** A book pack whose manifest does not say its books (one made before they were said): `openPack` reads it so. */
const manifestWithoutBooks = vi.hoisted(() => ({ on: false }))
vi.mock('@bt-synergy/language-pack', async (importOriginal) => {
  const real = await importOriginal<typeof import('@bt-synergy/language-pack')>()
  return {
    ...real,
    readPackManifest: async (bytes: Uint8Array | ArrayBuffer) => {
      const manifest = await real.readPackManifest(bytes)
      if (manifestWithoutBooks.on) delete manifest.books
      return manifest
    },
  }
})
import {
  applyParts,
  buildLanguagePack,
  memoryByteStore,
  packTargetFrom,
  planParts,
  stagingFrom,
  writePart,
  type PackKind,
  type PackSource,
  type PartEntry,
  type PartRow,
  type PartsList,
} from '@bt-synergy/language-pack'
import { resourceContentStamp } from '@bt-synergy/resource-catalog'
import { USJ_PROCESSING_VERSION } from '@bt-synergy/usj-processor'
import { asOnlineApply, whileOnlineIdle } from './online/onlineLock'
import { openPack } from './packs'
import { RESOURCE_VERSIONS, openResourceStores, readPartsRegister, type ResourceStores } from './store'

/*
 * Spec §3, «Paquetes de archivo y partes juntos»: a pack opened over parts takes the place of their rows, so the
 * register forgets the slots of the resources and books it brings, and the next check plans them again (Review
 * Focus 5). Nothing else is forgotten.
 */

const GLT = 'es-419_gl/es-419/glt'
const TN = 'es-419_gl/es-419/tn'
const TW = 'es-419_gl/es-419/tw'
const PT_TN = 'pt-br_gl/pt-br/tn'
const UGNT = 'unfoldingWord/el-x-koine/ugnt'

const metaOf = (key: string, type: string, subject: string, tag = 'v1'): Record<string, unknown> => {
  const [owner, language, resourceId] = key.split('/')
  return { resourceKey: key, owner, language, resourceId, type, subject, title: key, release: { tag_name: tag, published_at: '2026-10-01T00:00:00Z' } }
}
const META: Record<string, Record<string, unknown>> = {
  [GLT]: metaOf(GLT, 'scripture', 'Aligned Bible'),
  [TN]: metaOf(TN, 'notes', 'TSV Translation Notes'),
  [TW]: metaOf(TW, 'words', 'Translation Words'),
  [PT_TN]: metaOf(PT_TN, 'notes', 'TSV Translation Notes'),
  [UGNT]: metaOf(UGNT, 'scripture', 'Greek New Testament'),
}

const SCHEMA: Record<string, string> = { scripture: `usj:${USJ_PROCESSING_VERSION}`, notes: 'helps:1', words: 'helps:1' }
const receipt = (key: string) => ({
  key: `resource:${key}`,
  entry: {
    content: {},
    metadata: { downloadComplete: true, releaseStamp: resourceContentStamp(META[key]), ingestSchema: SCHEMA[String(META[key].type)] },
  },
})
/** What tc-study's store holds of a book of each resource, the way a pack is made from it. */
const storeRows = (book: string) => [
  { key: `scripture-usj:${GLT}:${book}:1`, entry: { content: { pack: true } } },
  { key: `tn:${TN}:${book}`, entry: { content: { pack: true } } },
  { key: `tn:${TN}:${book}:1`, entry: { content: { pack: true } } },
  { key: `scripture-usj:${UGNT}:${book}:1`, entry: { content: { pack: true } } },
]
const ROWS = [
  receipt(GLT),
  receipt(TN),
  receipt(TW),
  receipt(UGNT),
  ...storeRows('tit'),
  { key: `${TW}/bible/kt/god`, entry: { content: { pack: true } } },
]
const source: PackSource = {
  rowsByPrefix: async (prefix) => ROWS.filter((r) => r.key.startsWith(prefix)),
  catalogRow: async (key) => META[key] ?? null,
  catalogRows: async () => Object.values(META),
}
const pack = async (opts: { kind?: PackKind; resourceKeys?: string[]; books?: string[] } = {}) =>
  (await buildLanguagePack({ source, language: 'es-419', versions: RESOURCE_VERSIONS, ...opts })).bytes

let n = 0
const unique = (what: string) => `${what}-${Date.now()}-${n++}`

const row = (key: string): PartRow => ({ layer: 'sot', key, value: { content: { part: true } } })
const entryOf = async (e: Pick<PartEntry, 'kind' | 'resource'> & Partial<PartEntry>, rows: PartRow[]) => {
  const made = await writePart(rows)
  return { entry: { fingerprint: `fp-${made.sha256.slice(0, 8)}`, layers: ['sot'], ...e, sha256: made.sha256, bytes: made.bytes.length, rows: made.rows } as PartEntry, bytes: made.bytes }
}
const listOf = (language: string, parts: PartEntry[], keys: string[], meta: Record<string, Record<string, unknown>>): PartsList =>
  ({
    schema: 2,
    language,
    compat: 'f2.0-test',
    code: 'code-1',
    versions: RESOURCE_VERSIONS,
    resources: keys.map((key) => ({
      key, stamp: resourceContentStamp(meta[key]), role: language === 'originals' ? 'original' : 'language', subject: String(meta[key].subject), title: key, metadata: meta[key],
    })),
    parts,
  }) as unknown as PartsList

/**
 * A device with parts applied by B's own `applyParts`: es-419's text and notes of Titus and Ruth and a words group,
 * the originals of Titus and Ruth, and pt-br's notes of Titus. `meta` gives the releases the lists name.
 */
async function deviceWithParts(meta = META) {
  const stores = openResourceStores({ cache: unique('recursos'), catalog: unique('catalogo') })
  const staging = stagingFrom(memoryByteStore())
  const made = {
    gltTit: await entryOf({ kind: 'book', resource: GLT, book: 'tit' }, [row(`scripture-usj:${GLT}:tit:1`)]),
    gltRut: await entryOf({ kind: 'book', resource: GLT, book: 'rut' }, [row(`scripture-usj:${GLT}:rut:1`)]),
    tnTit: await entryOf({ kind: 'book', resource: TN, book: 'tit' }, [row(`tn:${TN}:tit`), row(`tn:${TN}:tit:1`)]),
    tnRut: await entryOf({ kind: 'book', resource: TN, book: 'rut' }, [row(`tn:${TN}:rut`), row(`tn:${TN}:rut:1`)]),
    tw: await entryOf({ kind: 'tw', resource: TW, group: 'kt:6' }, [row(`${TW}/bible/kt/god`)]),
    ugntTit: await entryOf({ kind: 'original', resource: UGNT, book: 'tit' }, [row(`scripture-usj:${UGNT}:tit:1`)]),
    ugntRut: await entryOf({ kind: 'original', resource: UGNT, book: 'rut' }, [row(`scripture-usj:${UGNT}:rut:1`)]),
    ptTit: await entryOf({ kind: 'book', resource: PT_TN, book: 'tit' }, [row(`tn:${PT_TN}:tit`)]),
  }
  for (const m of Object.values(made)) await staging.put(m.entry.sha256, m.bytes)
  const lists = {
    es: listOf('es-419', [made.gltTit, made.gltRut, made.tnTit, made.tnRut, made.tw].map((m) => m.entry), [GLT, TN, TW], meta),
    originals: listOf('originals', [made.ugntTit, made.ugntRut].map((m) => m.entry), [UGNT], meta),
    pt: listOf('pt-br', [made.ptTit.entry], [PT_TN], meta),
  }
  const chosen = ['shared', 'book tit', 'book rut']
  for (const list of Object.values(lists)) {
    const register = await readPartsRegister(stores)
    const plan = planParts({ list, register, chosen })
    const result = await applyParts({
      target: packTargetFrom({ cache: stores.cache, catalog: stores.catalog }),
      staging, plan, list, register, chosen, versions: RESOURCE_VERSIONS,
    })
    expect(result.failed).toEqual([])
  }
  const slots = await readPartsRegister(stores)
  expect([...slots.keys()].sort()).toEqual(
    [
      `book:${GLT}:rut`, `book:${GLT}:tit`, `book:${PT_TN}:tit`, `book:${TN}:rut`, `book:${TN}:tit`,
      `original:${UGNT}:rut`, `original:${UGNT}:tit`, `tw:${TW}:kt:6`,
    ].sort(),
  )
  return { stores, lists, made, chosen, staging }
}

const slotIds = async (stores: ResourceStores) => [...(await readPartsRegister(stores)).keys()].sort()

describe('a pack opened over parts', () => {
  it('forgets the slots of the books and shared resources it brings, keeps the rest, and the next plan brings them again', async () => {
    const { stores, lists, made, chosen } = await deviceWithParts()
    await openPack(stores, await pack())

    // Titus of the text and the notes, and the words' shared slots, are the pack's now; Ruth, the originals and
    // another language's notes are not in it.
    expect(await slotIds(stores)).toEqual(
      [`book:${GLT}:rut`, `book:${PT_TN}:tit`, `book:${TN}:rut`, `original:${UGNT}:rut`, `original:${UGNT}:tit`].sort(),
    )
    // Review Focus 5: the next check plans Titus and the words again, and only them.
    const plan = planParts({ list: lists.es, register: await readPartsRegister(stores), chosen })
    expect(plan.download.map((p) => p.sha256).sort()).toEqual([made.gltTit, made.tnTit, made.tw].map((m) => m.entry.sha256).sort())
    expect(plan.units).toEqual(expect.arrayContaining(['shared', 'book tit']))
    expect(plan.units).not.toContain('book rut')
  })

  it('a pack without a resource leaves that resource\'s slots alone', async () => {
    const { stores } = await deviceWithParts()
    await openPack(stores, await pack({ resourceKeys: [TN] }))
    expect(await slotIds(stores)).toEqual(
      [
        `book:${GLT}:rut`, `book:${GLT}:tit`, `book:${PT_TN}:tit`, `book:${TN}:rut`,
        `original:${UGNT}:rut`, `original:${UGNT}:tit`, `tw:${TW}:kt:6`,
      ].sort(),
    )
  })

  it('a book pack forgets its books only, not the shared slots of the resources it carries', async () => {
    const { stores } = await deviceWithParts()
    await openPack(stores, await pack({ kind: 'book', books: ['tit'] }))
    expect(await slotIds(stores)).toEqual(
      [`book:${GLT}:rut`, `book:${PT_TN}:tit`, `book:${TN}:rut`, `original:${UGNT}:rut`, `original:${UGNT}:tit`, `tw:${TW}:kt:6`].sort(),
    )
  })

  it('an originals pack forgets the originals\' slots, and no language\'s', async () => {
    const { stores } = await deviceWithParts()
    await openPack(stores, await pack({ kind: 'originals' }))
    // An original comes whole, and its manifest does not say its books: every slot of it is forgotten.
    expect(await slotIds(stores)).toEqual(
      [`book:${GLT}:rut`, `book:${GLT}:tit`, `book:${PT_TN}:tit`, `book:${TN}:rut`, `book:${TN}:tit`, `tw:${TW}:kt:6`].sort(),
    )
  })

  it('a resource the device keeps in another release (the pack does not replace it) keeps its slots', async () => {
    // The parts are of a later release of the notes than the pack's; the pack is opened without replacing them.
    const { stores } = await deviceWithParts({ ...META, [TN]: metaOf(TN, 'notes', 'TSV Translation Notes', 'v2') })
    await openPack(stores, await pack())
    const ids = await slotIds(stores)
    expect(ids).toContain(`book:${TN}:tit`)
    expect(ids).not.toContain(`book:${GLT}:tit`)
  })

  it('the slots are forgotten before the rows are written: an opening cut halfway never leaves them claiming old rows', async () => {
    const { stores } = await deviceWithParts()
    vi.spyOn(stores.cache, 'putRawMany').mockRejectedValue(new Error('the app closed'))
    // The pack takes the place of the parts' rows, as a newer release would.
    await expect(openPack(stores, await pack(), { replace: [GLT, TN, TW] })).rejects.toThrow('the app closed')
    const ids = await slotIds(stores)
    expect(ids).not.toContain(`book:${GLT}:tit`)
    expect(ids).not.toContain(`book:${TN}:tit`)
    expect(ids).toContain(`book:${TN}:rut`)
  })

  it('a book pack whose manifest does not say its books forgets every book slot of its resources', async () => {
    const { stores } = await deviceWithParts()
    manifestWithoutBooks.on = true
    try {
      await openPack(stores, await pack({ kind: 'book', books: ['tit'] }))
    } finally {
      manifestWithoutBooks.on = false
    }
    // Ruth goes too: which books it holds cannot be told. The words' shared slot and the originals stay.
    expect(await slotIds(stores)).toEqual([`book:${PT_TN}:tit`, `original:${UGNT}:rut`, `original:${UGNT}:tit`, `tw:${TW}:kt:6`].sort())
  })

  it('an apply that lands while the rows are written is forgotten by the second pass', async () => {
    const { stores, lists, made, staging } = await deviceWithParts()
    // Parts of Titus applied in the middle of the import, after the first pass forgot their slots. Servos online
    // cannot do this any more (`onlineLock.ts`); the second pass is what keeps the register right if anything does.
    for (const m of Object.values(made)) await staging.put(m.entry.sha256, m.bytes)
    const write = stores.cache.putRawMany.bind(stores.cache)
    let landed = false
    vi.spyOn(stores.cache, 'putRawMany').mockImplementation(async (...args) => {
      if (!landed) {
        landed = true
        const register = await readPartsRegister(stores)
        const plan = planParts({ list: lists.es, register, chosen: ['shared', 'book tit'] })
        const result = await applyParts({
          target: packTargetFrom({ cache: stores.cache, catalog: stores.catalog }),
          staging, plan, list: lists.es, register, chosen: ['shared', 'book tit'], versions: RESOURCE_VERSIONS,
        })
        expect(result.applied).toContain('book tit')
        expect(await slotIds(stores)).toContain(`book:${GLT}:tit`)
      }
      return write(...args)
    })
    // The pack takes the place of the parts' rows, as a newer release would (the same release only fills gaps).
    await openPack(stores, await pack(), { replace: [GLT, TN, TW] })
    expect(landed).toBe(true)
    const ids = await slotIds(stores)
    expect(ids).not.toContain(`book:${GLT}:tit`)
    expect(ids).not.toContain(`book:${TN}:tit`)
    expect(ids).not.toContain(`tw:${TW}:kt:6`)
    expect(ids).toContain(`book:${TN}:rut`)
  })

  it('waits for an online apply in flight before it forgets or writes anything', async () => {
    const { stores } = await deviceWithParts()
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    const run = asOnlineApply(() => gate)
    const before = await slotIds(stores)
    const opening = openPack(stores, await pack())
    await new Promise((r) => setTimeout(r, 30))
    expect(await slotIds(stores)).toEqual(before)
    open()
    await Promise.all([run, opening])
    expect(await slotIds(stores)).not.toContain(`book:${GLT}:tit`)
  })

  it('opens inside a section that holds the lock when given its token, and takes the lock itself otherwise', async () => {
    const { stores } = await deviceWithParts()
    let kept: Parameters<Parameters<typeof whileOnlineIdle>[0]>[0] | undefined
    const result = await whileOnlineIdle(async (held) => {
      kept = held
      return openPack(stores, await pack(), { held })
    })
    expect(result.skippedResources).toEqual([])
    expect(await slotIds(stores)).not.toContain(`book:${GLT}:tit`)
    // A token whose section ended is no proof: the opening takes the lock again (and so waits for an apply).
    let open!: () => void
    const gate = new Promise<void>((r) => (open = r))
    const apply = asOnlineApply(() => gate)
    let opened = false
    const again = openPack(stores, await pack(), { held: kept }).then(() => (opened = true))
    await new Promise((r) => setTimeout(r, 30))
    expect(opened).toBe(false)
    open()
    await Promise.all([apply, again])
    expect(opened).toBe(true)
  })
})
