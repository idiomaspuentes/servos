import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setDestination } from '../projects/door43'
import { fakeDoor43, TOKEN } from '../projects/fakeDoor43'
import { lockedKind } from '../projects/lockedCopy'
import { saveProjects, type Project } from '../projects/model'
import { chooseTeamPassword, forgetTeamKeys } from '../projects/teamKeys'
import { copyOn, copyToDoor43Now, door43CopyState, failingLong, setCopyData, setCopyOn } from './door43Copy'

/**
 * The copy of each person's work on Door43, made by itself (philosophy, principle 9): on for a project open to whoever
 * has the file, off for one kept to its team and sealed when switched on; only with Wi-Fi unless the person said so;
 * and failing unsaid on Home until it has failed for days.
 */
const project = (id: string, privacy?: Project['privacy']): Project => ({
  id,
  kind: 'bible',
  name: `Biblia ${id}`,
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
const host = 'https://qa.door43.org'
const store = new Map<string, string>()
let network: { onLine: boolean; connection?: { type: string } }

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
  network = { onLine: true }
  vi.stubGlobal('navigator', network)
  store.set('servos.prototipo.door43.cuenta.Ana', JSON.stringify({ host, username: 'ana', token: TOKEN }))
  await forgetTeamKeys('equipo')
})
afterEach(() => vi.unstubAllGlobals())

const shelf = (door43: ReturnType<typeof fakeDoor43>) => [...door43.assets.values()]

describe('the copy of the work on Door43', () => {
  it('is on from the start for a project open to whoever has the file, off for one kept to its team', () => {
    expect(copyOn('Ana', project('abierto'))).toBe(true)
    expect(copyOn('Ana', project('equipo', 'equipo'))).toBe(false)
    setCopyOn('Ana', 'abierto', false)
    expect(copyOn('Ana', project('abierto'))).toBe(false)
  })

  it('goes to the shelf of the private repository, once while the work is the same, and says when', async () => {
    const door43 = fakeDoor43(host)
    saveProjects([project('abierto')])
    setDestination('abierto', { host, owner: 'BSOJ', repo: 'qu_reg' })
    await copyToDoor43Now('Ana')
    expect(door43.repos.get('BSOJ/qu_reg-servos')).toEqual({ private: true })
    expect(shelf(door43)).toHaveLength(1)
    expect(door43CopyState('Ana').at).not.toBeNull()
    const calls = door43.calls.length
    await copyToDoor43Now('Ana')
    expect(door43.calls.length).toBe(calls)
  })

  it('waits for a place on Door43, and for the team’s password of a project kept to its team: never sent open', async () => {
    const door43 = fakeDoor43(host)
    saveProjects([project('sinLugar'), project('equipo', 'equipo')])
    setDestination('equipo', { host, owner: 'BSOJ', repo: 'qu_reg' })
    setCopyOn('Ana', 'equipo', true)
    await copyToDoor43Now('Ana')
    expect(shelf(door43)).toHaveLength(0)

    await chooseTeamPassword('equipo', 'maíz y frijol', 1000)
    await copyToDoor43Now('Ana')
    expect(shelf(door43)).toHaveLength(1)
    const sent = new TextDecoder().decode(await new Response(new Blob([new Uint8Array(shelf(door43)[0].bytes)]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
    expect(lockedKind(sent)).toBe('compartido')
    expect(sent).not.toContain('Biblia')
  })

  it('goes only with Wi-Fi, unless the person said mobile data too', async () => {
    const door43 = fakeDoor43(host)
    saveProjects([project('abierto')])
    setDestination('abierto', { host, owner: 'BSOJ', repo: 'qu_reg' })
    network.connection = { type: 'cellular' }
    await copyToDoor43Now('Ana')
    expect(shelf(door43)).toHaveLength(0)
    setCopyData('Ana', true)
    await copyToDoor43Now('Ana')
    expect(shelf(door43)).toHaveLength(1)
  })

  it('without internet tries nothing and fails nothing; failing with internet is said on Home only after days', async () => {
    const door43 = fakeDoor43(host)
    saveProjects([project('abierto')])
    setDestination('abierto', { host, owner: 'BSOJ', repo: 'qu_reg' })
    network.onLine = false
    await copyToDoor43Now('Ana')
    expect(door43.calls).toEqual([])
    expect(door43CopyState('Ana').problem).toBeNull()

    // The phone says it is online, and Door43 cannot be reached (a network with no way out).
    network.onLine = true
    door43.offline()
    await copyToDoor43Now('Ana')
    const state = door43CopyState('Ana')
    expect(state.problem).toBe('offline')
    expect(failingLong(state)).toBe(false)
    expect(failingLong(state, new Date(Date.now() + 3 * 86_400_000))).toBe(true)

    door43.online()
    await copyToDoor43Now('Ana')
    expect(door43CopyState('Ana')).toMatchObject({ problem: null, failingSince: null })
  })
})
