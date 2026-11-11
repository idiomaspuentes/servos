import 'fake-indexeddb/auto'
import { describe, expect, it, vi } from 'vitest'
import { memoryStore } from '@bt-synergy/language-pack-client'
import { readBookV3 } from './bookV3'
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
    for (const stat of [out.open, out.book, out.firstChapter, out.screen, out.firstVerse, out.passage, out.context, out.yielded]) {
      expect(stat.min).toBeGreaterThanOrEqual(0)
      expect(stat.min).toBeLessThanOrEqual(stat.median)
      expect(stat.median).toBeLessThanOrEqual(stat.max)
    }
    expect(out.screen.max).toBeGreaterThan(0)
    expect(Object.keys(out.first)).toEqual(['open', 'book', 'firstChapter', 'screen', 'firstVerse', 'passage', 'context'])
  })

  it('gives the screen a turn once a slice of reading went by, not after every chapter', async () => {
    const sample = await buildSample()
    const client = await createPacksV3({ fetch: fakeFetch(sample), store: memoryStore(), trustedKeys: { [sample.keyId]: sample.publicKey }, index: null })
    await client.refresh('es-419')
    await client.install('es-419', { books: ['tit'] })
    const reader = await client.open('es-419')
    let turns = 0
    const counted = { yield: async () => void turns++ }
    // A clock that moves 30 ms each time it is read: the 50 ms slice is spent within each chapter or two.
    let now = 0
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => (now += 30))
    try {
      expect((await readBookV3(reader, 'es-419', 'tit', { ...counted, today: '2026-11-09' }))!.chapters).toHaveLength(3)
    } finally {
      clock.mockRestore()
    }
    expect(turns).toBeGreaterThan(0)
    // A clock that stands still: Titus is read in one go.
    turns = 0
    const still = vi.spyOn(performance, 'now').mockReturnValue(0)
    try {
      await readBookV3(reader, 'es-419', 'tit', counted)
    } finally {
      still.mockRestore()
    }
    expect(turns).toBe(0)
  })

  it('says so when the book is not installed', async () => {
    const sample = await buildSample()
    const client = await createPacksV3({ fetch: fakeFetch(sample), store: memoryStore(), trustedKeys: { [sample.keyId]: sample.publicKey }, index: null })
    await client.refresh('es-419')
    await client.install('es-419', { books: ['tit'] })
    await expect(measure('es-419', 'gen', 'gen 1:1', 2, { client })).rejects.toThrow()
  })

  it('stops on an aborted signal of an old WebView (no throwIfAborted), with its reason', async () => {
    const sample = await buildSample()
    const client = await createPacksV3({ fetch: fakeFetch(sample), store: memoryStore(), trustedKeys: { [sample.keyId]: sample.publicKey }, index: null })
    await client.refresh('es-419')
    await client.install('es-419', { books: ['tit'] })
    const reason = new Error('closed')
    const old = { aborted: true, reason } as unknown as AbortSignal
    await expect(measure('es-419', 'tit', 'tit 1:1', 2, { client, signal: old })).rejects.toBe(reason)
  })
})
