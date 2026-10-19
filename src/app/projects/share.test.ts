import { beforeEach, describe, expect, it } from 'vitest'
import { readCheck, writeCheck } from './noteChecks'
import { addTake, takesOf } from './recordings'
import { alignmentConflictAt, chooseAlignment, readAlignment, writeAlignment } from './alignment'
import { moveAlignmentsIn } from './bookText'
import { readShared, receiveShared, shareProject, previewBook } from './share'
import { addObservation, answer, answersOf, observationsOf, resolveObservation } from './passageReview'
import { authorOf, chooseVersion, joinWithNext, otherVersion, readDraft, writeDraft, studyNotesOf, writeStudyNote } from './work'
import type { Project } from './model'
import { setProject } from './scope'

let store = new Map<string, string>()
beforeEach(() => {
  // As in the app, the work is read and written in the project shown (here, Kichwa's Bible).
  setProject('kichwa')
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

  it('quién puede ver el trabajo viaja con el proyecto, y al juntar queda el más reservado', () => {
    const closed = { ...beasFile(), project: { ...beasFile().project, privacy: 'equipo' as const } }
    expect(receiveShared(closed, ['jon'], { kind: 'new' }, [], 'Ana').projects[0].privacy).toBe('equipo')
    expect(receiveShared(closed, ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], 'Ana').projects[0].privacy).toBe('equipo')
    // Open from another phone does not open what is closed here.
    expect(receiveShared(beasFile(), ['jon'], { kind: 'join', projectId: 'kichwa' }, [{ ...project, privacy: 'equipo' }], 'Ana').projects[0].privacy).toBe('equipo')
    expect(receiveShared(beasFile(), ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], 'Ana').projects[0].privacy).toBeUndefined()
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

describe('la alineación viaja con el libro y sigue a su texto', () => {
  const links = (word: string) => [{ sources: [{ content: word, occurrence: 1, occurrences: 1, strong: '', lemma: '' }], targets: [{ word, occurrence: 1, occurrences: 1 }] }]
  /** Bea writes and aligns 1:1 on her phone, and shares; then the phone is «another» one. */
  function beaAligned(text = 'Taytaku rimarqa') {
    writeDraft('jon', 1, 1, text, 'Bea')
    writeAlignment('jon', 1, 1, 'UHB', { groups: links('Taytaku') as never, text, by: 'Bea' })
    const file = readShared(JSON.stringify(shareProject(project, ['jon'], 'Bea')))!
    store.clear()
    return file
  }
  const receive = (file: ReturnType<typeof beaAligned>) => receiveShared(file, ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], 'Ana').books[0]

  it('llega con el libro, con quien la hizo', () => {
    const got = receive(beaAligned())
    expect(got.alignmentsTaken).toBe(1)
    expect(readAlignment('jon', 1, 1, 'UHB')).toMatchObject({ text: 'Taytaku rimarqa', by: 'Bea' })
  })

  it('dos personas que alinean el mismo texto de otra manera eligen una; lo elegido no se vuelve a preguntar', () => {
    const file = beaAligned()
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Ana')
    writeAlignment('jon', 1, 1, 'UHB', { groups: links('rimarqa') as never, text: 'Taytaku rimarqa', by: 'Ana' })
    expect(receive(file).alignmentChoices).toBe(1)
    expect(alignmentConflictAt('jon', 1, 1, 'UHB')?.theirs.by).toBe('Bea')
    chooseAlignment('jon', 1, 1, 'UHB', true, 'Ana')
    expect(readAlignment('jon', 1, 1, 'UHB')?.groups).toEqual(links('Taytaku'))
    expect(receive(file).alignmentChoices).toBe(0)
    expect(alignmentConflictAt('jon', 1, 1, 'UHB')).toBeNull()
  })

  it('una hecha sobre otro texto que el que queda entra igual, para revisar, y no pisa la hecha sobre el texto que queda', () => {
    const file = beaAligned('Taytaku nirqa')
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Ana')
    receive(file)
    // Ana's text stays (Bea's waits as the other version); Bea's alignment comes, made on her text.
    expect(readDraft('jon', 1, 1)).toBe('Taytaku rimarqa')
    expect(readAlignment('jon', 1, 1, 'UHB')).toMatchObject({ text: 'Taytaku nirqa', by: 'Bea' })
    writeAlignment('jon', 1, 1, 'UHB', { groups: links('rimarqa') as never, text: 'Taytaku rimarqa', by: 'Ana' })
    receive(file)
    expect(readAlignment('jon', 1, 1, 'UHB')).toMatchObject({ text: 'Taytaku rimarqa', by: 'Ana' })
  })

  it('las alineaciones guardadas versículo por versículo pasan a la capa del libro, una vez', () => {
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Ana')
    store.set('servos.prototipo.alineacion.jon~kichwa.UHB.1.1', JSON.stringify({ groups: links('Taytaku'), text: 'Taytaku rimarqa', by: 'Carlos', at: '2026-10-10' }))
    moveAlignmentsIn()
    expect(readAlignment('jon', 1, 1, 'UHB')).toMatchObject({ by: 'Carlos', text: 'Taytaku rimarqa' })
    expect([...store.keys()].some((k) => k.includes('.alineacion.'))).toBe(false)
  })
})

describe('un versículo borrado a propósito', () => {
  it('llega borrado al teléfono que lo tenía de quien lo borró', () => {
    const bea = new Map<string, string>()
    const ana = new Map<string, string>()
    const share = () => readShared(JSON.stringify(shareProject(project, ['jon'], 'Bea')))!
    const receive = (file: ReturnType<typeof share>) => receiveShared(file, ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], 'Ana')
    store = bea
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Bea')
    const first = share()
    store = ana
    receive(first)
    expect(readDraft('jon', 1, 1)).toBe('Taytaku rimarqa')
    store = bea
    writeDraft('jon', 1, 1, '', 'Bea')
    const second = share()
    store = ana
    receive(second)
    expect([readDraft('jon', 1, 1), otherVersion('jon', 1, 1)]).toEqual(['', null])
    // And the first file, coming again, does not bring it back.
    receive(first)
    expect(readDraft('jon', 1, 1)).toBe('')
  })
})

describe('la revisión del pasaje y las revisiones viajan y siguen a su texto', () => {
  const bea = new Map<string, string>()
  const ana = new Map<string, string>()
  const share = (by: string) => readShared(JSON.stringify(shareProject(project, ['jon'], by)))!
  const receive = (file: ReturnType<typeof share>, by: string) => receiveShared(file, ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], by)
  const texts = () => [readDraft('jon', 1, 1), readDraft('jon', 1, 2)]
  /** Both phones with the same two verses, Bea's passed to Ana. */
  function bothWithText() {
    bea.clear()
    ana.clear()
    store = bea
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Bea')
    writeDraft('jon', 1, 2, 'Ninive llaktaman riy', 'Bea')
    const first = share('Bea')
    store = ana
    receive(first, 'Ana')
  }

  it('las preguntas respondidas «sí» y lo visto para mejorar llegan con el libro', () => {
    bothWithText()
    store = bea
    answer('jon', 1, [1, 2], texts(), 'fiel', 'Bea', new Date('2026-10-15T10:00:00Z'))
    addObservation('jon', 1, { verse: 2, criterion: 'claro', words: 'riy', comment: '¿Quién va?', by: 'Bea' }, new Date('2026-10-15T10:01:00Z'))
    const file = share('Bea')
    store = ana
    const [received] = receive(file, 'Ana').books
    expect(answersOf('jon', 1, [1, 2], texts()).fiel?.by).toBe('Bea')
    expect(observationsOf('jon', 1, 2).map((o) => [o.comment, o.state])).toEqual([['¿Quién va?', 'abierta']])
    expect(received.checksTaken).toBe(2)
    // The same file again brings nothing new.
    expect(receive(file, 'Ana').books[0].checksTaken).toBe(0)
  })

  it('lo marcado mejorado en un teléfono llega mejorado; lo visto en los dos se junta, nada se pierde', () => {
    bothWithText()
    store = bea
    const seen = addObservation('jon', 1, { verse: 2, criterion: 'claro', words: 'riy', comment: '¿Quién va?', by: 'Bea' }, new Date('2026-10-15T10:01:00Z'))
    const stillOpen = share('Bea')
    store = ana
    receive(stillOpen, 'Ana')
    addObservation('jon', 1, { verse: 2, criterion: 'natural', words: 'Ninive', comment: 'Nínive', by: 'Ana' }, new Date('2026-10-15T11:00:00Z'))
    store = bea
    resolveObservation('jon', 1, 2, seen.id, 'Bea')
    const file = share('Bea')
    store = ana
    receive(file, 'Ana')
    expect(observationsOf('jon', 1, 2).map((o) => [o.by, o.state])).toEqual([
      ['Bea', 'resuelta'],
      ['Ana', 'abierta'],
    ])
    // The older file, with it still open, does not open it again.
    receive(stillOpen, 'Ana')
    expect(observationsOf('jon', 1, 2)[0].state).toBe('resuelta')
  })

  it('un «sí» dado sobre otro texto no pisa el dado sobre el texto que queda', () => {
    bothWithText()
    // Bea answers on a text she changed afterwards; Ana answers later on the text both have.
    store = bea
    writeDraft('jon', 1, 2, 'Ninive llaktaman rinki', 'Bea')
    answer('jon', 1, [1, 2], texts(), 'fiel', 'Bea', new Date('2026-10-15T12:00:00Z'))
    writeDraft('jon', 1, 2, 'Ninive llaktaman riy', 'Bea')
    const file = share('Bea')
    store = ana
    answer('jon', 1, [1, 2], texts(), 'fiel', 'Ana', new Date('2026-10-15T11:00:00Z'))
    receive(file, 'Ana')
    expect(answersOf('jon', 1, [1, 2], texts()).fiel?.by).toBe('Ana')
  })

  it('de dos revisiones de una nota, queda la hecha sobre el texto que queda, aunque la otra sea más nueva', () => {
    bothWithText()
    store = bea
    writeCheck('jon', 'n1', { status: 'despues', words: [0], verseText: 'Taytaku rimarqa ña', by: 'Bea', at: '2026-10-15T12:00:00Z' })
    const file = share('Bea')
    store = ana
    writeCheck('jon', 'n1', { status: 'bien', words: [0], verseText: 'Taytaku rimarqa', by: 'Ana', at: '2026-10-15T11:00:00Z' })
    receive(file, 'Ana')
    expect(readCheck('jon', 'n1')?.by).toBe('Ana')
    // On the same text, given apart: not the latest, but both, Bea's waiting beside Ana's for a person to choose.
    store = bea
    writeCheck('jon', 'n1', { status: 'despues', words: [0], verseText: 'Taytaku rimarqa', by: 'Bea', at: '2026-10-15T13:00:00Z' })
    const later = share('Bea')
    store = ana
    receive(later, 'Ana')
    expect(readCheck('jon', 'n1')).toMatchObject({ by: 'Ana', others: [{ by: 'Bea', status: 'despues' }] })
  })
})

describe('dos versiones sin elegir viajan con el libro', () => {
  it('llegan a un tercer teléfono; elegidas allí, dejan de esperar en el primero', () => {
    const bea = new Map<string, string>()
    const ana = new Map<string, string>()
    const carla = new Map<string, string>()
    const share = (by: string) => readShared(JSON.stringify(shareProject(project, ['jon'], by)))!
    const receive = (file: ReturnType<typeof share>, by: string) => receiveShared(file, ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], by)
    store = bea
    writeDraft('jon', 1, 2, 'Ninive llaktaman riy', 'Bea')
    const fromBea = share('Bea')
    store = ana
    writeDraft('jon', 1, 2, 'Ninive llaktaman rimay', 'Ana')
    receive(fromBea, 'Ana')
    expect(otherVersion('jon', 1, 2)).toEqual({ text: 'Ninive llaktaman riy', by: 'Bea' })
    // Ana passes her book on without choosing: Carla sees both, from where she stands.
    const fromAna = share('Ana')
    store = carla
    const [received] = receive(fromAna, 'Carla').books
    expect(received.choices).toBe(1)
    // Said by who wrote each: neither was sent from Bea to Carla.
    expect([readDraft('jon', 1, 2), otherVersion('jon', 1, 2)]).toEqual(['Ninive llaktaman rimay', { text: 'Ninive llaktaman riy', by: 'Bea', carried: true }])
    chooseVersion('jon', 1, 2, true, 'Carla')
    const fromCarla = share('Carla')
    store = ana
    receive(fromCarla, 'Ana')
    expect([readDraft('jon', 1, 2), otherVersion('jon', 1, 2)]).toEqual(['Ninive llaktaman riy', null])
    // Bea, who never had Ana's version before, gets Carla's choice and is asked nothing.
    store = bea
    expect(receive(fromCarla, 'Bea').books[0].choices).toBe(0)
    expect([readDraft('jon', 1, 2), otherVersion('jon', 1, 2)]).toEqual(['Ninive llaktaman riy', null])
  })
})

describe('cómo trabaja el equipo viaja con el libro', () => {
  it('un libro que todos traducen llega así a un proyecto nuevo; uno sin nombre lo conserva al recibir', async () => {
    const together = { ...project, books: [{ code: 'jon', phase: 'traduccion' as const, together: true }] }
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Bea')
    const file = readShared(JSON.stringify(shareProject(together, ['jon'], 'Bea')))!
    expect(file.books[0].together).toBe(true)
    store.clear()
    const { projects } = receiveShared(file, ['jon'], { kind: 'new' }, [], 'Ana')
    expect(projects[0].books[0].together).toBe(true)
    // Received again into a project where the book has no name: how the team works on it here is not lost.
    const again = receiveShared(file, ['jon'], { kind: 'join', projectId: projects[0].id }, projects, 'Ana')
    expect(again.projects[0].books[0]).toEqual({ code: 'jon', phase: 'traduccion', together: true })
  })
})

describe('el avance de la traducción', () => {
  it('un versículo con versiones esperando a juntarse no cuenta como hecho hasta que se junta', async () => {
    const { miniApp } = await import('../miniapps/registry')
    const editor = miniApp('editor')!
    writeDraft('jon', 1, 2, 'Ninive llaktaman rimay', 'Ana')
    const fromBea = (() => {
      const mine = new Map(store)
      store.clear()
      writeDraft('jon', 1, 2, 'Ninive llaktaman riy', 'Bea')
      const file = readShared(JSON.stringify(shareProject(project, ['jon'], 'Bea')))!
      store = mine
      return file
    })()
    const at = { book: 'jon', chapter: 1, verse: 2 }
    expect(editor.done!(at)).toBe(true)
    receiveShared(fromBea, ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], 'Ana')
    expect(editor.done!(at)).toBe(false)
    chooseVersion('jon', 1, 2, true, 'Ana')
    expect(editor.done!(at)).toBe(true)
  })
})
