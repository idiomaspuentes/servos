import { expect, it } from 'vitest'
import { placesOf } from '../../core'
import { bookStateOf, forgetBooks, readDraft, writeDraft } from './bookText'

/**
 * A book the size of Psalms (150 chapters, 2,400 verses written): a letter typed, a verse read and a change taken by
 * the journal stay quick. Read whole at each letter it took 200 ms on a computer (a second on a phone); by its
 * chapters, about 5 ms. Each is weighed against reading the whole book once, measured in the same run, so tests
 * running alongside slow both alike: what reads the book whole again costs as much as that, or more.
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

  // The whole book read once, first (it also warms the reader, so what follows is not measured cold).
  let whole = Infinity
  for (let round = 0; round < 3; round++) {
    const w = performance.now()
    placesOf(usfm)
    whole = Math.min(whole, performance.now() - w)
  }
  // Each measure the best of three: a burst of other work slows one round, not three.
  let firstRead = Infinity
  for (let round = 0; round < 3; round++) {
    forgetBooks()
    const r = performance.now()
    expect(readDraft('psa', 75, 8)).toBe(verse)
    firstRead = Math.min(firstRead, performance.now() - r)
  }
  let t = 0
  let perLetter = Infinity
  for (let round = 0; round < 3; round++) {
    t = performance.now()
    for (let i = 1; i <= 10; i++) writeDraft('psa', 75, 8, verse + ' x'.repeat(round * 10 + i), 'Ana')
    perLetter = Math.min(perLetter, (performance.now() - t) / 10)
  }
  t = performance.now()
  const state = bookStateOf('psa')!
  let journal = performance.now() - t
  for (let round = 1; round <= 2; round++) {
    writeDraft('psa', 75, 9, verse + ' y'.repeat(round), 'Ana')
    t = performance.now()
    bookStateOf('psa')
    journal = Math.min(journal, performance.now() - t)
  }

  expect(state.journal.map((e) => [e.place.chapter, e.place.from, e.by.split('@')[0]])).toEqual([[75, 8, 'Ana']])
  expect(readDraft('psa', 75, 8)).toBe(verse + ' x'.repeat(30))
  const said = `whole ${whole.toFixed(1)} ms · first read ${firstRead.toFixed(1)} · a letter ${perLetter.toFixed(1)} · journal ${journal.toFixed(1)}`
  expect(firstRead, said).toBeLessThan(whole / 2)
  expect(perLetter, said).toBeLessThan(whole / 5)
  expect(journal, said).toBeLessThan(whole / 2)
})
