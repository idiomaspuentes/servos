import { beforeEach, describe, expect, it } from 'vitest'
import type { PrototypeData } from '../../prototype/data'
import { categoryOf, checksOf, readCheck, stateOf, writeCheck, type NoteCheck } from './noteChecks'

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

const note = (id: string, academy: string | null) => ({ id, quote: 'q', glt: null, gst: null, note: 'n', academy, places: {} })
const chapter = (n: number, verses: Array<[number, ReturnType<typeof note>[]]>) =>
  ({ chapter: n, verses: verses.map(([verse, notes]) => ({ verse, notes, questions: [], words: [] })) }) as unknown as PrototypeData

describe('revisar con las notas', () => {
  it('solo las notas que envían a un artículo, una vez cada una, en el orden de los versículos, con su categoría', () => {
    const items = checksOf([
      chapter(1, [
        [1, [note('a', 'translate/figs-metaphor'), note('b', null)]],
        [2, [note('c', 'translate/figs-activepassive'), note('a', 'translate/figs-metaphor')]],
      ]),
      chapter(2, [[1, [note('d', 'translate/translate-names')]]]),
    ])
    expect(items.map((i) => [i.note.id, i.chapter, i.verse, i.category])).toEqual([
      ['a', 1, 1, 'figures'],
      ['c', 1, 2, 'grammar'],
      ['d', 2, 1, 'culture'],
    ])
    expect(categoryOf('translate/figs-something-new')).toBe('other')
    expect(categoryOf('translate/grammar-connect-time-sequential')).toBe('grammar')
  })

  it('una nota queda resuelta solo si se marcó bien y el versículo sigue igual', () => {
    const check: NoteCheck = { status: 'bien', words: [2, 3], verseText: 'Jonás oró a Dios', by: 'Ana', at: '2026-10-15' }
    writeCheck('jon', 'a', check)
    expect(stateOf(readCheck('jon', 'a'), 'Jonás oró a Dios')).toBe('bien')
    expect(stateOf(readCheck('jon', 'a'), 'Jonás oró a su Dios')).toBe('cambio')
    expect(stateOf({ ...check, status: 'despues' }, 'Jonás oró a Dios')).toBe('despues')
    expect(stateOf(null, 'Jonás oró a Dios')).toBe('pendiente')
  })
})
