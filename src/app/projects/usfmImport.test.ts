import { beforeEach, describe, expect, it } from 'vitest'
import { chooseVersion, otherVersion, readDraft, joinedTo, writeDraft } from './work'
import { previewBook, receiveBook } from './share'
import { readUsfmBook } from './usfmImport'

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

const JONAH = String.raw`\id JON Kichwa
\h Jonás
\c 1
\p
\v 1 \zaln-s |x-strong="H1961"\*\w Shuk|x-occurrence="1"\w*\zaln-e\* punchami Diosca rimarca.
\v 2 Nínive llactaman ri.
\v 3-4 Jonasca miticurcami, shinallatac huaira shamurca.
\c 2
\v 1 \f + \ft una nota\f*Jonasca mañarcami.
`

/** A USFM file Rosa had, read in by Ana. */
const fromFile = { from: 'Rosa', at: 'usfm:JON', person: 'Ana' }

describe('a book brought in from a USFM file', () => {
  it('reads the book, each verse as it is read, and a bridge as verses joined', () => {
    const { code, verses, book } = readUsfmBook(JONAH, 'Rosa')
    expect(code).toBe('jon')
    expect(verses).toBe(4)
    expect(book.verses![0]).toMatchObject({ chapter: 1, verse: 1, text: 'Shuk punchami Diosca rimarca.', by: 'Rosa' })
    expect(book.verses![2]).toMatchObject({ chapter: 1, verse: 3, joinedTo: 4 })
    expect(book.verses![3].text).toBe('Jonasca mañarcami.')
  })

  it('says when the book is not one it knows', () => {
    expect(readUsfmBook('\\id XYZ\n\\c 1\n\\v 1 algo', 'Rosa').code).toBeNull()
  })

  it('fills what is empty, leaves what is the same, and keeps two versions of what differs', () => {
    writeDraft('jon', 1, 1, 'Shuk punchami Diosca rimarca.', 'Ana')
    writeDraft('jon', 1, 2, 'Ninive llactaman rii.', 'Ana')
    const { book } = readUsfmBook(JONAH, 'Rosa')
    expect(previewBook(book, false, fromFile)).toMatchObject({ taken: 2, same: 1, choices: 1 })
    receiveBook(book, false, fromFile)
    expect(readDraft('jon', 1, 2)).toBe('Ninive llactaman rii.')
    expect(otherVersion('jon', 1, 2)?.text).toBe('Nínive llactaman ri.')
    expect(readDraft('jon', 1, 3)).toContain('Jonasca miticurcami')
    expect(joinedTo('jon', 1, 3)).toBe(4)
  })

  it('does not ask again what was chosen, when the same file is read in again', () => {
    writeDraft('jon', 1, 2, 'Ninive llactaman rii.', 'Ana')
    const { book } = readUsfmBook(JONAH, 'Rosa')
    receiveBook(book, false, fromFile)
    chooseVersion('jon', 1, 2, false, 'Ana')
    expect(previewBook(readUsfmBook(JONAH, 'Rosa').book, false, fromFile)).toMatchObject({ choices: 0 })
    receiveBook(readUsfmBook(JONAH, 'Rosa').book, false, fromFile)
    expect([readDraft('jon', 1, 2), otherVersion('jon', 1, 2)]).toEqual(['Ninive llactaman rii.', null])
  })
})
