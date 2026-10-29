import { beforeEach, describe, expect, it } from 'vitest'
import { homeBooks, noteRecentBook, recentBooksOf } from './recentBooks'
import { keysOfProject } from './forget'

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

const NT = ['mat', 'mrk', 'luk', 'jhn', 'act', 'rom', '1co', '2co', 'gal', 'eph']

describe('recent books', () => {
  it('keeps the book opened last first, once', () => {
    noteRecentBook('p', 'jon')
    noteRecentBook('p', 'rut')
    noteRecentBook('p', 'jon')
    expect(recentBooksOf('p')).toEqual(['jon', 'rut'])
    expect(recentBooksOf('other')).toEqual([])
  })

  it('keeps a dozen at most', () => {
    for (const b of [...NT, 'php', 'col', '1th', '2th']) noteRecentBook('p', b)
    expect(recentBooksOf('p')).toHaveLength(12)
    expect(recentBooksOf('p')[0]).toBe('2th')
  })

  it('is forgotten with its project', () => {
    expect(keysOfProject('p', ['servos.prototipo.recientes.p', 'servos.prototipo.recientes.q'])).toEqual(['servos.prototipo.recientes.p'])
  })
})

describe('the books home lists', () => {
  it('lists all of a few books, those opened last first', () => {
    expect(homeBooks(['jon', 'rut', 'tit'], ['tit'])).toEqual({ listed: ['tit', 'jon', 'rut'], all: true })
    // Hiding one or two behind a row saves nothing.
    expect(homeBooks(NT.slice(0, 5), [])).toEqual({ listed: NT.slice(0, 5), all: true })
  })

  it('lists three of many, the ones opened last, then the project order', () => {
    expect(homeBooks(NT, ['gal', 'nothere', 'mrk'])).toEqual({ listed: ['gal', 'mrk', 'mat'], all: false })
    expect(homeBooks(NT, [])).toEqual({ listed: ['mat', 'mrk', 'luk'], all: false })
  })
})
