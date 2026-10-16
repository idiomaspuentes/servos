import { beforeEach, describe, expect, it } from 'vitest'
import { readCheck, writeCheck } from './noteChecks'
import { addTake, takesOf } from './recordings'
import { readShared, receiveShared, shareProject, previewBook } from './share'
import { authorOf, chooseVersion, joinWithNext, otherVersion, readDraft, writeDraft, studyNotesOf, writeStudyNote } from './work'
import type { Project } from './model'

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
})

const project: Project = {
  id: 'kichwa',
  kind: 'bible',
  name: 'Biblia en kichwa',
  languageName: 'Kichwa',
  languageCode: 'qu',
  direction: 'ltr',
  helpsLanguage: 'es-419',
  font: 'Charis SIL',
  versification: 'eng',
  books: [{ code: 'jon', phase: 'traduccion' }],
  miniApps: { estudio: [], traduccion: ['editor'], revision: [], comunitaria: [], publicacion: [] },
}

/** What Bea's phone shares: written there, then the phone is «another» one (the store emptied). */
function beasFile() {
  writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Bea')
  writeDraft('jon', 1, 2, 'Ninive llaktaman riy', 'Bea')
  writeDraft('jon', 1, 3, 'Jonasqa miticurqa', 'Bea')
  joinWithNext('jon', 1, 3, 'Bea')
  writeCheck('jon', 'n1', { status: 'bien', words: [0], verseText: 'Taytaku rimarqa', by: 'Bea', at: '2026-10-15' })
  writeStudyNote('jon', 1, [1], 'Dios habla primero', 'Bea')
  const text = JSON.stringify(shareProject(project, ['jon'], 'Bea'))
  store.clear()
  return readShared(text)!
}

describe('compartir y recibir', () => {
  it('el archivo trae el libro (su USFM y su diario), las revisiones y las notas de estudio', () => {
    const file = beasFile()
    expect([file.from, file.version]).toEqual(['Bea', 2])
    const jon = file.books[0]
    expect(jon.state!.usfm).toContain('\\v 1 Taytaku rimarqa')
    expect(jon.state!.usfm).toContain('\\v 3-4 Jonasqa miticurqa')
    expect(new Set(jon.state!.journal.map((e) => e.by.split('@')[0]))).toEqual(new Set(['Bea']))
    expect(jon.state!.pending).toEqual([])
    expect(Object.keys(jon.checks.revisionNota)).toEqual(['n1'])
    expect(jon.studyNotes[0].notes[0].text).toBe('Dios habla primero')
  })

  it('antes de recibir dice qué cambia: lo nuevo, lo igual y lo escrito distinto', () => {
    const file = beasFile()
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Ana')
    writeDraft('jon', 1, 2, 'Ninive llaktaman rimay', 'Ana')
    const p = previewBook(file.books[0], false, { from: file.from, at: file.at, person: 'Ana' })
    expect([p.taken, p.same, p.choices]).toEqual([1, 1, 1])
    expect(readDraft('jon', 1, 3)).toBe('')
  })

  it('al recibir, nada escrito aquí se pisa: lo distinto espera como otra versión; lo demás sigue a su texto', () => {
    const file = beasFile()
    writeDraft('jon', 1, 2, 'Ninive llaktaman rimay', 'Ana')
    writeStudyNote('jon', 1, [1], 'Jehová llama', 'Ana')
    const { projects, books } = receiveShared(file, ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], 'Ana')
    expect(projects).toHaveLength(1)
    expect(readDraft('jon', 1, 1)).toBe('Taytaku rimarqa')
    expect(readDraft('jon', 1, 2)).toBe('Ninive llaktaman rimay')
    expect(otherVersion('jon', 1, 2)).toEqual({ text: 'Ninive llaktaman riy', by: 'Bea' })
    expect(readDraft('jon', 1, 3)).toBe('Jonasqa miticurqa')
    expect(readCheck('jon', 'n1')?.by).toBe('Bea')
    expect(books[0].checksTaken).toBe(1)
    expect(studyNotesOf('jon', 1)[0].text).toBe('Jehová llama\n\n— Bea: Dios habla primero')
  })

  it('un proyecto que no está aquí se agrega como nuevo, con sus libros', () => {
    const file = beasFile()
    const { projects, projectId } = receiveShared(file, ['jon'], { kind: 'new' }, [{ ...project, books: [] }], 'Ana')
    expect(projects).toHaveLength(2)
    expect(projectId).toBe('kichwa-2')
    expect(projects[1].books.map((b) => b.code)).toEqual(['jon'])
  })

  it('lo que alguien ya eligió no se vuelve a preguntar, aunque el archivo llegue otra vez', () => {
    const file = beasFile()
    writeDraft('jon', 1, 2, 'Ninive llaktaman rimay', 'Ana')
    receiveShared(file, ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], 'Ana')
    chooseVersion('jon', 1, 2, false, 'Ana')
    expect(otherVersion('jon', 1, 2)).toBeNull()
    expect(previewBook(file.books[0], false, { from: file.from, at: file.at, person: 'Ana' }).choices).toBe(0)
    receiveShared(file, ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], 'Ana')
    expect([readDraft('jon', 1, 2), otherVersion('jon', 1, 2)]).toEqual(['Ninive llaktaman rimay', null])
  })

  it('un archivo de la primera versión (versículos sueltos) se recibe igual', () => {
    const file = beasFile()
    const old = { ...file, version: 1 as const, books: [{ ...file.books[0], state: undefined, verses: [{ chapter: 1, verse: 1, text: 'Taytaku rimarqa', by: 'Bea' }] }] }
    receiveShared(old, ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], 'Ana')
    expect([readDraft('jon', 1, 1), authorOf('jon', 1, 1)]).toEqual(['Taytaku rimarqa', 'Bea'])
  })
})

describe('recordings in a work package', () => {
  it('carries each take of a place, and gathers in only those that came with their sound, without it in what is kept', () => {
    addTake('jon', 1, 1, { by: 'Bea', at: '', ms: 900, mime: 'audio/webm', to: 3 }, 'bea1')
    const file = shareProject(project, ['jon'], 'Bea')
    expect(file.books[0].recordings?.[0]).toMatchObject({ chapter: 1, verse: 1, takes: [{ id: 'bea1', to: 3 }] })
    store.clear()
    // Sound is added by withSounds (IndexedDB); here, as if it had been read.
    const takes = file.books[0].recordings![0].takes
    file.books[0].recordings![0].takes = [{ ...takes[0], sound: btoa('ok') }, { ...takes[0], id: 'mute' }]
    expect(previewBook(file.books[0], true, { from: file.from, at: file.at, person: 'Ana' }).recordings).toBe(1)
    const { books } = receiveShared(file, ['jon'], { kind: 'new' }, [], 'Ana')
    expect(books[0].recordingsTaken).toBe(1)
    expect(takesOf('jon', 1, 1).map((x) => x.id)).toEqual(['bea1'])
    expect(JSON.stringify(takesOf('jon', 1, 1))).not.toContain('sound')
  })
})
