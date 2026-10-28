import { describe, expect, it } from 'vitest'
import type { ImportPackResult } from '@bt-synergy/language-pack'
import { asOnlineApply, holdsOnlineLock } from '../../resources/online/onlineLock'
import type { ResourceStores } from '../../resources/store'
import { openPackSeeingChanges, type ReceiveDeps } from './receiveHelps'

const stores = {} as ResourceStores
const tick = () => new Promise((resolve) => setTimeout(resolve, 10))

function fakes(log: string[], keeping: Promise<void>) {
  const deps: ReceiveDeps = {
    watchHelps: async () => {
      log.push('watchHelps')
      return [{ project: 'p', book: 'tit', verses: [] }] as unknown as Awaited<ReturnType<ReceiveDeps['watchHelps']>>
    },
    openPack: async (_stores, _bytes, options) => {
      // Inside the section, with its token: the opening does not wait for itself.
      log.push(holdsOnlineLock(options?.held) ? 'openPack (held)' : 'openPack')
      return { skippedResources: [] } as unknown as ImportPackResult
    },
    refreshLibrary: async () => void log.push('refreshLibrary'),
    keepHelpsChanges: async () => {
      log.push('keepHelpsChanges')
      await keeping
      log.push('kept')
      return []
    },
  }
  return deps
}

describe('a received pack and what it changed, under the online lock', () => {
  it('an apply asked during the section waits until what changed is kept', async () => {
    const log: string[] = []
    let keep!: () => void
    const keeping = new Promise<void>((r) => (keep = r))
    const receiving = openPackSeeingChanges(stores, new Uint8Array(), { language: 'es-419', books: ['tit'], replace: ['x'] }, fakes(log, keeping))
    await tick()
    expect(log).toEqual(['watchHelps', 'openPack (held)', 'refreshLibrary', 'keepHelpsChanges'])
    const apply = asOnlineApply(async () => void log.push('apply'))
    await tick()
    expect(log).not.toContain('apply')
    keep()
    await Promise.all([receiving, apply])
    expect(log).toEqual(['watchHelps', 'openPack (held)', 'refreshLibrary', 'keepHelpsChanges', 'kept', 'apply'])
  })

  it('waits for an apply in flight before reading what the verses read', async () => {
    const log: string[] = []
    let finish!: () => void
    const applying = asOnlineApply(() => new Promise<void>((r) => (finish = r)).then(() => void log.push('applied')))
    const receiving = openPackSeeingChanges(stores, new Uint8Array(), { language: 'es-419', books: ['tit'], replace: ['x'] }, fakes(log, Promise.resolve()))
    await tick()
    expect(log).toEqual([])
    finish()
    await Promise.all([applying, receiving])
    expect(log[0]).toBe('applied')
    expect(log[1]).toBe('watchHelps')
  })

  it('with nothing replaced, nothing is read before or compared after', async () => {
    const log: string[] = []
    const { changed } = await openPackSeeingChanges(stores, new Uint8Array(), { language: 'es-419', books: ['tit'], replace: [] }, fakes(log, Promise.resolve()))
    expect(changed).toEqual([])
    expect(log).toEqual(['openPack (held)', 'refreshLibrary'])
  })
})

describe('what the pack replaces is decided under the lock (fix round R1)', () => {
  it('after an apply in flight, from the device as that apply left it', async () => {
    const log: string[] = []
    let finish!: () => void
    const applying = asOnlineApply(() => new Promise<void>((r) => (finish = r)).then(() => void log.push('applied')))
    const deps = fakes(log, Promise.resolve())
    let replaced: readonly string[] = []
    const open = deps.openPack
    deps.openPack = async (st, bytes, options) => {
      replaced = options?.replace ?? []
      return open(st, bytes, options)
    }
    const receiving = openPackSeeingChanges(
      stores,
      new Uint8Array(),
      {
        language: 'es-419',
        books: ['tit'],
        replace: () => {
          log.push('decide')
          return log.includes('applied') ? ['after'] : ['before']
        },
      },
      deps,
    )
    await tick()
    expect(log).toEqual([])
    finish()
    await Promise.all([applying, receiving])
    expect(log.slice(0, 3)).toEqual(['applied', 'decide', 'watchHelps'])
    expect(replaced).toEqual(['after'])
  })
})
