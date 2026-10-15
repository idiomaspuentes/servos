import { beforeEach, describe, expect, it } from 'vitest'
import type { PrototypeData } from '../../prototype/data'
import { bookUsfm } from './usfmExport'
import { readUsfmBook } from './usfmImport'
import { joinWithNext, writeDraft } from './work'

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

// A chapter as the bridge text gives it: verses 1–2 one paragraph, 3 another, 4 a poem of two lines.
const chapter = {
  chapter: 1,
  verses: [1, 2, 3, 4].map((verse) => ({ verse, notes: [], questions: [], words: [] })),
  texts: [
    {
      abbreviation: 'TPL',
      pieces: [
        { kind: 'paragraph', verses: [{ verse: 1, text: '' }, { verse: 2, text: '' }] },
        { kind: 'paragraph', verses: [{ verse: 3, text: '' }] },
        { kind: 'paragraph', verses: [{ verse: 4, text: '' }] },
      ],
      lines: { 1: [{ marker: 'p', pieces: [] }], 2: [{ marker: 'p', pieces: [] }], 3: [{ marker: 'p', pieces: [] }], 4: [{ marker: 'q1', pieces: [] }, { marker: 'q2', pieces: [] }] },
    },
  ],
} as unknown as PrototypeData

describe('a book written as USFM', () => {
  it('follows the bridge text: its paragraphs, a poem line by line, a join as one verse', () => {
    writeDraft('jon', 1, 1, 'Shuk punchami.', 'Ana')
    writeDraft('jon', 1, 2, 'Ri.', 'Ana')
    writeDraft('jon', 1, 4, 'Kayarkani\nuyarkanki', 'Ana')
    joinWithNext('jon', 1, 1, 'Ana')
    const usfm = bookUsfm('jon', 'Biblia en kichwa', [chapter])
    expect(usfm).toContain('\\id JON Biblia en kichwa')
    expect(usfm).toContain('\\c 1\n\\p\n\\v 1-2 Shuk punchami. Ri.\n\\p\n\\v 3\n\\q1 \\v 4 Kayarkani\n\\q2 uyarkanki\n')
  })

  it('reads back as the same verses', () => {
    writeDraft('jon', 1, 1, 'Shuk punchami.', 'Ana')
    writeDraft('jon', 1, 3, 'Kimsa.', 'Ana')
    const { code, book } = readUsfmBook(bookUsfm('jon', 'Kichwa', [chapter]), 'Bea')
    expect(code).toBe('jon')
    expect(book.verses.map((v) => [v.verse, v.text])).toEqual([
      [1, 'Shuk punchami.'],
      [3, 'Kimsa.'],
    ])
  })
})
