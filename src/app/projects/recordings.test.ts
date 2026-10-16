import { beforeEach, describe, expect, it } from 'vitest'
import { addTake, chooseTake, chosenTake, clock, takesOf } from './recordings'

beforeEach(() => {
  const store = new Map<string, string>()
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  } as Storage
})

describe('recordings of a verse said aloud', () => {
  it('keeps every take, the last one counting', () => {
    addTake('jon', 1, 1, { by: 'Ana', at: '2026-10-16T10:00:00Z', ms: 5200, mime: 'audio/webm' }, 'a')
    addTake('jon', 1, 1, { by: 'Ana', at: '2026-10-16T10:01:00Z', ms: 4800, mime: 'audio/webm' }, 'b')
    expect(takesOf('jon', 1, 1).map((x) => x.id)).toEqual(['a', 'b'])
    expect(chosenTake('jon', 1, 1)?.id).toBe('b')
  })

  it('lets an earlier take be the one that counts, without losing the others', () => {
    addTake('jon', 1, 1, { by: 'Ana', at: '', ms: 1, mime: '' }, 'a')
    addTake('jon', 1, 1, { by: 'Bea', at: '', ms: 1, mime: '' }, 'b')
    chooseTake('jon', 1, 1, 'a')
    expect(chosenTake('jon', 1, 1)?.by).toBe('Ana')
    expect(takesOf('jon', 1, 1)).toHaveLength(2)
  })

  it('has none for a verse not said yet', () => {
    expect(chosenTake('jon', 1, 9)).toBeNull()
  })

  it('says how long a take is as a clock', () => {
    expect(clock(7400)).toBe('0:07')
    expect(clock(65000)).toBe('1:05')
  })
})
