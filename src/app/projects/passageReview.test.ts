import { beforeEach, describe, expect, it } from 'vitest'
import { CRITERIA, addObservation, answer, answersOf, openObservations, passageDone, resolveObservation } from './passageReview'

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

const verses = [4, 5]
const texts = ['Diosca huairata cacharca.', 'Barcomanta cosascunata shitarca.']

describe('reviewing a passage by four questions', () => {
  it('is done when the four stand «yes» and nothing is left to improve', () => {
    for (const c of CRITERIA.slice(0, 3)) answer('jon', 1, verses, texts, c, 'Ana')
    expect(passageDone('jon', 1, verses, texts)).toBe(false)
    answer('jon', 1, verses, texts, 'preciso', 'Ana')
    expect(passageDone('jon', 1, verses, texts)).toBe(true)
  })

  it('lets an answer go when the text it was given on changed', () => {
    answer('jon', 1, verses, texts, 'claro', 'Ana')
    expect(answersOf('jon', 1, verses, texts).claro?.by).toBe('Ana')
    expect(answersOf('jon', 1, verses, ['Diosca huairata cacharca.', 'Otra cosa.']).claro).toBeUndefined()
    // Spaces alone are not a change.
    expect(answersOf('jon', 1, verses, ['Diosca  huairata cacharca. ', 'Barcomanta cosascunata shitarca.']).claro).toBeDefined()
  })

  it('keeps what was seen to improve open until someone marks it improved', () => {
    for (const c of CRITERIA) answer('jon', 1, verses, texts, c, 'Ana')
    const o = addObservation('jon', 1, { verse: 5, criterion: 'natural', words: 'cosascunata shitarca', comment: 'Así no se dice', by: 'Bea' })
    expect(openObservations('jon', 1, verses)).toHaveLength(1)
    expect(passageDone('jon', 1, verses, texts)).toBe(false)
    resolveObservation('jon', 1, 5, o.id, 'Ana')
    expect(openObservations('jon', 1, verses)).toHaveLength(0)
    expect(passageDone('jon', 1, verses, texts)).toBe(true)
  })

  it('is not done while the passage has no text', () => {
    for (const c of CRITERIA) answer('jon', 1, verses, ['', ''], c, 'Ana')
    expect(passageDone('jon', 1, verses, ['', ''])).toBe(false)
  })
})
