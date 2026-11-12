import { describe, expect, it } from 'vitest'
import type { PrototypeData, PrototypeNote } from '../../prototype/data'
import { issuesOfBook, issuesOfBookKept, issuesOfSection, noteGist, notesInBook } from './bookIssues'

type N = { id: string; academy: string | null; quote?: string; note?: string }

/** A chapter with only what the issues read: its verses' notes and the articles it carries. */
function chapter(n: number, verses: Record<number, N[]>, academy: PrototypeData['academy'] = {}): { chapter: number; data: PrototypeData } {
  const data = {
    chapter: n,
    verses: Object.entries(verses).map(([v, notes]) => ({
      verse: Number(v),
      notes: notes.map((x): PrototypeNote => ({ id: x.id, quote: x.quote ?? '', glt: null, gst: null, note: x.note ?? `nota ${x.id}`, academy: x.academy, places: {} })),
      questions: [],
      words: [],
    })),
    academy,
  } as unknown as PrototypeData
  return { chapter: n, data }
}

const META = 'translate/figs-metaphor'
const PASSIVE = 'translate/figs-activepassive'
const DOUBLET = 'translate/figs-doublet'
const article = (title: string) => ({ title, markdown: `# ${title}\n\ntexto` })

describe('issuesOfBook', () => {
  it('puts the most used first, then by title', () => {
    const issues = issuesOfBook([
      chapter(1, { 1: [{ id: 'a', academy: META }, { id: 'b', academy: PASSIVE }], 2: [{ id: 'c', academy: META }, { id: 'd', academy: DOUBLET }] }, {
        [META]: article('Metáfora'),
        [PASSIVE]: article('Voz pasiva'),
        [DOUBLET]: article('Doblete'),
      }),
      chapter(2, { 3: [{ id: 'e', academy: META }, { id: 'f', academy: DOUBLET }] }),
    ])
    expect(issues.map((i) => [i.title, i.notes.length])).toEqual([
      ['Metáfora', 3],
      ['Doblete', 2],
      ['Voz pasiva', 1],
    ])
  })

  it('counts a note over two verses once, at its first verse, covering both', () => {
    const [issue] = issuesOfBook([chapter(1, { 1: [{ id: 'n1', academy: META }], 2: [{ id: 'n1', academy: META }] })])
    expect(issue.notes).toHaveLength(1)
    expect(issue.notes[0]).toMatchObject({ chapter: 1, verse: 1, covers: [1, 2], id: 'n1' })
  })

  it('leaves out notes without an article', () => {
    expect(issuesOfBook([chapter(1, { 1: [{ id: 'a', academy: null }] })])).toEqual([])
  })

  it('counts the chapters an issue is in', () => {
    const [issue] = issuesOfBook([chapter(1, { 1: [{ id: 'a', academy: META }] }), chapter(2, { 1: [] }), chapter(3, { 4: [{ id: 'b', academy: META }] })])
    expect(issue.chapters).toBe(2)
  })

  it('names an article not on the device by its last part', () => {
    const [here] = issuesOfBook([chapter(1, { 1: [{ id: 'a', academy: META }] }, { [META]: article('Metáfora') })])
    expect(here).toMatchObject({ title: 'Metáfora', onDevice: true })
    // The loaders keep an article not found with its path as the title and no text.
    const [away] = issuesOfBook([chapter(1, { 1: [{ id: 'a', academy: META }] }, { [META]: { title: META, markdown: '' } })])
    expect(away).toMatchObject({ title: 'figs-metaphor', onDevice: false })
  })
})

describe('issuesOfBookKept', () => {
  it('gives the same answer while the chapters are the same, and a new one when one changes', () => {
    const a = chapter(1, { 1: [{ id: 'a', academy: META }] })
    const b = chapter(2, { 1: [{ id: 'b', academy: META }] })
    const first = issuesOfBookKept([a, b])
    expect(issuesOfBookKept([{ ...a }, { ...b }])).toBe(first)
    const b2 = chapter(2, { 1: [{ id: 'b', academy: PASSIVE }] })
    const next = issuesOfBookKept([a, b2])
    expect(next).not.toBe(first)
    expect(next.map((i) => i.path)).toEqual([PASSIVE, META])
  })
})

describe('issuesOfSection', () => {
  const issues = issuesOfBook([
    chapter(1, {
      1: [{ id: 'n1', academy: META }, { id: 'p', academy: PASSIVE }],
      2: [{ id: 'n1', academy: META }, { id: 'm2', academy: META }],
      3: [{ id: 'p2', academy: PASSIVE }],
    }, { [META]: article('Metáfora'), [PASSIVE]: article('Voz pasiva') }),
    chapter(2, { 2: [{ id: 'x', academy: DOUBLET }] }),
  ])

  it('gives each issue of the section once, with its verses there, in the book order', () => {
    expect(issuesOfSection(issues, 1, [1, 2]).map((r) => [r.issue.path, r.verses])).toEqual([
      [META, [1, 2]],
      [PASSIVE, [1]],
    ])
  })

  it('finds a note over two verses from either', () => {
    expect(issuesOfSection(issues, 1, [2, 3]).map((r) => [r.issue.path, r.verses])).toEqual([
      [META, [2]],
      [PASSIVE, [3]],
    ])
  })

  it('looks in the chapter asked only', () => {
    expect(issuesOfSection(issues, 2, [1, 2]).map((r) => r.issue.path)).toEqual([DOUBLET])
  })
})

describe('notesInBook', () => {
  const issues = issuesOfBook([
    chapter(1, { 1: [{ id: 'a', academy: META }], 4: [{ id: 'b', academy: META }] }),
    chapter(2, { 5: [{ id: 'c', academy: META }], 6: [{ id: 'd', academy: META }] }),
  ])

  it('puts the notes on the section first, marked here', () => {
    expect(notesInBook(issues, META, { chapter: 2, verses: [5] })?.map((n) => [n.id, n.here])).toEqual([
      ['c', true],
      ['a', false],
      ['b', false],
      ['d', false],
    ])
  })

  it('keeps the book order without a section', () => {
    expect(notesInBook(issues, META)?.map((n) => n.id)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('is null for an article the book does not use', () => {
    expect(notesInBook(issues, 'translate/unused')).toBeNull()
  })
})

describe('noteGist', () => {
  it('is the first line, without markdown', () => {
    expect(noteGist('**Siervo** es una [metáfora](rc://*/ta/man/translate/figs-metaphor).\nOtra línea')).toBe('Siervo es una metáfora.')
  })

  it('also ends at a written line end', () => {
    expect(noteGist('# Título\\nSigue')).toBe('Título')
  })
})
