import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { memoryStore } from '@bt-synergy/language-pack-client'
import { createPacksV3 } from './client'
import { measure, onDeviceV3, statOf } from './timings'
import { buildSample, fakeFetch } from './testing/sample'

describe('measure', { timeout: 30000 }, () => {
  it('statOf takes the median of an odd and an even number of runs', () => {
    expect(statOf([5, 1, 3])).toEqual({ median: 3, min: 1, max: 5 })
    expect(statOf([4, 1, 2, 3]).median).toBe(3)
  })

  it('returns a median of n runs over fresh readers', async () => {
    const sample = await buildSample()
    const client = await createPacksV3({ fetch: fakeFetch(sample), store: memoryStore(), trustedKeys: { [sample.keyId]: sample.publicKey }, index: null })
    expect(await onDeviceV3('es-419', 'tit', client)).toBe(false)
    await client.refresh('es-419')
    await client.install('es-419', { books: ['tit'] })
    expect(await onDeviceV3('es-419', 'tit', client)).toBe(true)

    const told: number[] = []
    const out = await measure('es-419', 'tit', 'tit 1:1', 3, { client, onRun: (n) => told.push(n) })
    expect(told).toEqual([1, 2, 3])
    for (const stat of Object.values(out)) {
      expect(stat.min).toBeGreaterThanOrEqual(0)
      expect(stat.min).toBeLessThanOrEqual(stat.median)
      expect(stat.median).toBeLessThanOrEqual(stat.max)
    }
    expect(out.screen.max).toBeGreaterThan(0)
  })

  it('says so when the book is not installed', async () => {
    const sample = await buildSample()
    const client = await createPacksV3({ fetch: fakeFetch(sample), store: memoryStore(), trustedKeys: { [sample.keyId]: sample.publicKey }, index: null })
    await client.refresh('es-419')
    await client.install('es-419', { books: ['tit'] })
    await expect(measure('es-419', 'gen', 'gen 1:1', 2, { client })).rejects.toThrow()
  })
})
