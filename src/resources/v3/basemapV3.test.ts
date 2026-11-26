import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { memoryStore, type BlobStore } from '@bt-synergy/language-pack-client'
import { basemapV3, fetchBasemapV3, resetBasemapV3 } from './basemapV3'
import { packsV3, resetPacksV3 } from './client'
import { exportBookV3, importTransferV3 } from './filesV3'
import { installV3 } from './onlineV3'
import { buildSample, fakeFetch, TEST_BASEMAP, type Sample } from './testing/sample'

afterEach(() => {
  resetPacksV3()
  resetBasemapV3()
})

const offline = (async () => {
  throw new Error('no network in this test')
}) as unknown as typeof fetch

/** The app's client over a store and a (fake) server. */
const device = (sample: Sample, store: BlobStore, net: typeof fetch) =>
  packsV3({ store, fetch: net, trustedKeys: { [sample.keyId]: sample.publicKey }, index: null })

const noProgress = { signal: new AbortController().signal, planned: 0, onProgress: () => {} }

describe('the basemap on the device', () => {
  it('comes down with an install and is read from the store', async () => {
    const sample = await buildSample(1, { basemap: true })
    const client = await device(sample, memoryStore(), fakeFetch(sample))
    await client.refresh('es-419')
    expect(await basemapV3('es-419')).toBeNull() // not asked for yet; the first read asks once, below
    resetBasemapV3()
    const done = await installV3(client, 'es-419', { books: ['tit'] }, noProgress)
    expect(done.outcome).toEqual({ kind: 'listo' })
    const here = await basemapV3('es-419')
    expect(here?.basemap).toEqual(TEST_BASEMAP)
    expect(here?.id).toHaveLength(64)
    // decoded once: the same object comes back
    expect((await basemapV3('es-419'))?.basemap).toBe(here?.basemap)
  }, 60_000)

  it('a book installed before the map existed gets it at the first read, once', async () => {
    const sample = await buildSample(1, { basemap: true })
    const net = fakeFetch(sample)
    const client = await device(sample, memoryStore(), net)
    await client.refresh('es-419')
    await client.install('es-419', { books: ['tit'] }) // the library alone: no basemap
    expect((await basemapV3('es-419'))?.basemap).toEqual(TEST_BASEMAP)
    expect(net.urls.filter((u) => u.includes('/complement/'))).toHaveLength(1)
  }, 60_000)

  it('is null when the catalogs list none, and it asks only once', async () => {
    const sample = await buildSample()
    const net = fakeFetch(sample)
    const client = await device(sample, memoryStore(), net)
    await client.refresh('es-419')
    await client.install('es-419', { books: ['tit'] })
    expect(await basemapV3('es-419')).toBeNull()
    expect(await basemapV3('es-419')).toBeNull()
    expect(net.urls.filter((u) => u.includes('/complement/'))).toHaveLength(0)
  }, 60_000)

  it('never fails: a server without it is only missing', async () => {
    const sample = await buildSample(1, { basemap: true })
    const client = await device(sample, memoryStore(), fakeFetch(sample))
    await client.refresh('es-419')
    await expect(fetchBasemapV3(client, 'es-419')).resolves.toBeUndefined()
    await expect(fetchBasemapV3({} as never, 'es-419')).resolves.toBeUndefined()
  }, 60_000)

  it('travels in a book passed as a file', async () => {
    const sample = await buildSample(1, { basemap: true })
    const from = await device(sample, memoryStore(), fakeFetch(sample))
    await from.refresh('es-419')
    await from.install('es-419', { books: ['tit'] })
    await fetchBasemapV3(from, 'es-419')
    const file = await exportBookV3('es-419', 'tit', { client: async () => from })

    resetPacksV3()
    resetBasemapV3()
    const to = await device(sample, memoryStore(), offline) // no network: only the file
    const outcome = await importTransferV3(file, { client: async () => to })
    expect(outcome).toMatchObject({ state: 'added', books: ['tit'] })
    expect((await basemapV3('es-419'))?.basemap).toEqual(TEST_BASEMAP)
  }, 60_000)

  it('a book passed without the map on the sender leaves the receiver without it', async () => {
    const sample = await buildSample(1, { basemap: true })
    const from = await device(sample, memoryStore(), fakeFetch(sample))
    await from.refresh('es-419')
    await from.install('es-419', { books: ['tit'] }) // never asked for the basemap
    const file = await exportBookV3('es-419', 'tit', { client: async () => from })

    resetPacksV3()
    resetBasemapV3()
    const to = await device(sample, memoryStore(), offline)
    await importTransferV3(file, { client: async () => to })
    expect(await basemapV3('es-419')).toBeNull()
  }, 60_000)
})
