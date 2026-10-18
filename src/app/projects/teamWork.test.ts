import { beforeEach, describe, expect, it } from 'vitest'
import { readShared, receiveShared, shareProject } from './share'
import { bookStateOf, canUndoGather, flushBooks, forgetBooks, gather, gatherAll, otherVersion, otherVersionsOf, readDraft, undoGather, versionsAt, writeDraft } from './work'
import { readingsOf, sectionsToGather, waitingIn } from './versions'
import type { Project } from './model'
import { setProject } from './scope'

/**
 * How a team works, phone by phone: each writes on their own and the books are gathered by sharing files. The merge
 * goes verse by verse, not line by line as git does: verses on the same line of the USFM, or on lines one after the
 * other, are as apart as any two verses.
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

const phones = new Map<string, Map<string, string>>()
let store = new Map<string, string>()
beforeEach(() => {
  setProject('kichwa')
  phones.clear()
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
/** Picks up a person's phone: its own storage, nothing of the last one in memory. */
const on = (name: string) => {
  if (!phones.has(name)) phones.set(name, new Map())
  store = phones.get(name)!
  forgetBooks()
}
const share = (by: string) => {
  on(by)
  return readShared(JSON.stringify(shareProject(project, ['jon'], by)))!
}
const receive = (file: ReturnType<typeof share>, by: string) => {
  on(by)
  return receiveShared(file, ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], by).books[0]
}
/** Every phone starts from the same copy of the book, laid out as `usfm` says (as when it was shared at the start). */
function allFrom(usfm: string, ...names: string[]) {
  for (const name of names) {
    on(name)
    store.set('servos.libro.jon~kichwa', JSON.stringify({ state: { book: 'jon', usfm, journal: [], pending: [] }, working: usfm, pendingBy: null, pendingAt: [] }))
  }
}
const versesOn = (name: string, chapter: number, verses: number[]) => {
  on(name)
  return verses.map((v) => readDraft('jon', chapter, v))
}

describe('dos personas en versículos distintos de la misma línea del USFM', () => {
  it('se juntan sin preguntar, en los dos teléfonos, y el versículo de al lado queda como estaba', () => {
    allFrom('\\id JON\n\\c 1\n\\p \\v 1 Uno. \\v 2 Dos. \\v 3 Tres.\n\\v 4 Cuatro.\n', 'Ana', 'Bea')
    on('Ana')
    writeDraft('jon', 1, 1, 'Uno de Ana.', 'Ana')
    on('Bea')
    writeDraft('jon', 1, 2, 'Dos de Bea.', 'Bea')
    expect(receive(share('Bea'), 'Ana').choices).toBe(0)
    expect(receive(share('Ana'), 'Bea').choices).toBe(0)
    const both = ['Uno de Ana.', 'Dos de Bea.', 'Tres.', 'Cuatro.']
    expect(versesOn('Ana', 1, [1, 2, 3, 4])).toEqual(both)
    expect(versesOn('Bea', 1, [1, 2, 3, 4])).toEqual(both)
  })

  it('el mismo versículo, cambiado por los dos, sí se pregunta (solo ese)', () => {
    allFrom('\\id JON\n\\c 1\n\\p \\v 1 Uno. \\v 2 Dos. \\v 3 Tres.\n', 'Ana', 'Bea')
    on('Ana')
    writeDraft('jon', 1, 2, 'Dos de Ana.', 'Ana')
    on('Bea')
    writeDraft('jon', 1, 2, 'Dos de Bea.', 'Bea')
    writeDraft('jon', 1, 3, 'Tres de Bea.', 'Bea')
    expect(receive(share('Bea'), 'Ana').choices).toBe(1)
    expect(versesOn('Ana', 1, [1, 2, 3])).toEqual(['Uno.', 'Dos de Ana.', 'Tres de Bea.'])
    expect(otherVersion('jon', 1, 2)?.text).toBe('Dos de Bea.')
  })
})

describe('dos personas en líneas seguidas, versículos distintos', () => {
  it('en prosa: cada uno en su línea, se juntan sin preguntar', () => {
    allFrom('\\id JON\n\\c 1\n\\p\n\\v 1 Uno.\n\\v 2 Dos.\n\\v 3 Tres.\n', 'Ana', 'Bea')
    on('Ana')
    writeDraft('jon', 1, 1, 'Uno de Ana.', 'Ana')
    writeDraft('jon', 1, 3, 'Tres de Ana.', 'Ana')
    on('Bea')
    writeDraft('jon', 1, 2, 'Dos de Bea.', 'Bea')
    expect(receive(share('Bea'), 'Ana').choices).toBe(0)
    expect(receive(share('Ana'), 'Bea').choices).toBe(0)
    expect(versesOn('Bea', 1, [1, 2, 3])).toEqual(['Uno de Ana.', 'Dos de Bea.', 'Tres de Ana.'])
  })

  it('en un poema: versículos seguidos y la segunda línea de uno de ellos, sin preguntar y con sus renglones', () => {
    on('Ana')
    writeDraft('jon', 2, 3, 'Primera línea de Ana\nSegunda línea de Ana', 'Ana')
    receive(share('Ana'), 'Bea')
    on('Ana')
    writeDraft('jon', 2, 4, 'Ana en el cuatro', 'Ana')
    on('Bea')
    writeDraft('jon', 2, 3, 'Primera línea de Ana\nSegunda línea, de Bea', 'Bea')
    writeDraft('jon', 2, 5, 'Bea en el cinco', 'Bea')
    expect(receive(share('Bea'), 'Ana').choices).toBe(0)
    expect(versesOn('Ana', 2, [3, 4, 5])).toEqual(['Primera línea de Ana\nSegunda línea, de Bea', 'Ana en el cuatro', 'Bea en el cinco'])
    on('Ana')
    expect(bookStateOf('jon')!.usfm).toContain('\\q \\v 3 Primera línea de Ana\n\\q2 Segunda línea, de Bea\n\\q \\v 4 Ana en el cuatro\n\\q \\v 5 Bea en el cinco')
  })
})

describe('cuatro traducen el mismo capítulo y una junta las cuatro', () => {
  it('nada se pierde: cada versión distinta de cada versículo queda esperando una elección', () => {
    const team = {
      Ana: ['Taytaku Jonasman rimarqa', 'Hatun Ninive llaktaman riy', 'Jonasqa miticurqa'],
      Bea: ['Taytaku rimarqa Jonasman', 'Ninive llaktaman riy', 'Jonasqa miticurqa'],
      Carla: ['Diosmi Jonasman rimarqa', 'Ninive llaktaman rinki', 'Jonasqa Tarsisman miticurqa'],
      Dani: ['Taytaku Jonasman rimarqa', 'Ninive hatun llaktaman riy', 'Jonasqa karuman miticurqa'],
    }
    for (const [name, texts] of Object.entries(team)) {
      on(name)
      texts.forEach((t, i) => writeDraft('jon', 1, i + 1, t, name))
    }
    for (const file of ['Bea', 'Carla', 'Dani'].map(share)) receive(file, 'Ana')
    on('Ana')
    expect(versesOn('Ana', 1, [1, 2, 3])).toEqual(team.Ana)
    // What waits, verse by verse: each other version once (the same text as Ana's waits for nothing).
    const waiting = (verse: number) =>
      bookStateOf('jon')!
        .pending.filter((c) => c.place.from === verse)
        .map((c) => c.theirs.text)
        .sort()
    expect(waiting(1)).toEqual([team.Bea[0], team.Carla[0]].sort())
    expect(waiting(2)).toEqual([team.Bea[1], team.Carla[1], team.Dani[1]].sort())
    expect(waiting(3)).toEqual([team.Carla[2], team.Dani[2]].sort())
  })
})

describe('juntar las versiones de varios: una vez por versículo', () => {
  const team = {
    Ana: ['Taytaku Jonasman rimarqa', 'Hatun Ninive llaktaman riy', 'Jonasqa miticurqa'],
    Bea: ['Taytaku rimarqa Jonasman', 'Ninive llaktaman riy', 'Jonasqa miticurqa'],
    Carla: ['Diosmi Jonasman rimarqa', 'Ninive llaktaman rinki', 'Jonasqa Tarsisman miticurqa'],
    Dani: ['Taytaku Jonasman rimarqa', 'Ninive hatun llaktaman riy', 'Jonasqa karuman miticurqa'],
  }
  /** Each wrote chapter 1 on their phone; `who` receives the other three files. */
  function allWrote(...who: string[]) {
    for (const [name, texts] of Object.entries(team)) {
      on(name)
      texts.forEach((t, i) => writeDraft('jon', 1, i + 1, t, name))
    }
    const files = Object.keys(team).map(share)
    for (const name of who) for (const file of files) if (file.from !== name) receive(file, name)
  }

  it('se ven todas las versiones de un versículo a la vez, la de aquí primero, cada una una vez', () => {
    allWrote('Ana')
    on('Ana')
    expect(versionsAt('jon', 1, 2).map((v) => [v.by, v.text, v.here])).toEqual([
      [['Ana'], team.Ana[1], true],
      [['Bea'], team.Bea[1], false],
      [['Carla'], team.Carla[1], false],
      [['Dani'], team.Dani[1], false],
    ])
    // Dani wrote verse 1 as Ana did: three versions, not four, and that one is both of theirs.
    expect(versionsAt('jon', 1, 1).map((v) => v.by)).toEqual([['Ana', 'Dani'], ['Bea'], ['Carla']])
    // The list of what waits names each version once, not the first one again and again.
    expect(otherVersionsOf('jon').filter((v) => v.verse === 2).map((v) => v.by).sort()).toEqual(['Bea', 'Carla', 'Dani'])
  })

  it('Ana junta cada versículo una vez (una versión o una mezcla) y, al compartir, a nadie se le pregunta nada', () => {
    allWrote('Ana')
    on('Ana')
    gather('jon', 1, 1, { key: versionsAt('jon', 1, 1).find((v) => v.by.includes('Carla'))!.key }, 'Ana')
    gather('jon', 1, 2, { text: 'Hatun Ninive llaktaman rinki' }, 'Ana')
    gather('jon', 1, 3, { key: versionsAt('jon', 1, 3).find((v) => v.here)!.key }, 'Ana')
    const gathered = ['Diosmi Jonasman rimarqa', 'Hatun Ninive llaktaman rinki', 'Jonasqa miticurqa']
    expect([versesOn('Ana', 1, [1, 2, 3]), otherVersionsOf('jon')]).toEqual([gathered, []])
    const file = share('Ana')
    for (const name of ['Bea', 'Carla', 'Dani']) {
      expect(receive(file, name).choices).toBe(0)
      expect(versesOn(name, 1, [1, 2, 3])).toEqual(gathered)
    }
  })

  it('si Bea y Carla juntan por separado y dejan otra cosa en un versículo, ese se vuelve a elegir; lo demás no', () => {
    allWrote('Bea', 'Carla')
    for (const name of ['Bea', 'Carla']) {
      on(name)
      gather('jon', 1, 1, { key: versionsAt('jon', 1, 1).find((v) => v.by.includes('Carla'))!.key }, name)
      gather('jon', 1, 3, { key: versionsAt('jon', 1, 3).find((v) => v.by.includes('Dani'))!.key }, name)
    }
    on('Bea')
    gather('jon', 1, 2, { text: 'Ninive hatun llaktaman rinki' }, 'Bea')
    on('Carla')
    gather('jon', 1, 2, { key: versionsAt('jon', 1, 2).find((v) => v.by.includes('Carla'))!.key }, 'Carla')
    expect(receive(share('Carla'), 'Bea').choices).toBe(1)
    // Bea's mix, which nobody wrote before, is hers: she wrote it while gathering.
    expect(versionsAt('jon', 1, 2).map((v) => [v.by, v.text])).toEqual([
      [['Bea'], 'Ninive hatun llaktaman rinki'],
      [['Carla'], 'Ninive llaktaman rinki'],
    ])
    expect(versesOn('Bea', 1, [1, 3])).toEqual([team.Carla[0], team.Dani[2]])
  })
})

describe('juntar por sección', () => {
  const team = {
    Ana: ['Taytaku Jonasman rimarqa', 'Hatun Ninive llaktaman riy', 'Jonasqa miticurqa'],
    Bea: ['Taytaku rimarqa Jonasman', 'Ninive llaktaman riy', 'Jonasqa miticurqa'],
    Carla: ['Diosmi Jonasman rimarqa', 'Ninive llaktaman rinki', 'Jonasqa Tarsisman miticurqa'],
    Dani: ['Taytaku Jonasman rimarqa', 'Ninive hatun llaktaman riy', 'Jonasqa karuman miticurqa'],
  }
  const jonah1 = [{ chapter: 1, verses: Array.from({ length: 17 }, (_, i) => i + 1), sections: [[1, 2, 3], [4, 5], [6, 7]] }]
  function anaGathersAll() {
    for (const [name, texts] of Object.entries(team)) {
      on(name)
      texts.forEach((t, i) => writeDraft('jon', 1, i + 1, t, name))
    }
    for (const file of ['Bea', 'Carla', 'Dani'].map(share)) receive(file, 'Ana')
    on('Ana')
  }

  it('lo que falta juntar va por sección: solo la que tiene versiones esperando', () => {
    anaGathersAll()
    expect(sectionsToGather('jon', jonah1)).toEqual([{ kind: 'seccion', chapter: 1, verses: [1, 2, 3] }])
  })

  it('cada uno se lee de corrido en la sección; la de aquí primero, con quien la escribió así', () => {
    anaGathersAll()
    const readings = readingsOf('jon', 1, [1, 2, 3])
    expect(readings.map((r) => [r.names, r.here])).toEqual([
      [['Ana'], true],
      [['Bea'], false],
      [['Carla'], false],
      [['Dani'], false],
    ])
    // Bea wrote verse 3 as Ana did: her reading has the text here there.
    expect(readings[1].verses.map((v) => v.text)).toEqual(team.Bea)
    expect(readings[3].verses.map((v) => v.text)).toEqual(team.Dani)
  })

  it('quedarse con la de alguien para toda la sección cierra todo lo que esperaba en ella, y se puede deshacer al momento', () => {
    anaGathersAll()
    const carla = readingsOf('jon', 1, [1, 2, 3]).find((r) => r.names.includes('Carla'))!
    gatherAll('jon', carla.verses.map((v) => ({ chapter: 1, verse: v.verse, choice: { key: v.key } })), 'Ana')
    expect([versesOn('Ana', 1, [1, 2, 3]), waitingIn('jon', 1, [1, 2, 3])]).toEqual([team.Carla, []])
    on('Ana')
    expect(canUndoGather('jon')).toBe(true)
    expect(undoGather('jon')).toBe(true)
    expect([versesOn('Ana', 1, [1, 2, 3]), waitingIn('jon', 1, [1, 2, 3])]).toEqual([team.Ana, [1, 2, 3]])
  })

  it('después de escribir otra cosa en el libro, ya no se deshace (no se pierde lo escrito)', () => {
    anaGathersAll()
    gather('jon', 1, 2, { key: versionsAt('jon', 1, 2).find((v) => v.by.includes('Bea'))!.key }, 'Ana')
    writeDraft('jon', 1, 4, 'Chaymanta', 'Ana')
    flushBooks()
    expect([canUndoGather('jon'), undoGather('jon'), readDraft('jon', 1, 4)]).toEqual([false, false, 'Chaymanta'])
  })
})
