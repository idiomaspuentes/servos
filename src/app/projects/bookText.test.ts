import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { authorOf, bookStateOf, deviceId, forgetBooks, joinWithNext, moveBooksToProjects, openBooks, readDraft, separateJoined, writeDraft } from './bookText'
import { inProject, moveWorkToProjects, setProject } from './scope'

let store = new Map<string, string>()
beforeEach(() => {
  store = new Map()
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
})

/** Every source file of the app, tests aside. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

/** The journal's changes of a verse, as `who: text`. */
const changesAt = (chapter: number, verse: number) =>
  bookStateOf('jon')!
    .journal.filter((e) => e.place.chapter === chapter && e.place.from === verse)
    .map((e) => `${e.by.slice(0, e.by.lastIndexOf('@'))}: ${e.text}`)

describe('the book text has one door', () => {
  it('lets no file but bookText.ts touch where verses, writers, joins, versions and conflicts are kept', () => {
    const app = join(__dirname, '..')
    const kept = /[.'`](borrador|autor|union|otra|estructura)\./
    const others = sources(app)
      .filter((f) => !f.endsWith('bookText.ts'))
      .filter((f) => kept.test(readFileSync(f, 'utf8')))
      .map((f) => relative(app, f))
    expect(others).toEqual([])
  })
})

describe('behind the door, the book is one USFM and its journal', () => {
  it('lays the book out as its bridge text is, every verse there, the poem in its lines', () => {
    writeDraft('jon', 2, 3, 'Kayarkani\nuyarkanki', 'Ana')
    const usfm = bookStateOf('jon')!.usfm
    expect(usfm).toContain('\\c 4')
    expect(usfm).toContain('\\v 11')
    expect(usfm).toContain('\\q \\v 3 Kayarkani\n\\q2 uyarkanki')
    expect(readDraft('jon', 2, 3)).toBe('Kayarkani\nuyarkanki')
  })

  it('takes a verse typed letter by letter as one change of its writer', () => {
    for (const typed of ['S', 'Sh', 'Shu', 'Shuk']) writeDraft('jon', 1, 1, typed, 'Ana')
    expect(changesAt(1, 1)).toEqual(['Ana: Shuk'])
    expect(bookStateOf('jon')!.journal.find((e) => e.place.from === 1)?.by).toBe(`Ana@${deviceId()}`)
  })

  it('keeps each person’s change apart when another begins to write', () => {
    writeDraft('jon', 1, 1, 'Shuk punchami.', 'Ana')
    writeDraft('jon', 1, 2, 'Ri.', 'Bea')
    writeDraft('jon', 1, 1, 'Shuk punchami, Taytaku.', 'Bea')
    expect(changesAt(1, 1)).toEqual(['Ana: Shuk punchami.', 'Bea: Shuk punchami, Taytaku.'])
    expect(authorOf('jon', 1, 1)).toBe('Bea')
    expect(authorOf('jon', 1, 2)).toBe('Bea')
    expect(authorOf('jon', 1, 3)).toBeNull()
  })

  it('reads who wrote a verse from the journal, also on another visit', () => {
    writeDraft('jon', 1, 4, 'Wayra.', 'Carla')
    bookStateOf('jon')
    forgetBooks()
    expect(readDraft('jon', 1, 4)).toBe('Wayra.')
    expect(authorOf('jon', 1, 4)).toBe('Carla')
  })

  it('writes verses joined as one USFM verse, and parts them again with the text in the first', () => {
    writeDraft('jon', 1, 1, 'Shuk punchami.', 'Ana')
    writeDraft('jon', 1, 2, 'Ri.', 'Ana')
    joinWithNext('jon', 1, 1, 'Ana')
    expect(bookStateOf('jon')!.usfm).toContain('\\v 1-2 Shuk punchami. Ri.')
    expect(readDraft('jon', 1, 2)).toBe('')
    separateJoined('jon', 1, 1, 'Ana')
    expect(bookStateOf('jon')!.usfm).toMatch(/\\v 1 Shuk punchami\. Ri\.\s+\\v 2\s/)
  })

  it('moves the text the prototype kept verse by verse into the book once, each verse with its writer', async () => {
    store.set('servos.prototipo.borrador.jon.1.1', 'Shuk punchami.')
    store.set('servos.prototipo.autor.jon.1.1', 'Ana')
    store.set('servos.prototipo.borrador.jon.1.2', 'Ri, Ninive llaktaman.')
    store.set('servos.prototipo.autor.jon.1.2', 'Bea')
    store.set('servos.prototipo.union.jon.1.2', '3')
    await openBooks()
    expect(readDraft('jon', 1, 1)).toBe('Shuk punchami.')
    expect(authorOf('jon', 1, 1)).toBe('Ana')
    expect(bookStateOf('jon')!.usfm).toContain('\\v 2-3 Ri, Ninive llaktaman.')
    expect(authorOf('jon', 1, 3)).toBe('Bea')
    // A second opening moves nothing again.
    writeDraft('jon', 1, 1, 'Shuk punchami, Taytaku.', 'Ana')
    await openBooks()
    expect(readDraft('jon', 1, 1)).toBe('Shuk punchami, Taytaku.')
  })
})

describe('each project keeps its own work of a book', () => {
  const projects = [
    { id: 'kichwa', books: [{ code: 'jon' }] },
    { id: 'quechua', books: [{ code: 'jon' }, { code: 'tit' }] },
    { id: 'aymara', books: [{ code: 'tit' }] },
  ]

  it('keeps two projects’ Jonah apart', () => {
    inProject('kichwa', () => writeDraft('jon', 1, 1, 'Shuk punchami.', 'Ana'))
    inProject('quechua', () => writeDraft('jon', 1, 1, 'Huk punchaw.', 'Bea'))
    expect(inProject('kichwa', () => [readDraft('jon', 1, 1), authorOf('jon', 1, 1)])).toEqual(['Shuk punchami.', 'Ana'])
    expect(inProject('quechua', () => [readDraft('jon', 1, 1), authorOf('jon', 1, 1)])).toEqual(['Huk punchaw.', 'Bea'])
  })

  it('finds nothing outside a project: a place that forgets to say it shows empty, not another project’s work', () => {
    inProject('kichwa', () => writeDraft('jon', 1, 1, 'Shuk punchami.', 'Ana'))
    setProject(null)
    expect(readDraft('jon', 1, 1)).toBe('')
  })

  it('moves work kept by the book alone into each project that has the book, once, and forgets the shared copy', () => {
    setProject(null)
    writeDraft('jon', 1, 1, 'Shuk punchami.', 'Ana')
    store.set('servos.prototipo.alineacion.jon.UGNT.1.1', '{"groups":[]}')
    store.set('servos.prototipo.posicion.Ana.jon.editor', '{"chapter":1,"verse":5}')
    moveBooksToProjects(projects)
    moveWorkToProjects(projects)
    expect(inProject('kichwa', () => readDraft('jon', 1, 1))).toBe('Shuk punchami.')
    expect(inProject('quechua', () => readDraft('jon', 1, 1))).toBe('Shuk punchami.')
    expect(inProject('aymara', () => readDraft('jon', 1, 1))).toBe('')
    expect(readDraft('jon', 1, 1)).toBe('')
    expect([...store.keys()].filter((k) => k.includes('alineacion')).sort()).toEqual([
      'servos.prototipo.alineacion.jon~kichwa.UGNT.1.1',
      'servos.prototipo.alineacion.jon~quechua.UGNT.1.1',
    ])
    expect(store.get('servos.prototipo.posicion.Ana.jon~quechua.editor')).toBe('{"chapter":1,"verse":5}')
    // From then on, each project's copy goes its own way.
    inProject('quechua', () => writeDraft('jon', 1, 1, 'Huk punchaw.', 'Bea'))
    expect(inProject('kichwa', () => readDraft('jon', 1, 1))).toBe('Shuk punchami.')
  })
})
