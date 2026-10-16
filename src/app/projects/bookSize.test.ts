import { expect, it } from 'vitest'
import { bookStateOf, forgetBooks, readDraft, writeDraft } from './bookText'

/**
 * A book the size of Psalms (150 chapters, 2,400 verses written) on a computer: a letter typed, a verse read and a
 * change taken by the journal stay quick. Read whole at each letter it took 200 ms here (a second on a phone); by its
 * chapters, about 5 ms. The bounds are wide, to catch the book being read whole again, not small differences.
 */
it('keeps a book the size of Psalms quick to write in, letter by letter', () => {
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
  forgetBooks()
  const verse = 'Bienaventurado el varón que no anduvo en consejo de malos, ni estuvo en camino de pecadores.'
  const lines = ['\\id PSA', '\\usfm 3.0']
  for (let c = 1; c <= 150; c++) {
    lines.push(`\\c ${c}`, '\\p')
    for (let v = 1; v <= 16; v++) lines.push(`\\v ${v} ${verse}`)
  }
  const usfm = lines.join('\n') + '\n'
  store.set('servos.libro.psa', JSON.stringify({ state: { book: 'psa', usfm, journal: [], pending: [] }, working: usfm, pendingBy: null, pendingAt: [] }))

  let t = performance.now()
  expect(readDraft('psa', 75, 8)).toBe(verse)
  const firstRead = performance.now() - t
  t = performance.now()
  for (let i = 1; i <= 10; i++) writeDraft('psa', 75, 8, verse + ' x'.repeat(i), 'Ana')
  const perLetter = (performance.now() - t) / 10
  t = performance.now()
  const state = bookStateOf('psa')!
  const journal = performance.now() - t

  expect(state.journal.map((e) => [e.place.chapter, e.place.from, e.by.split('@')[0]])).toEqual([[75, 8, 'Ana']])
  expect(readDraft('psa', 75, 8)).toBe(verse + ' x'.repeat(10))
  expect({ firstRead: firstRead < 100, perLetter: perLetter < 60, journal: journal < 100 }).toEqual({ firstRead: true, perLetter: true, journal: true })
})
