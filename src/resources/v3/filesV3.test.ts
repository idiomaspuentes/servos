import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { memoryStore, type BlobStore, type LanguagePackClient } from '@bt-synergy/language-pack-client'
import { zipSource } from '@bt-synergy/language-pack-v3'
import { createPacksV3 } from './client'
import {
  exportBookV3,
  exportableV3,
  hasOriginals,
  importOldPackV3,
  importTransferV3,
  keepOriginals,
  keptOriginals,
  originalsSource,
  type FilesDeps,
} from './filesV3'
import { buildSample, fakeFetch, specData, type Sample } from './testing/sample'

const BOOK = () => specData('es-419-tit.langpack.zip')
const ORIGINALS = () => specData('originals-tit.langpack.zip')

/** A device with no network: every request fails (none is expected). */
const offline = (async () => {
  throw new Error('no network in this test')
}) as unknown as typeof fetch

const device = async (sample: Sample, store: BlobStore = memoryStore(), net: typeof globalThis.fetch = offline) =>
  createPacksV3({ store, fetch: net, trustedKeys: { [sample.keyId]: sample.publicKey } })

const depsOf = (client: LanguagePackClient, originals: boolean): FilesDeps => ({
  client: async () => client,
  originals: async () => (originals ? zipSource(ORIGINALS()) : null),
  keepOriginals: async () => {},
})

/** A device that installed Titus from the (fake) server: a published catalog. */
async function published(sample: Sample, store: BlobStore = memoryStore()) {
  const client = await device(sample, store, fakeFetch(sample))
  await client.refresh('es-419')
  await client.install('es-419', { books: ['tit'] })
  return client
}

function deleteKept() {
  return new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase('servos-originales')
    r.onsuccess = r.onerror = r.onblocked = () => resolve()
  })
}

afterEach(deleteKept)

describe('today\'s packs in format 3', () => {
  it('an old book pack becomes an active book', async () => {
    const sample = await buildSample()
    const client = await device(sample)
    const outcome = await importOldPackV3(BOOK(), depsOf(client, true))
    expect(outcome).toEqual({ state: 'added', language: 'es-419', books: ['tit'], articles: false })
    const passage = await (await client.open('es-419')).passage('tit 2:11')
    expect(passage.data!.texts.find((t) => t.res === 'es-419_gl/es-419/glt')!.text).toBe(
      'Porque la gracia salvadora de Dios fue manifestada a todos los hombres,',
    )
  }, 60_000)

  it('no originals here says sinOriginales', async () => {
    const sample = await buildSample()
    const client = await device(sample)
    expect(await importOldPackV3(BOOK(), depsOf(client, false))).toEqual({ state: 'sinOriginales' })
    // Nothing was imported: not even the pack's map.
    expect((await client.status('es-419')).active).toBeUndefined()
  })

  it('a pack whose texts are here from the published catalog says yaEstan', async () => {
    const sample = await buildSample()
    const store = memoryStore()
    const client = await published(sample, store)
    const before = JSON.stringify(await store.getState())
    expect(await importOldPackV3(BOOK(), depsOf(client, true))).toEqual({ state: 'yaEstan' })
    expect(JSON.stringify(await store.getState())).toBe(before)
  }, 60_000)

  it('an originals pack is kept, and books are built with it later', async () => {
    const sample = await buildSample()
    const client = await device(sample)
    expect(await hasOriginals()).toBe(false)
    expect(await originalsSource()).toBeNull()
    const kept = { client: async () => client, originals: originalsSource, keepOriginals }
    expect(await importOldPackV3(ORIGINALS(), kept)).toEqual({ state: 'originales' })
    expect(await hasOriginals()).toBe(true)
    // Nothing of it went to the format 3 store: it is only the rows the book packs are built with.
    expect((await client.status('es-419')).published).toBeUndefined()
    expect(await importOldPackV3(BOOK(), kept)).toMatchObject({ state: 'added', books: ['tit'] })
  }, 60_000)

  it('keeps only the newest originals pack', async () => {
    await keepOriginals(new Uint8Array([2]), '2026-10-02T00:00:00Z')
    await keepOriginals(new Uint8Array([1]), '2026-10-01T00:00:00Z')
    expect(Array.from((await keptOriginals())!)).toEqual([2])
    await keepOriginals(new Uint8Array([3]), '2026-10-03T00:00:00Z')
    expect(Array.from((await keptOriginals())!)).toEqual([3])
  })

  it('a file that is not a pack says noEsPaquete', async () => {
    const sample = await buildSample()
    const client = await device(sample)
    expect(await importOldPackV3(new Uint8Array([1, 2, 3]), depsOf(client, true))).toEqual({ state: 'noEsPaquete' })
    expect(await importTransferV3(new Uint8Array([1, 2, 3]), depsOf(client, true))).toEqual({ state: 'noEsPaquete' })
  })
})

describe('transfer files', () => {
  it('a transfer file round-trips a book', async () => {
    const sample = await buildSample()
    const from = await published(sample)
    expect(await exportableV3('es-419', 'tit', { client: async () => from })).toBe(true)
    const file = await exportBookV3('es-419', 'tit', { client: async () => from })
    const to = await device(sample)
    // Titus's notes name a group of articles: it comes with the book.
    expect(await importTransferV3(file, { client: async () => to })).toEqual({ state: 'added', language: 'es-419', books: ['tit'], articles: true })
    const passage = await (await to.open('es-419')).passage('tit 1:1')
    expect(passage.data).not.toBeNull()
    expect(passage.data!.texts.length).toBeGreaterThan(0)
    // The same file again brings nothing new.
    expect(await importTransferV3(file, { client: async () => to })).toEqual({ state: 'added', language: 'es-419', books: [], articles: false })
  }, 60_000)

  it('says only the books the file brought, not the ones it activated again', async () => {
    // A Titus file over a device with Ruth: publishing the file's catalog activates Ruth again, from what was here.
    const report = {
      catalogs: [{ name: 'es-419', publisher: 'unfoldingWord', revision: 2, id: 'c', origin: 'published' }],
      stored: ['s-tit', 's-art'],
      rejected: [],
      missing: [],
      activated: ['es-419/book:rut', 'es-419/book:tit', 'es-419/art:tw:kt', 'es-419/map'],
      waiting: [],
    }
    const client = { importTransfer: async () => report } as unknown as LanguagePackClient
    const installed = async () => ({
      'es-419/book:rut': ['s-rut'],
      'es-419/book:tit': ['s-tit'],
      'es-419/art:tw:kt': ['s-art'],
      'es-419/map': ['s-map'],
    })
    expect(await importTransferV3(new Uint8Array(), { client: async () => client, installed })).toEqual({
      state: 'added',
      language: 'es-419',
      books: ['tit'],
      articles: true,
    })
  })

  it('offers only books installed from the published catalog: not a bridged one beside them', async () => {
    // A bridged Ruth beside a published Titus: the language has a published catalog, but Ruth is local.
    const unit = (key: string, local: boolean) => ({ key, revision: 1, installed: true, optional: false, bytes: 1, local })
    const status = {
      lang: 'es-419',
      published: { name: 'es-419', revision: 1, id: 'p', origin: 'published' },
      active: { name: 'es-419', revision: 1, id: 'p', origin: 'published' },
      units: [unit('es-419/book:tit', false), unit('es-419/book:rut', true)],
      updates: [],
    }
    const client = { status: async () => status } as unknown as LanguagePackClient
    expect(await exportableV3('es-419', 'tit', { client: async () => client })).toBe(true)
    expect(await exportableV3('es-419', 'rut', { client: async () => client })).toBe(false)
    // No published catalog: nothing is offered.
    const none = { status: async () => ({ ...status, published: undefined }) } as unknown as LanguagePackClient
    expect(await exportableV3('es-419', 'tit', { client: async () => none })).toBe(false)
  })

  it('a bridged book stays unoffered after the published catalog arrives', async () => {
    const sample = await buildSample()
    const client = await device(sample, memoryStore(), fakeFetch(sample))
    await importOldPackV3(BOOK(), depsOf(client, true))
    await client.refresh('es-419')
    expect((await client.status('es-419')).published).toBeDefined()
    expect(await exportableV3('es-419', 'tit', { client: async () => client })).toBe(false)
  }, 60_000)

  it('a transfer file with a local catalog says noConfiable', async () => {
    const sample = await buildSample()
    const from = await device(sample)
    await importOldPackV3(BOOK(), depsOf(from, true))
    // A book made here from an old pack is not offered: another device would refuse it.
    expect(await exportableV3('es-419', 'tit', { client: async () => from })).toBe(false)
    const file = await exportBookV3('es-419', 'tit', { client: async () => from })
    const store = memoryStore()
    const to = await device(sample, store)
    expect(await importTransferV3(file, { client: async () => to })).toEqual({ state: 'noConfiable' })
    expect(await store.getState()).toBeUndefined()
    expect(await store.ids()).toEqual([])
  }, 60_000)

  it('a cut transfer file adds nothing', async () => {
    const sample = await buildSample()
    const file = await exportBookV3('es-419', 'tit', { client: async () => published(sample) })
    // Cut in the book's segments, or before the catalogs: no book and no article can be used.
    for (const cut of [Math.floor(file.length / 2), 1000, 40]) {
      const to = await device(sample)
      expect(await importTransferV3(file.slice(0, cut), { client: async () => to })).toEqual({ state: 'noEsPaquete' })
      expect((await to.status('es-419')).units.some((u) => u.installed && u.key.endsWith('/book:tit'))).toBe(false)
    }
    // Cut at its very end (a map shared by every book lost): the book is whole, and is said.
    const to = await device(sample)
    expect(await importTransferV3(file.slice(0, file.length - 1), { client: async () => to })).toMatchObject({ state: 'added', books: ['tit'] })
  }, 60_000)

  it('a full store says sinEspacio', async () => {
    const sample = await buildSample()
    const file = await exportBookV3('es-419', 'tit', { client: async () => published(sample) })
    const inner = memoryStore()
    let puts = 0
    const full: BlobStore = {
      ...inner,
      put: async (id, bytes) => {
        if (++puts > 2) throw new DOMException('full', 'QuotaExceededError')
        return inner.put(id, bytes)
      },
    }
    const to = await device(sample, full)
    expect(await importTransferV3(file, { client: async () => to })).toEqual({ state: 'sinEspacio' })
    expect((await to.status('es-419')).active).toBeUndefined()
    // The same with an old pack.
    const old = await device(sample, full)
    expect(await importOldPackV3(BOOK(), depsOf(old, true))).toEqual({ state: 'sinEspacio' })
    expect((await old.status('es-419')).active).toBeUndefined()
  }, 60_000)
})
