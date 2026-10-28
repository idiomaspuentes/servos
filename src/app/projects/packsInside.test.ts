import { describe, expect, it } from 'vitest'
import { asOnlineApply, holdsOnlineLock } from '../../resources/online/onlineLock'
import type { ResourceStores } from '../../resources/store'
import { openDecidingUnderLock, toOpen } from './packsInside'

describe('the packs the app brings', () => {
  const inside = [
    { file: 'originals.langpack.zip', id: 'a1' },
    { file: 'es-419.langpack.zip', id: 'b2' },
  ]

  it('opens all of them the first time, the originals first', () => {
    expect(toOpen(inside, []).map((p) => p.file)).toEqual(['originals.langpack.zip', 'es-419.langpack.zip'])
  })

  it('opens none it opened before, and goes on from one not ended', () => {
    expect(toOpen(inside, ['a1', 'b2'])).toEqual([])
    expect(toOpen(inside, ['a1']).map((p) => p.file)).toEqual(['es-419.langpack.zip'])
  })

  it('opens a pack again when a new version of the app brings it changed', () => {
    expect(toOpen([inside[0], { file: 'es-419.langpack.zip', id: 'c3' }], ['a1', 'b2']).map((p) => p.id)).toEqual(['c3'])
  })
})

describe('a pack inside decides what it replaces under the lock (fix round R1)', () => {
  const tick = () => new Promise((resolve) => setTimeout(resolve, 10))
  const against = (replace: string[]) => ({ replace, resources: [] }) as unknown as Parameters<typeof openDecidingUnderLock>[2] extends () => infer A ? A : never

  it('after an apply in flight; opened with the lock held, and only when it brings something', async () => {
    const log: string[] = []
    let finish!: () => void
    const applying = asOnlineApply(() => new Promise<void>((r) => (finish = r)).then(() => void log.push('applied')))
    const opened: Array<{ replace: readonly string[]; held: boolean }> = []
    const open = async (_s: ResourceStores, _b: Uint8Array, options?: { replace?: readonly string[]; held?: Parameters<typeof holdsOnlineLock>[0] }) => {
      opened.push({ replace: options?.replace ?? [], held: holdsOnlineLock(options?.held) })
      return undefined as never
    }
    const decide = () => {
      log.push('decide')
      return against(log.includes('applied') ? ['after'] : ['before'])
    }
    const going = openDecidingUnderLock({} as ResourceStores, new Uint8Array(), decide, {}, open)
    await tick()
    expect(log).toEqual([])
    finish()
    await Promise.all([applying, going])
    expect(log).toEqual(['applied', 'decide'])
    expect(opened).toEqual([{ replace: ['after'], held: true }])

    // Nothing to bring: not opened.
    expect(await openDecidingUnderLock({} as ResourceStores, new Uint8Array(), () => against([]), {}, open)).toBe(false)
    expect(opened).toHaveLength(1)
  })
})
