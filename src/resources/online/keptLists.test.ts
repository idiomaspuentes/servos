import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { indexedDbKeptStore } from './keptLists'
import type { KeptList } from './planLanguage'

const kept = { etag: null, at: '2026-10-28T12:00:00Z', list: { schema: 2, language: 'xx', parts: [] } } as unknown as KeptList

describe('the kept lists store', () => {
  it('keeps, reads and forgets a list', async () => {
    const store = indexedDbKeptStore(`kept-${Date.now()}`)
    await store.put('xx', kept)
    expect(await store.all()).toEqual({ xx: kept })
    await store.delete('xx')
    expect(await store.all()).toEqual({})
  })

  it('an open that never settles: reading gives up after the timeout, writes after it do not wait', async () => {
    const store = indexedDbKeptStore(`kept-hung-${Date.now()}`, { open: () => new Promise<IDBDatabase>(() => {}), timeoutMs: 30 })
    const t0 = Date.now()
    await expect(store.all()).rejects.toThrow()
    expect(Date.now() - t0).toBeLessThan(1000)
    const t1 = Date.now()
    await store.put('xx', kept)
    await store.delete('xx')
    expect(Date.now() - t1).toBeLessThan(20)
  })

  it('a slow open that ends at last still takes the writes made meanwhile', async () => {
    const name = `kept-slow-${Date.now()}`
    let release!: () => void
    const late = new Promise<void>((r) => (release = r))
    const real = () =>
      new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, 1)
        request.onupgradeneeded = () => request.result.createObjectStore('listas')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    const store = indexedDbKeptStore(name, { open: () => late.then(real), timeoutMs: 20 })
    await expect(store.all()).rejects.toThrow()
    await store.put('xx', kept)
    release()
    const again = indexedDbKeptStore(name)
    await expect.poll(async () => Object.keys(await again.all())).toEqual(['xx'])
  })
})
