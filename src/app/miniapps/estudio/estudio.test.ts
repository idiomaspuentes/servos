import { beforeEach, describe, expect, it } from 'vitest'
import { studiedIn } from '../../projects/work'
import { setProject } from '../../projects/scope'
import { estudio, READ_SECONDS } from './estudio'

beforeEach(() => {
  setProject('kichwa')
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

describe('una sección cuenta como estudiada', () => {
  it(`cuando se pasa de ella después de tenerla ${READ_SECONDS} segundos a la vista`, () => {
    estudio.passed!({ book: 'jon', chapter: 1, verses: [1, 2, 3], seconds: READ_SECONDS + 0.5 })
    expect(studiedIn('jon', 1)).toEqual([1, 2, 3])
    expect(estudio.done!({ book: 'jon', chapter: 1, verse: 2 })).toBe(true)
  })

  it('no cuando se pasa de un tirón, buscando dónde se quedó', () => {
    for (const verses of [[1, 2, 3], [4, 5], [6, 7]]) estudio.passed!({ book: 'jon', chapter: 1, verses, seconds: 0.4 })
    expect(studiedIn('jon', 1)).toEqual([])
    expect(estudio.done!({ book: 'jon', chapter: 1, verse: 4 })).toBe(false)
  })
})
