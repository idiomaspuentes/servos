import 'fake-indexeddb/auto'
import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { memoryStore } from '@bt-synergy/language-pack-client'
import { packsFormat, PACKS_SERVERS, V3_ORIGINS } from '../online/packsServer'
import { createPacksV3, forgetReadersV3, packsV3, readerV3, resetPacksV3 } from './client'
import { trustedKeys } from './keys'
import { buildSample, fakeFetch, readKeyFile } from './testing/sample'

afterEach(() => resetPacksV3())

describe('trustedKeys', () => {
  it('has 78d2e6299a2de4d0 with the 32 bytes of the .pub file', () => {
    const key = trustedKeys()['78d2e6299a2de4d0']
    expect(key).toBeInstanceOf(Uint8Array)
    expect(key).toHaveLength(32)
    expect(Buffer.from(key).toString('hex')).toBe(readKeyFile('78d2e6299a2de4d0').trim())
    // the file name is the first 16 hex of the key's sha256
    expect(createHash('sha256').update(key).digest('hex').slice(0, 16)).toBe('78d2e6299a2de4d0')
  })
})

describe('packsFormat', () => {
  it('is 3 only for staging', () => {
    expect(packsFormat('')).toBe(2)
    expect(packsFormat('?packs=produccion')).toBe(2)
    expect(packsFormat('?packs=otro')).toBe(2)
    expect(packsFormat('?packs=staging')).toBe(3)
    expect(PACKS_SERVERS.staging.startsWith(V3_ORIGINS.staging)).toBe(true)
  })
})

describe('packsV3', () => {
  it('installs and reads a signed sample', async () => {
    const sample = await buildSample()
    const fetch = fakeFetch(sample)
    const client = await packsV3({ fetch, trustedKeys: { [sample.keyId]: sample.publicKey } })
    expect(await packsV3()).toBe(client)
    await client.refresh('es-419')
    const report = await client.install('es-419', { books: ['tit'] })
    expect(report.activated.some((k) => k.endsWith('book:tit'))).toBe(true)
    expect(fetch.urls.every((u) => u.startsWith(`${V3_ORIGINS.staging}/v3/packs/`))).toBe(true)

    const reader = await readerV3('es-419')
    expect(reader).not.toBeNull()
    expect(reader!.installed('book:tit')).toBe(true)
    const answer = await reader!.passage('tit 1:1')
    expect(answer.query).toBe('passage')
    expect(answer.data).not.toBeNull()
    expect(answer.data!.texts.length).toBeGreaterThan(0)
    expect(await readerV3('es-419')).toBe(reader)
    forgetReadersV3()
    expect(await readerV3('es-419')).not.toBe(reader)
  })

  it('has no reader for a language with nothing installed', async () => {
    const sample = await buildSample()
    await packsV3({ fetch: fakeFetch(sample), store: memoryStore() })
    expect(await readerV3('pt-br')).toBeNull()
  })

  it('a catalog signed by an unknown key installs nothing (E_SIGNATURE)', async () => {
    const sample = await buildSample()
    const store = memoryStore()
    // The real keys of bt-synergy: the sample was signed with a key made for this test.
    const client = await createPacksV3({ fetch: fakeFetch(sample), store, trustedKeys: trustedKeys() })
    await expect(client.refresh('es-419')).rejects.toMatchObject({ code: 'E_SIGNATURE' })
    await expect(client.install('es-419', { books: ['tit'] })).rejects.toMatchObject({ code: 'E_SIGNATURE' })
    expect(await store.ids()).toEqual([])
  })
})
