import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextVersion, setDestination, uploadedOf } from './door43'
import { fakeDoor43, TOKEN } from './fakeDoor43'
import type { Project } from './model'
import { ask, drop, errandNow, keysOf, runErrand, sendWaiting, settle, waiting, type Errand } from './outbox'
import { booksOf } from './publishing'
import { addTake, keepSound } from './recordings'
import { setProject } from './scope'
import { forgetBooks, writeDraft } from './work'

/**
 * What needs Door43 is asked for without internet all the same: it waits on the phone, once, and goes when there is
 * internet and the person says yes, as the work is then.
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
const texts = { message: (books: string) => `Servos: Ana sube ${books}`, note: 'Marcada desde Servos por Ana.' }

const store = new Map<string, string>()
beforeEach(() => {
  store.clear()
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
  forgetBooks()
  const usfm = '\\id JON\n\\c 1\n\\p \\v 1 Uno. \\v 2 Dos.\n'
  store.set('servos.libro.jon~kichwa', JSON.stringify({ state: { book: 'jon', usfm, journal: [], pending: [] }, working: usfm, pendingBy: null, pendingAt: [] }))
  store.set('servos.prototipo.door43.cuenta.Ana', JSON.stringify({ host, username: 'ana', token: TOKEN }))
  setDestination('kichwa', { host, owner: 'BSOJ', repo: 'qu_reg' })
})
afterEach(() => vi.unstubAllGlobals())

const asked = (kind: Errand['kind'], person = 'Ana') => ({ kind, projectId: 'kichwa', person })

describe('lo que se pide sin internet', () => {
  it('se guarda una vez, como se pidió la última vez; marcar una versión sube también, así que ocupa el lugar de subir', () => {
    ask(asked('subir'), new Date('2026-10-17T10:00:00Z'))
    ask(asked('subir'), new Date('2026-10-17T11:00:00Z'))
    expect(waiting().map((e) => [e.kind, e.at])).toEqual([['subir', '2026-10-17T11:00:00.000Z']])
    ask(asked('version'))
    expect(waiting().map((e) => e.kind)).toEqual(['version'])
    // Asked to upload while a version waits: the version uploads, nothing more is kept.
    ask(asked('subir'))
    expect(waiting().map((e) => e.kind)).toEqual(['version'])
  })

  it('cada persona tiene lo suyo, y lo que se quita no se envía', () => {
    ask(asked('dejar', 'Ana'))
    const bea = ask(asked('dejar', 'Bea'))
    ask({ ...asked('traer', 'Bea'), book: 'jon' })
    expect(waiting('Ana').map((e) => e.kind)).toEqual(['dejar'])
    expect(waiting('Bea').map((e) => e.kind)).toEqual(['dejar', 'traer'])
    drop(bea.id)
    expect(waiting('Bea').map((e) => e.kind)).toEqual(['traer'])
  })

  it('hecho desde su pantalla con internet, deja de esperar; una versión hecha cubre la subida que esperaba', () => {
    ask(asked('subir'))
    ask(asked('dejar'))
    settle('version', 'kichwa', 'Ana')
    expect(waiting().map((e) => e.kind)).toEqual(['dejar'])
  })

  it('dice si el libro cambió desde que se pidió: va como está al enviarse', () => {
    const e = ask({ ...asked('subir'), keys: keysOf(booksOf(project)) })
    expect(errandNow(e, project).changed).toBe(false)
    writeDraft('jon', 1, 1, 'Shuk.', 'Ana')
    expect(errandNow(e, project).changed).toBe(true)
  })
})

describe('cuando vuelve internet y la persona dice que sí', () => {
  it('se envía en el orden en que se pidió; lo que no llega sigue esperando con su problema, y sin internet no se intenta lo demás', async () => {
    const a = ask(asked('subir'))
    const b = ask(asked('dejar'))
    const c = ask({ ...asked('traer'), book: 'jon' })
    const tried: string[] = []
    const done = await sendWaiting(waiting(), async (e) => {
      tried.push(e.kind)
      return e.kind === 'subir' ? { sent: { kind: 'subir', written: 1, same: 0 } } : { problem: 'offline' }
    })
    expect(tried).toEqual(['subir', 'dejar'])
    expect(done.get(a.id)).toEqual({ sent: { kind: 'subir', written: 1, same: 0 } })
    expect(waiting().map((e) => [e.id, e.problem])).toEqual([
      [b.id, 'offline'],
      [c.id, undefined],
    ])
  })

  it('una versión pedida sin internet sube el texto como está, marca la versión siguiente y le adjunta las grabaciones', async () => {
    const door = fakeDoor43(host)
    writeDraft('jon', 1, 1, 'Shuk.', 'Ana')
    addTake('jon', 1, 1, { by: 'Ana', at: '2026-10-17T10:00:00Z', ms: 2000, mime: 'audio/webm' }, 'toma1')
    await keepSound('toma1', new Blob([new Uint8Array([1, 2, 3, 4, 5])]))
    const e = ask(asked('version'))
    // Written after it was asked: it goes too, as the book is when it goes.
    writeDraft('jon', 1, 2, 'Ishkay.', 'Ana')
    const done = await sendWaiting(waiting(), (x) => runErrand(x, project, texts))
    expect(done.get(e.id)).toEqual({ sent: { kind: 'version', n: 1, takes: 1 } })
    expect(door.repos.get('BSOJ/qu_reg')).toEqual({ private: false })
    expect(door.text('BSOJ/qu_reg/32-JON.usfm')).toMatch(/\\v 1 Shuk\.[\s\S]*\\v 2 Ishkay\./)
    expect(door.files.has('BSOJ/qu_reg/manifest.yaml')).toBe(true)
    // The sound is not in git: it goes with the version.
    expect([...door.files.keys()].some((k) => k.includes('audio'))).toBe(false)
    const release = door.releases.get('BSOJ/qu_reg@v1')!
    expect([...door.assets.values()].map((a) => [a.release, a.name])).toEqual([[release.id, 'audio-JON.zip']])
    expect(uploadedOf('kichwa', 'jon')?.by).toBe('Ana')
    expect(waiting()).toEqual([])
  })

  it('sin la cuenta de quien lo pidió no se envía: espera, y se le dice que la vincule', async () => {
    fakeDoor43(host)
    store.delete('servos.prototipo.door43.cuenta.Ana')
    const e = ask(asked('subir'))
    await sendWaiting(waiting(), (x) => runErrand(x, project, texts))
    expect(waiting().map((x) => [x.id, x.problem])).toEqual([[e.id, 'signin']])
  })

  it('si Door43 no responde, el número de la versión no se adivina', async () => {
    const door = fakeDoor43(host)
    door.repos.set('BSOJ/qu_reg', { private: false })
    door.releases.set('BSOJ/qu_reg@v1', { id: 9, tag_name: 'v1', prerelease: false })
    const account = { host, username: 'ana', token: TOKEN }
    const to = { host, owner: 'BSOJ', repo: 'qu_reg' }
    expect(await nextVersion(account, to)).toBe(2)
    door.offline()
    await expect(nextVersion(account, to)).rejects.toThrow()
  })
})
