import { beforeEach, describe, expect, it } from 'vitest'
import { readShared, receiveShared, shareProject } from './share'
import { readCheck, stateOf, writeCheck, type NoteCheck } from './noteChecks'
import { addObservation, answer } from './passageReview'
import { readGlossary, saveGlossaryEntry, type GlossaryEntry } from './glossary'
import { addTake, chooseTake, chosenTake, takesOf, takesToChoose } from './recordings'
import { alignmentConflictAt, writeAlignment } from './alignment'
import { BOOK_NOTE_CHAPTER, bookStateOf, chooseVersion, forgetBooks, introNoteOn, otherVersion, readDraft, studyNotesAbout, studyNotesOf, writeDraft, writeIntroNote, writeStudyNote } from './work'
import type { Project } from './model'
import { setProject } from './scope'

/**
 * Every kind of clash two devices can have over the same work, and how it is settled (design, sections 6 and 7; the
 * inventory is in the session notes, «choques-inventario.md»). What the design asks for and the code does is an `it`.
 * What the code does not do yet is an `it.fails` saying what it should do: it passes while the gap is there and turns
 * red the day it is closed, to be made an `it` then.
 */
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

const devices = new Map<string, Map<string, string>>()
let store = new Map<string, string>()
beforeEach(() => {
  setProject('kichwa')
  devices.clear()
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

/** Picks up a device: its own storage (and so its own device id), nothing of the last one in memory. */
const on = (device: string) => {
  if (!devices.has(device)) devices.set(device, new Map())
  store = devices.get(device)!
  forgetBooks()
}
/** What `person` shares from `device` (the device is the person's own unless said). */
const share = (person: string, device = person) => {
  on(device)
  return readShared(JSON.stringify(shareProject(project, ['jon'], person)))!
}
const receive = (file: ReturnType<typeof share>, person: string, device = person) => {
  on(device)
  return receiveShared(file, ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], person)
}
const verse = (device: string, chapter: number, v: number) => {
  on(device)
  return readDraft('jon', chapter, v)
}

describe('6. Poesía con renglones distintos', () => {
  /** Ana writes Jonah 2:3 in two lines and passes it to Bea: both start from the same poem. */
  function bothWithPoem() {
    on('Ana')
    writeDraft('jon', 2, 3, 'Waqyarqani llakipi\nTaytaqa uyarqawan', 'Ana')
    receive(share('Ana'), 'Bea')
  }

  it('las mismas palabras en otros renglones no son un choque: no se pregunta', () => {
    bothWithPoem()
    on('Bea')
    writeDraft('jon', 2, 3, 'Waqyarqani\nllakipi Taytaqa uyarqawan', 'Bea')
    expect(receive(share('Bea'), 'Ana').books[0].choices).toBe(0)
    expect(otherVersion('jon', 2, 3)).toBeNull()
  })

  it.fails('los renglones que Bea cambió de lugar llegan a Ana (hoy se quedan en el teléfono de Bea)', () => {
    bothWithPoem()
    on('Bea')
    writeDraft('jon', 2, 3, 'Waqyarqani\nllakipi Taytaqa uyarqawan', 'Bea')
    receive(share('Bea'), 'Ana')
    expect(verse('Ana', 2, 3)).toBe('Waqyarqani\nllakipi Taytaqa uyarqawan')
  })

  it('palabras distintas sí se preguntan; elegir la de Bea trae también sus renglones', () => {
    bothWithPoem()
    on('Ana')
    writeDraft('jon', 2, 3, 'Waqyarqani llakipi\nDiosqa uyarqawan', 'Ana')
    on('Bea')
    writeDraft('jon', 2, 3, 'Waqyarqani\nllakipi kaspa\nTaytaqa uyarqawan', 'Bea')
    expect(receive(share('Bea'), 'Ana').books[0].choices).toBe(1)
    expect(otherVersion('jon', 2, 3)).toEqual({ text: 'Waqyarqani\nllakipi kaspa\nTaytaqa uyarqawan', by: 'Bea' })
    chooseVersion('jon', 2, 3, true, 'Ana')
    expect(readDraft('jon', 2, 3)).toBe('Waqyarqani\nllakipi kaspa\nTaytaqa uyarqawan')
    expect(bookStateOf('jon')!.usfm).toContain('\\q \\v 3 Waqyarqani\n\\q2 llakipi kaspa\n\\q2 Taytaqa uyarqawan')
  })
})

describe('7. Dos respuestas a la misma revisión de palabra', () => {
  const check = (over: Partial<NoteCheck>): NoteCheck => ({ status: 'bien', words: [0], verseText: 'Taytaku rimarqa', by: 'Ana', at: '2026-10-15T10:00:00Z', ...over })
  function bothWithVerse() {
    on('Bea')
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Bea')
    receive(share('Bea'), 'Ana')
  }

  it('sobre el mismo texto, dadas por separado: queda la de aquí y la otra espera al lado para elegir; la fecha no decide', () => {
    bothWithVerse()
    on('Ana')
    writeCheck('jon', 'w1', check({ by: 'Ana', at: '2026-10-15T10:00:00Z' }), 'revisionPalabra')
    on('Bea')
    writeCheck('jon', 'w1', check({ status: 'despues', reason: 'equipo', comment: '¿Tayta o Dios?', by: 'Bea', at: '2026-10-15T11:00:00Z' }), 'revisionPalabra')
    receive(share('Bea'), 'Ana')
    expect(readCheck('jon', 'w1', 'revisionPalabra')).toMatchObject({ by: 'Ana', others: [{ by: 'Bea', comment: '¿Tayta o Dios?' }] })
    // It is not resolved while it waits: the reviewer shows it «answered two ways».
    expect(stateOf(readCheck('jon', 'w1', 'revisionPalabra'), 'Taytaku rimarqa')).toBe('elegir')
    // On Bea's side, the same: hers stays, Ana's waits beside it.
    receive(share('Ana'), 'Bea')
    expect(readCheck('jon', 'w1', 'revisionPalabra')).toMatchObject({ by: 'Bea', others: [{ by: 'Ana' }] })
    // Ana answers again knowing both: that is the choice, and it settles it on Bea's device too.
    on('Ana')
    writeCheck('jon', 'w1', check({ status: 'despues', reason: 'equipo', comment: 'Lo vemos juntos', by: 'Ana', at: '2026-10-14T09:00:00Z' }), 'revisionPalabra')
    receive(share('Ana'), 'Bea')
    const settled = readCheck('jon', 'w1', 'revisionPalabra')
    expect([settled?.comment, settled?.others]).toEqual(['Lo vemos juntos', undefined])
  })

  it('la que se dio sabiendo de la otra entra, aunque el reloj de su aparato diga una hora anterior', () => {
    bothWithVerse()
    on('Bea')
    writeCheck('jon', 'w1', check({ by: 'Bea', at: '2026-10-15T10:00:00Z' }), 'revisionPalabra')
    receive(share('Bea'), 'Ana')
    on('Bea')
    writeCheck('jon', 'w1', check({ status: 'despues', comment: 'Mejor revisarlo', by: 'Bea', at: '2026-10-01T00:00:00Z' }), 'revisionPalabra')
    receive(share('Bea'), 'Ana')
    expect(readCheck('jon', 'w1', 'revisionPalabra')).toMatchObject({ comment: 'Mejor revisarlo' })
    expect(readCheck('jon', 'w1', 'revisionPalabra')?.others).toBeUndefined()
  })

  it('la dada sobre el texto que queda gana, aunque la otra sea más nueva', () => {
    bothWithVerse()
    on('Bea')
    writeCheck('jon', 'w1', check({ verseText: 'Taytaku nirqa', by: 'Bea', at: '2026-10-15T12:00:00Z' }), 'revisionPalabra')
    on('Ana')
    writeCheck('jon', 'w1', check({ by: 'Ana', at: '2026-10-15T09:00:00Z' }), 'revisionPalabra')
    receive(share('Bea'), 'Ana')
    expect(readCheck('jon', 'w1', 'revisionPalabra')?.by).toBe('Ana')
  })

  it('un «bien» dado por separado no borra un «corregir después» con su comentario: los dos quedan para elegir', () => {
    bothWithVerse()
    on('Ana')
    writeCheck('jon', 'w1', check({ status: 'despues', reason: 'equipo', comment: 'Hablarlo con el equipo', by: 'Ana', at: '2026-10-15T10:00:00Z' }), 'revisionPalabra')
    on('Bea')
    writeCheck('jon', 'w1', check({ by: 'Bea', at: '2026-10-15T11:00:00Z' }), 'revisionPalabra')
    receive(share('Bea'), 'Ana')
    expect(readCheck('jon', 'w1', 'revisionPalabra')).toMatchObject({ status: 'despues', comment: 'Hablarlo con el equipo', others: [{ status: 'bien', by: 'Bea' }] })
  })
})

describe('9. Dos formas en el glosario', () => {
  const entry = (over: Partial<GlossaryEntry>): GlossaryEntry => ({
    id: 'a1b2',
    lemma: 'קָרָא',
    strong: 'H7121',
    english: ['call'],
    sense: 'llamar en voz alta',
    rendering: 'waqyay',
    alternatives: [],
    avoid: [],
    scope: 'all',
    variants: [],
    twLink: '',
    examples: [],
    status: 'agreed',
    note: '',
    by: 'Ana',
    ...over,
  })
  const anaFirst = () => {
    on('Ana')
    saveGlossaryEntry('kichwa', entry({}))
    receive(share('Ana'), 'Bea')
  }

  it('otra traducción de la misma palabra queda como otra forma, y la entrada vuelve a «propuesta»', () => {
    anaFirst()
    on('Bea')
    saveGlossaryEntry('kichwa', entry({ rendering: 'kaparay', by: 'Bea' }))
    const { glossary } = receive(share('Bea'), 'Ana')
    expect(glossary.joined).toBe(1)
    expect(readGlossary('kichwa')[0]).toMatchObject({ rendering: 'waqyay', alternatives: ['kaparay'], status: 'proposed' })
  })

  it.fails('lo que Bea cambió en el sentido o la nota de la entrada llega a Ana (hoy se queda en el teléfono de Bea)', () => {
    anaFirst()
    on('Bea')
    saveGlossaryEntry('kichwa', entry({ sense: 'llamar a alguien para que venga', note: 'No es gritar', by: 'Bea' }))
    receive(share('Bea'), 'Ana')
    expect(readGlossary('kichwa')[0]).toMatchObject({ sense: 'llamar a alguien para que venga', note: 'No es gritar' })
  })

  it.fails('una forma que Bea pasó a «evitar» no sigue como alternativa en Ana', () => {
    on('Ana')
    saveGlossaryEntry('kichwa', entry({ alternatives: ['qapariy'] }))
    receive(share('Ana'), 'Bea')
    on('Bea')
    saveGlossaryEntry('kichwa', entry({ alternatives: [], avoid: ['qapariy'], by: 'Bea' }))
    receive(share('Bea'), 'Ana')
    expect(readGlossary('kichwa')[0].alternatives).not.toContain('qapariy')
  })
})

describe('10. Alineaciones distintas del mismo texto', () => {
  const links = (word: string) => [{ sources: [{ content: word, occurrence: 1, occurrences: 1, strong: '', lemma: '' }], targets: [{ word, occurrence: 1, occurrences: 1 }] }]

  it('dos personas: es un choque, y se elige en el alineador', () => {
    on('Bea')
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Bea')
    receive(share('Bea'), 'Ana')
    on('Ana')
    writeAlignment('jon', 1, 1, 'UHB', { groups: links('rimarqa') as never, text: 'Taytaku rimarqa', by: 'Ana' })
    on('Bea')
    writeAlignment('jon', 1, 1, 'UHB', { groups: links('Taytaku') as never, text: 'Taytaku rimarqa', by: 'Bea' })
    expect(receive(share('Bea'), 'Ana').books[0].alignmentChoices).toBe(1)
    expect(alignmentConflictAt('jon', 1, 1, 'UHB')).toMatchObject({ mine: { by: 'Ana' }, theirs: { by: 'Bea' } })
  })

  // Decided with Abel on 19 October 2026: a name on another device may be another person, and the date never decides.
  it('dos «Ana» en dos aparatos pueden ser dos personas: se elige, no gana la más reciente', () => {
    on('Ana-teléfono')
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Ana')
    receive(share('Ana', 'Ana-teléfono'), 'Ana', 'Ana-aldea')
    on('Ana-teléfono')
    writeAlignment('jon', 1, 1, 'UHB', { groups: links('rimarqa') as never, text: 'Taytaku rimarqa', by: 'Ana', at: '2026-10-15T10:00:00Z' })
    on('Ana-aldea')
    writeAlignment('jon', 1, 1, 'UHB', { groups: links('Taytaku') as never, text: 'Taytaku rimarqa', by: 'Ana', at: '2026-10-15T11:00:00Z' })
    expect(receive(share('Ana', 'Ana-aldea'), 'Ana', 'Ana-teléfono').books[0].alignmentChoices).toBe(1)
    expect(alignmentConflictAt('jon', 1, 1, 'UHB')).not.toBeNull()
  })
})

describe('11. Notas de estudio sobre los mismos versículos', () => {
  it('dos notas escritas por separado quedan las dos, cada una con su autor', () => {
    on('Ana')
    writeStudyNote('jon', 1, [1], 'Dios habla primero', 'Ana')
    on('Bea')
    writeStudyNote('jon', 1, [1], 'Jonás no quiere ir', 'Bea')
    receive(share('Bea'), 'Ana')
    expect(studyNotesOf('jon', 1)[0].text).toBe('Dios habla primero\n\n— Bea: Jonás no quiere ir')
  })

  it('las notas de las introducciones viajan con el trabajo y no se mezclan con las de un versículo', () => {
    on('Ana')
    writeIntroNote('jon', BOOK_NOTE_CHAPTER, 'El título: «Jonás»', 'Ana')
    writeIntroNote('jon', 1, 'Jonás huye de Dios', 'Ana')
    writeStudyNote('jon', 1, [1], 'Dios habla primero', 'Ana')
    receive(share('Ana'), 'Bea')
    on('Bea')
    expect(introNoteOn('jon', BOOK_NOTE_CHAPTER)?.text).toBe('El título: «Jonás»')
    expect(introNoteOn('jon', 1)?.text).toBe('Jonás huye de Dios')
    expect(studyNotesAbout('jon', 1, [1, 2, 3]).map((n) => n.text)).toEqual(['Dios habla primero'])
  })

  it.fails('una nota corregida reemplaza la que corrigió (hoy la vieja queda pegada encima)', () => {
    on('Ana')
    writeStudyNote('jon', 1, [1], 'Dios habla primero', 'Ana')
    receive(share('Ana'), 'Bea')
    on('Bea')
    writeStudyNote('jon', 1, [1], 'Dios le habla primero a Jonás', 'Bea')
    receive(share('Bea'), 'Ana')
    expect(studyNotesOf('jon', 1)[0].text).toBe('Dios le habla primero a Jonás')
  })

  it.fails('de ida y vuelta no se repiten (hoy la de Bea vuelve a ella dos veces)', () => {
    on('Ana')
    writeStudyNote('jon', 1, [1], 'Dios habla primero', 'Ana')
    on('Bea')
    writeStudyNote('jon', 1, [1], 'Jonás no quiere ir', 'Bea')
    receive(share('Bea'), 'Ana')
    receive(share('Ana'), 'Bea')
    expect(studyNotesOf('jon', 1)[0].text.split('Jonás no quiere ir')).toHaveLength(2)
  })
})

describe('12. Grabaciones: la toma que cuenta', () => {
  /** What `person` shares, with the sound of every take (withSounds reads it from IndexedDB; here, as if it had). */
  const withSound = (person: string) => {
    const file = share(person)
    file.books[0].recordings = file.books[0].recordings!.map((r) => ({ ...r, takes: r.takes.map((x) => ({ ...x, sound: btoa('ok') })) }))
    return file
  }

  it('elegidas por separado: ninguna toma se pierde, la de aquí sigue sonando y la otra espera a que alguien elija', () => {
    on('Ana')
    addTake('jon', 1, 1, { by: 'Ana', at: '2026-10-15T10:00:00Z', ms: 900, mime: 'audio/webm' }, 'ana1')
    on('Bea')
    addTake('jon', 1, 1, { by: 'Bea', at: '2026-10-15T11:00:00Z', ms: 900, mime: 'audio/webm' }, 'bea1')
    receive(withSound('Bea'), 'Ana')
    expect(takesOf('jon', 1, 1).map((x) => x.id)).toEqual(['ana1', 'bea1'])
    expect(chosenTake('jon', 1, 1)?.id).toBe('ana1')
    expect(takesToChoose('jon', 1, 1).map((x) => x.id)).toEqual(['ana1', 'bea1'])
    // Ana chooses Bea's: it counts, and the choice settles it on Bea's device too.
    chooseTake('jon', 1, 1, 'bea1')
    expect([chosenTake('jon', 1, 1)?.id, takesToChoose('jon', 1, 1)]).toEqual(['bea1', []])
    receive(withSound('Ana'), 'Bea')
    expect([chosenTake('jon', 1, 1)?.id, takesToChoose('jon', 1, 1)]).toEqual(['bea1', []])
  })

  it('una toma grabada o elegida sabiendo de la otra cuenta sin preguntar, aunque el reloj diga otra hora', () => {
    on('Ana')
    addTake('jon', 1, 1, { by: 'Ana', at: '2026-10-15T10:00:00Z', ms: 900, mime: 'audio/webm' }, 'ana1')
    receive(withSound('Ana'), 'Bea')
    on('Bea')
    addTake('jon', 1, 1, { by: 'Bea', at: '2026-10-01T00:00:00Z', ms: 900, mime: 'audio/webm' }, 'bea1')
    receive(withSound('Bea'), 'Ana')
    expect([chosenTake('jon', 1, 1)?.id, takesToChoose('jon', 1, 1)]).toEqual(['bea1', []])
  })
})

describe('13. El mismo trabajo recibido dos veces', () => {
  it('la segunda vez no cambia nada, en ninguna capa', () => {
    on('Ana')
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Ana')
    writeDraft('jon', 1, 2, 'Ninive llaktaman rimay', 'Ana')
    writeStudyNote('jon', 1, [1], 'Dios habla primero', 'Ana')
    on('Bea')
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Bea')
    writeDraft('jon', 1, 2, 'Ninive llaktaman riy', 'Bea')
    writeDraft('jon', 1, 3, 'Jonasqa miticurqa', 'Bea')
    writeCheck('jon', 'n1', { status: 'bien', words: [0], verseText: 'Taytaku rimarqa', by: 'Bea', at: '2026-10-15T10:00:00Z' })
    answer('jon', 1, [1, 2, 3], ['Taytaku rimarqa', 'Ninive llaktaman riy', 'Jonasqa miticurqa'], 'fiel', 'Bea', new Date('2026-10-15T10:00:00Z'))
    addObservation('jon', 1, { verse: 2, criterion: 'claro', words: 'riy', comment: '¿Quién va?', by: 'Bea' }, new Date('2026-10-15T10:01:00Z'))
    writeStudyNote('jon', 1, [1], 'Jonás no quiere ir', 'Bea')
    saveGlossaryEntry('kichwa', { id: 'a1b2', lemma: 'קָרָא', strong: 'H7121', english: [], sense: '', rendering: 'waqyay', alternatives: [], avoid: [], scope: 'all', variants: [], twLink: '', examples: [], status: 'agreed', note: '', by: 'Bea' })
    const file = share('Bea')
    const first = receive(file, 'Ana')
    expect(first.books[0].choices).toBe(1)
    const after = new Map(store)
    const again = receive(file, 'Ana')
    expect([again.books[0].taken, again.books[0].choices, again.books[0].checksTaken, again.glossary.added, again.glossary.joined]).toEqual([0, 0, 0, 0, 0])
    expect(new Map(store)).toEqual(after)
  })
})

describe('14. Un archivo más viejo que lo que ya hay', () => {
  it('el texto no vuelve atrás, ni la revisión más vieja pisa la nueva', () => {
    on('Bea')
    writeDraft('jon', 1, 1, 'Taytaku rimarqa', 'Bea')
    writeCheck('jon', 'n1', { status: 'despues', words: [0], verseText: 'Taytaku rimarqa', by: 'Bea', at: '2026-10-15T10:00:00Z' })
    const old = share('Bea')
    on('Bea')
    writeDraft('jon', 1, 1, 'Taytaku nirqa', 'Bea')
    writeCheck('jon', 'n1', { status: 'bien', words: [0], verseText: 'Taytaku nirqa', by: 'Bea', at: '2026-10-15T11:00:00Z' })
    const newer = share('Bea')
    receive(newer, 'Ana')
    const back = receive(old, 'Ana').books[0]
    expect([back.taken, back.choices]).toEqual([0, 0])
    expect([readDraft('jon', 1, 1), otherVersion('jon', 1, 1), readCheck('jon', 'n1')?.status]).toEqual(['Taytaku nirqa', null, 'bien'])
  })

  it.fails('una nota de estudio más vieja no vuelve sobre la nueva (hoy se pega debajo)', () => {
    on('Bea')
    writeStudyNote('jon', 1, [1], 'Primera idea', 'Bea')
    const old = share('Bea')
    on('Bea')
    writeStudyNote('jon', 1, [1], 'Idea mejor', 'Bea')
    receive(share('Bea'), 'Ana')
    receive(old, 'Ana')
    expect(studyNotesOf('jon', 1)[0].text).toBe('Idea mejor')
  })

  it.fails('un glosario más viejo no devuelve la forma que su autor ya cambió (hoy vuelve como alternativa y la entrada a «propuesta»)', () => {
    const base: GlossaryEntry = { id: 'a1b2', lemma: 'קָרָא', strong: 'H7121', english: [], sense: '', rendering: 'qapariy', alternatives: [], avoid: [], scope: 'all', variants: [], twLink: '', examples: [], status: 'agreed', note: '', by: 'Bea' }
    on('Bea')
    saveGlossaryEntry('kichwa', base)
    const old = share('Bea')
    on('Bea')
    saveGlossaryEntry('kichwa', { ...base, rendering: 'waqyay', avoid: ['qapariy'] })
    receive(share('Bea'), 'Ana')
    receive(old, 'Ana')
    expect(readGlossary('kichwa')[0]).toMatchObject({ rendering: 'waqyay', alternatives: [], status: 'agreed' })
  })
})

describe('15. Dos archivos de versículos sueltos (USFM o versión 1) de la misma persona', () => {
  it('cada archivo es otra copia sin historia: lo que Bea cambió del primero al segundo se pregunta (no entra solo)', () => {
    const file = (at: string, text: string) => ({
      ...share('Bea', 'vacío'),
      version: 1 as const,
      at,
      books: [{ code: 'jon', phase: 'traduccion' as const, verses: [{ chapter: 1, verse: 1, text, by: 'Bea' }], checks: {}, studyNotes: [] }],
    })
    receive(file('2026-10-14T10:00:00Z', 'Taytaku rimarqa'), 'Ana')
    expect(readDraft('jon', 1, 1)).toBe('Taytaku rimarqa')
    expect(receive(file('2026-10-16T10:00:00Z', 'Taytaku nirqa'), 'Ana').books[0].choices).toBe(1)
    expect(otherVersion('jon', 1, 1)?.text).toBe('Taytaku nirqa')
  })
})
