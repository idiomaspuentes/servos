import { beforeEach, describe, expect, it } from 'vitest'
import { previewBook, receiveBook, type SharedBook } from './share'
import { chooseStructure, joinWithNext, joinedTo, readDraft, structureConflictsOf, textOf, writeDraft } from './work'

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

const book = (verses: SharedBook['verses']): SharedBook => ({ code: 'jon', phase: 'traduccion', verses, alignments: [], checks: {}, studyNotes: [] })
/** A file of loose verses from Bea, gathered by Ana. */
const fromBea = { from: 'Bea', at: '2026-10-16', person: 'Ana' }

describe('verses joined on one side and apart on the other', () => {
  it('waits for a choice when here they are joined and there apart, writing nothing inside the join', () => {
    writeDraft('jon', 1, 1, 'Uno y dos juntos.', 'Ana')
    writeDraft('jon', 1, 2, '', 'Ana')
    joinWithNext('jon', 1, 1, 'Ana')
    const received = book([
      { chapter: 1, verse: 1, text: 'Uno.', by: 'Bea' },
      { chapter: 1, verse: 2, text: 'Dos.', by: 'Bea' },
    ])
    // One choice: the whole stretch, which way it is said (not a version of verse 1 and another of verse 2).
    expect(previewBook(received, false, fromBea).choices).toBe(1)
    receiveBook(received, false, fromBea)
    expect(readDraft('jon', 1, 2)).toBe('')
    expect(textOf('jon', 1, 1)).toBe('Uno y dos juntos.')
    const [c] = structureConflictsOf('jon', 1)
    expect(c).toMatchObject({ from: 1, to: 2 })
    expect(c.received.map((r) => [r.from, r.to, r.text])).toEqual([
      [1, 1, 'Uno.'],
      [2, 2, 'Dos.'],
    ])
  })

  it('waits for a choice when here they are apart and there joined', () => {
    writeDraft('jon', 1, 1, 'Uno.', 'Ana')
    receiveBook(book([{ chapter: 1, verse: 1, text: 'Uno y dos.', by: 'Bea', joinedTo: 2 }]), false, fromBea)
    expect(readDraft('jon', 1, 1)).toBe('Uno.')
    expect(structureConflictsOf('jon', 1)[0]).toMatchObject({ from: 1, to: 2 })
  })

  it('takes the way received where nothing is written here', () => {
    receiveBook(book([{ chapter: 1, verse: 3, text: 'Tres y cuatro.', by: 'Bea', joinedTo: 4 }]), false, fromBea)
    expect(joinedTo('jon', 1, 3)).toBe(4)
    expect(textOf('jon', 1, 4)).toBe('Tres y cuatro.')
    expect(structureConflictsOf('jon', 1)).toEqual([])
  })

  it('keeps the way chosen for the whole stretch', () => {
    writeDraft('jon', 1, 1, 'Uno y dos juntos.', 'Ana')
    joinWithNext('jon', 1, 1, 'Ana')
    receiveBook(book([{ chapter: 1, verse: 1, text: 'Uno.', by: 'Bea' }, { chapter: 1, verse: 2, text: 'Dos.', by: 'Bea' }]), false, fromBea)
    chooseStructure('jon', 1, 1, true, 'Ana')
    expect(joinedTo('jon', 1, 1)).toBeNull()
    expect(readDraft('jon', 1, 1)).toBe('Uno.')
    expect(readDraft('jon', 1, 2)).toBe('Dos.')
    expect(structureConflictsOf('jon', 1)).toEqual([])
  })
})
