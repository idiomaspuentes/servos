import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { lockedKind } from './lockedCopy'
import type { Project } from './model'
import { setProject } from './scope'
import { chooseTeamPassword, forgetTeamKeys } from './teamKeys'
import { forgetBooks, writeDraft } from './work'
import { waitsForTeamPassword, workToLeave } from './workToLeave'

/**
 * What a person leaves on Door43 for the team, by hand from «Trabajo del equipo», as an errand, or as the copy made by
 * itself: open for a project open to whoever has the file; for one kept to its team, sealed with the team's password,
 * or nothing while that password is not known here.
 */
const project = (privacy?: Project['privacy']): Project => ({
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
  ...(privacy ? { privacy } : {}),
})

const store = new Map<string, string>()
beforeEach(async () => {
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
  const usfm = '\id JON\n\c 1\n\p \v 1 Uno.\n'
  store.set('servos.libro.jon~kichwa', JSON.stringify({ state: { book: 'jon', usfm, journal: [], pending: [] }, working: usfm, pendingBy: null, pendingAt: [] }))
  writeDraft('jon', 1, 1, 'Shuk.', 'Ana')
  await forgetTeamKeys('kichwa')
})
afterEach(() => forgetTeamKeys('kichwa'))

describe('the work left on Door43', () => {
  it('goes open for a project open to whoever has the file', async () => {
    expect(await waitsForTeamPassword(project())).toBe(false)
    const work = await workToLeave(project(), 'Ana')
    expect(lockedKind(work!.text)).toBeNull()
    expect(work!.text).toContain('Shuk.')
  })

  it('for a project kept to its team, is nothing while the team’s password is not known here, and sealed once it is', async () => {
    expect(await waitsForTeamPassword(project('equipo'))).toBe(true)
    expect(await workToLeave(project('equipo'), 'Ana')).toBeNull()

    await chooseTeamPassword('kichwa', 'maíz y frijol', 1000)
    expect(await waitsForTeamPassword(project('equipo'))).toBe(false)
    const work = await workToLeave(project('equipo'), 'Ana')
    expect(lockedKind(work!.text)).toBe('compartido')
    expect(work!.text).not.toMatch(/Shuk|Biblia|kichwa|Ana/)
    // The same work, the same print: the copy made by itself does not send it again.
    expect((await workToLeave(project('equipo'), 'Ana'))!.print).toBe(work!.print)
  })
})
