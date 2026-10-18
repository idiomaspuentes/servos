import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { booksThere, manifestOf, titlesOf } from './door43'
import { fakeDoor43, TOKEN } from './fakeDoor43'
import type { Project } from './model'
import { uploadProject } from './publishing'
import { setProject } from './scope'
import { forgetBooks, writeDraft } from './work'

/**
 * Several people publish one project, each from a device with only some of its books: what one uploads never takes
 * out of the manifest what another uploaded (seen on QA, 18 Oct 2026: Ana's Titus left Bea's Jonah out of it).
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
  books: [
    { code: 'jon', phase: 'traduccion' },
    { code: 'tit', phase: 'traduccion', name: 'Titoman' },
  ],
  miniApps: { estudio: [], traduccion: ['editor'], revision: [], comunitaria: [], publicacion: ['publicar'] },
}
const host = 'https://qa.door43.org'
const account = { host, username: 'ana', token: TOKEN }
const to = { host, owner: 'testingOrg', repo: 'qu_reg' }
const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64')
const message = (books: string) => `Servos: Ana sube ${books}`

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
})
afterEach(() => vi.unstubAllGlobals())

/** The repository as Bea left it: her Jonah, and a manifest naming it as her team does. */
function afterBea() {
  const door = fakeDoor43(host)
  door.repos.set('testingOrg/qu_reg', { private: false })
  door.files.set('testingOrg/qu_reg/32-JON.usfm', { b64: b64('\\id JON\n\\c 1\n\\p \\v 1 Shuk.\n'), sha: 'bea1' })
  door.files.set('testingOrg/qu_reg/README.md', { b64: b64('# qu_reg\n'), sha: 'r' })
  door.files.set('testingOrg/qu_reg/manifest.yaml', { b64: b64(manifestOf(project, 'testingOrg', 'qu_reg', [{ code: 'jon', title: "Jonás'manta" }])), sha: 'bea2' })
  return door
}

describe('publishing from a device with only some books', () => {
  it('keeps in the manifest the books others uploaded, by the name they gave them, and never deletes their files', async () => {
    const door = afterBea()
    writeDraft('tit', 1, 1, 'Pablo.', 'Ana')
    const { results } = await uploadProject(account, to, project, 'Ana', message)
    expect(results.map((r) => [r.path, r.state])).toEqual([
      ['57-TIT.usfm', 'written'],
      ['manifest.yaml', 'written'],
    ])
    const yaml = door.text('testingOrg/qu_reg/manifest.yaml')!
    expect([...titlesOf(yaml)]).toEqual([
      ['jon', "Jonás'manta"],
      ['tit', 'Titoman'],
    ])
    expect(yaml).toContain("    path: './32-JON.usfm'")
    expect(yaml).toContain("    path: './57-TIT.usfm'")
    // Bea's Jonah is as she left it.
    expect(door.files.get('testingOrg/qu_reg/32-JON.usfm')?.sha).toBe('bea1')
    expect(door.calls.some((c) => c.startsWith('DELETE'))).toBe(false)
  })

  it('names a book already there that the manifest does not name by the team’s name for it here', async () => {
    const door = afterBea()
    door.files.delete('testingOrg/qu_reg/manifest.yaml')
    writeDraft('tit', 1, 1, 'Pablo.', 'Ana')
    await uploadProject(account, to, project, 'Ana', message)
    expect([...titlesOf(door.text('testingOrg/qu_reg/manifest.yaml')!)]).toEqual([
      ['jon', 'Jonás'],
      ['tit', 'Titoman'],
    ])
  })

  it('the first time, with no repository yet, names only what goes now', async () => {
    const door = fakeDoor43(host)
    writeDraft('tit', 1, 1, 'Pablo.', 'Ana')
    await uploadProject(account, to, project, 'Ana', message)
    expect([...titlesOf(door.text('testingOrg/qu_reg/manifest.yaml')!).keys()]).toEqual(['tit'])
  })

  it('without reaching Door43 it writes no manifest, rather than one missing books', async () => {
    const door = afterBea()
    door.offline()
    writeDraft('tit', 1, 1, 'Pablo.', 'Ana')
    await expect(uploadProject(account, to, project, 'Ana', message)).rejects.toThrow()
  })
})

describe('the books already in the repository', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('are its NN-BOOK.usfm files, with the names the manifest gives them; none without a repository', async () => {
    const door = afterBea()
    door.files.set('testingOrg/qu_reg/notas/41-MAT.usfm', { b64: b64('x'), sha: 'n' })
    door.files.set('testingOrg/qu_reg/99-XYZ.usfm', { b64: b64('x'), sha: 'x' })
    expect(await booksThere(account, to)).toEqual([{ code: 'jon', title: "Jonás'manta" }])
    expect(await booksThere(account, { ...to, repo: 'otro' })).toEqual([])
  })

  it('read the names of a manifest written by other tools, quoted or not', () => {
    const yaml = ['dublin_core:', '  title: "Biblia"', 'projects:', '  -', '    categories:', '      - bible-nt', '    identifier: tit', '    title: "Tito"', '  - title: Jonás', '    identifier: JON', ''].join('\n')
    expect([...titlesOf(yaml)]).toEqual([
      ['tit', 'Tito'],
      ['jon', 'Jonás'],
    ])
  })
})
