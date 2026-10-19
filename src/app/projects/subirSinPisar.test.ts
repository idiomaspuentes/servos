import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDestination } from './door43'
import { fakeDoor43, TOKEN } from './fakeDoor43'
import type { Project } from './model'
import { ask, runErrand, sendWaiting, waiting } from './outbox'
import { changedOnDoor43, fromDoor43, uploadProject } from './publishing'
import { readShared, receiveShared, shareProject } from './share'
import { setProject } from './scope'
import { forgetBooks, otherVersion, readDraft, writeDraft } from './work'

/**
 * Two people upload the same book from two phones (design 6.10: «Git does not gather the USFM: Servos does»). What one
 * uploaded is not replaced unseen by the other's upload, made without their work: each phone remembers the version of
 * the file it last saw on Door43, and finding another one there it stops, brings it in and gathers it (against that
 * version, so only what changed on both sides is asked), and uploads after.
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
  miniApps: { estudio: [], traduccion: ['editor'], revision: [], comunitaria: [], publicacion: ['publicar'] },
}
const host = 'https://qa.door43.org'
const to = { host, owner: 'BSOJ', repo: 'qu_reg' }
const JON = 'BSOJ/qu_reg/32-JON.usfm'
const message = (books: string) => `Servos sube ${books}`
const texts = { message, note: 'Marcada desde Servos.' }
const base = '\\id JON\n\\c 1\n\\p \\v 1 Uno. \\v 2 Dos.\n'

const phones = new Map<string, Map<string, string>>()
let store = new Map<string, string>()
beforeEach(() => {
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
  setProject('kichwa')
})
afterEach(() => vi.unstubAllGlobals())

/** Picks up a person's phone: its own storage, nothing of the last one in memory; the first time, the shared start. */
function on(name: string) {
  const first = !phones.has(name)
  if (first) phones.set(name, new Map())
  store = phones.get(name)!
  forgetBooks()
  if (first) {
    store.set('servos.libro.jon~kichwa', JSON.stringify({ state: { book: 'jon', usfm: base, journal: [], pending: [] }, working: base, pendingBy: null, pendingAt: [] }))
    store.set(`servos.prototipo.door43.cuenta.${name}`, JSON.stringify({ host, username: name.toLowerCase(), token: TOKEN }))
    setDestination('kichwa', to)
  }
}
const upload = (name: string) => {
  on(name)
  return uploadProject({ host, username: name.toLowerCase(), token: TOKEN }, to, project, name, message)
}

/** Bea writes verse 2 and uploads; Ana, who never received Bea's work, writes verse 1. */
async function beaUploadedFirst() {
  const door = fakeDoor43(host)
  on('Bea')
  writeDraft('jon', 1, 2, 'Ishkay de Bea.', 'Bea')
  await upload('Bea')
  expect(door.text(JON)).toContain('Ishkay de Bea.')
  on('Ana')
  writeDraft('jon', 1, 1, 'Shuk de Ana.', 'Ana')
  return door
}

describe('subir el mismo libro desde dos teléfonos', () => {
  it('si Ana recibió antes el trabajo de Bea, lo que sube lleva los versículos de las dos', async () => {
    const door = await beaUploadedFirst()
    on('Bea')
    const file = readShared(JSON.stringify(shareProject(project, ['jon'], 'Bea')))!
    on('Ana')
    receiveShared(file, ['jon'], { kind: 'join', projectId: 'kichwa' }, [project], 'Ana')
    await upload('Ana')
    expect(door.text(JON)).toMatch(/Shuk de Ana\.[\s\S]*Ishkay de Bea\./)
  })

  it('lo que Bea subió no desaparece cuando Ana sube sin haberlo recibido', async () => {
    const door = await beaUploadedFirst()
    await upload('Ana')
    expect(door.text(JON)).toContain('Ishkay de Bea.')
  })

  it('Ana no sube a ciegas: ese libro queda sin subir, porque en Door43 hay otra cosa', async () => {
    await beaUploadedFirst()
    const { results } = await upload('Ana')
    expect(results.find((r) => r.path === '32-JON.usfm')?.state).toBe('changed')
    // The manifest goes all the same: it already gathers everyone's books.
    expect(results.find((r) => r.path === 'manifest.yaml')?.state).not.toBe('failed')
  })

  it('una subida pedida sin internet, que sale después de la de Bea, tampoco la pisa: espera, con su motivo', async () => {
    const door = fakeDoor43(host)
    // Ana asks to upload without internet, before Bea uploads.
    on('Ana')
    writeDraft('jon', 1, 1, 'Shuk de Ana.', 'Ana')
    door.offline()
    ask({ kind: 'subir', projectId: 'kichwa', person: 'Ana' })
    door.online()
    on('Bea')
    writeDraft('jon', 1, 2, 'Ishkay de Bea.', 'Bea')
    await upload('Bea')
    // Internet comes back on Ana's phone: what waited goes, as the work is then.
    on('Ana')
    await sendWaiting(waiting(), (e) => runErrand(e, project, texts))
    expect(door.text(JON)).toContain('Ishkay de Bea.')
    expect(waiting().map((e) => [e.kind, e.problem])).toEqual([['subir', 'changed']])
  })
})

/** Brings from Door43 what changed there, on `name`'s phone, and gathers it as «Receive» does. */
async function bring(name: string) {
  on(name)
  const account = { host, username: name.toLowerCase(), token: TOKEN }
  const brought = await changedOnDoor43(account, to, project)
  const file = readShared(JSON.stringify(fromDoor43(project, brought)))!
  return receiveShared(file, file.books.map((b) => b.code), { kind: 'join', projectId: 'kichwa' }, [project], name).books
}

describe('traer lo de Door43 y juntarlo antes de subir', () => {
  /** Ana uploads the shared start; Bea brings it (nothing to gather), writes verse 2 and uploads; Ana writes verse 1. */
  async function bothFromDoor43() {
    const door = fakeDoor43(host)
    await upload('Ana')
    expect((await bring('Bea'))[0].choices).toBe(0)
    on('Bea')
    writeDraft('jon', 1, 2, 'Ishkay de Bea.', 'Bea')
    await upload('Bea')
    expect(door.text(JON)).toContain('Ishkay de Bea.')
    on('Ana')
    writeDraft('jon', 1, 1, 'Shuk de Ana.', 'Ana')
    return door
  }

  it('lo que cambió solo en Door43 entra, lo que cambió solo aquí queda; después se sube con los dos', async () => {
    const door = await bothFromDoor43()
    const [jon] = await bring('Ana')
    expect([jon.taken, jon.choices]).toEqual([1, 0])
    expect([readDraft('jon', 1, 1), readDraft('jon', 1, 2)]).toEqual(['Shuk de Ana.', 'Ishkay de Bea.'])
    const { results } = await upload('Ana')
    expect(results.find((r) => r.path === '32-JON.usfm')?.state).toBe('written')
    expect(door.text(JON)).toMatch(/Shuk de Ana\.[\s\S]*Ishkay de Bea\./)
  })

  it('lo que cambió en los dos lados espera para elegir en «Juntar»; Door43 no se toca hasta subir', async () => {
    const door = await bothFromDoor43()
    on('Ana')
    writeDraft('jon', 1, 2, 'Ishkay de Ana.', 'Ana')
    const [jon] = await bring('Ana')
    expect(jon.choices).toBe(1)
    expect([readDraft('jon', 1, 2), otherVersion('jon', 1, 2)?.text]).toEqual(['Ishkay de Ana.', 'Ishkay de Bea.'])
    expect(door.text(JON)).toContain('Ishkay de Bea.')
  })

  it('traer otra vez la misma versión no trae nada nuevo', async () => {
    await bothFromDoor43()
    await bring('Ana')
    on('Ana')
    expect(await changedOnDoor43({ host, username: 'ana', token: TOKEN }, to, project)).toEqual([])
  })

  it('sin haber visto nunca el libro en Door43: lo que Ana cambió desde el texto de allá queda; lo demás distinto se pregunta', async () => {
    await beaUploadedFirst()
    const [jon] = await bring('Ana')
    expect(jon.choices).toBe(1)
    expect([readDraft('jon', 1, 1), otherVersion('jon', 1, 1)]).toEqual(['Shuk de Ana.', null])
    expect(otherVersion('jon', 1, 2)?.text).toBe('Ishkay de Bea.')
  })
})
