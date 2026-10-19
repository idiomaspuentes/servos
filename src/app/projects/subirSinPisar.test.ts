import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDestination } from './door43'
import { fakeDoor43, TOKEN } from './fakeDoor43'
import type { Project } from './model'
import { ask, runErrand, sendWaiting, waiting } from './outbox'
import { uploadProject } from './publishing'
import { readShared, receiveShared, shareProject } from './share'
import { setProject } from './scope'
import { forgetBooks, writeDraft } from './work'

/**
 * Two people upload the same book from two phones (design 6.10: «Git does not gather the USFM: Servos does»). What
 * one uploaded must not be replaced unseen by the other's upload, made without their work: today it is, because the
 * file's sha is read just before writing it. The `it.fails` state what should happen; they turn red once it does.
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

  it.fails('lo que Bea subió no desaparece cuando Ana sube sin haberlo recibido (hoy el archivo de Ana lo reemplaza)', async () => {
    const door = await beaUploadedFirst()
    await upload('Ana')
    expect(door.text(JON)).toContain('Ishkay de Bea.')
  })

  it.fails('Ana no sube a ciegas: se le dice que en Door43 hay otra cosa (hoy dice «subido»)', async () => {
    await beaUploadedFirst()
    const { results } = await upload('Ana')
    expect(results.find((r) => r.path === '32-JON.usfm')?.state).not.toBe('written')
  })

  it.fails('una subida pedida sin internet, que sale después de la de Bea, tampoco la pisa', async () => {
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
  })
})
