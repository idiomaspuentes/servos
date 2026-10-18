import { beforeEach, describe, expect, it } from 'vitest'
import { authorOf, joinedTo, joinedVerses, joinStartOf, joinWithNext, readDraft, separateJoined, textOf, workOf, writeDraft } from './work'

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

describe('unir versículos', () => {
  it('al unir el 1 con el 2, el texto de los dos queda en el 1 y el 2 se dice con él', () => {
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Ana')
    writeDraft('jon', 1, 2, 'Ninive llaktaman riy', 'Bea')
    joinWithNext('jon', 1, 1, 'Ana')
    expect(readDraft('jon', 1, 1)).toBe('Taytaku rimarqa Ninive llaktaman riy')
    expect(readDraft('jon', 1, 2)).toBe('')
    expect(joinedTo('jon', 1, 1)).toBe(2)
    expect(joinStartOf('jon', 1, 2)).toBe(1)
    expect(joinedVerses('jon', 1, 2)).toEqual([1, 2])
    expect(textOf('jon', 1, 2)).toBe('Taytaku rimarqa Ninive llaktaman riy')
    expect(authorOf('jon', 1, 2)).toBe('Ana')
    expect(workOf('jon', 1, [1, 2, 3]).written).toBe(2)
  })

  it('se puede seguir uniendo desde cualquiera de los unidos, y separar desde cualquiera', () => {
    writeDraft('jon', 1, 3, 'kimsa', 'Ana')
    joinWithNext('jon', 1, 1, 'Ana')
    joinWithNext('jon', 1, 2, 'Ana')
    expect(joinedVerses('jon', 1, 3)).toEqual([1, 2, 3])
    expect(readDraft('jon', 1, 1)).toBe('kimsa')
    separateJoined('jon', 1, 3)
    expect(joinedVerses('jon', 1, 2)).toEqual([2])
    expect(textOf('jon', 1, 2)).toBe('')
    expect(readDraft('jon', 1, 1)).toBe('kimsa')
  })

  it('unir con un versículo que ya estaba unido con otros los toma a todos', () => {
    joinWithNext('jon', 1, 3, 'Ana')
    joinWithNext('jon', 1, 2, 'Ana')
    expect(joinedVerses('jon', 1, 4)).toEqual([2, 3, 4])
    expect(joinedTo('jon', 1, 3)).toBeNull()
  })
})
