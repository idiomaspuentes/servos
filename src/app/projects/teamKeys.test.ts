import { beforeEach, describe, expect, it } from 'vitest'

import { isLocked, keyFrom, lock, lockedKind, unlock, unlockKeeping, type CopyKey } from './lockedCopy'
import { sealedFileName } from './share'
import { chooseTeamPassword, forgetTeamKeys, keepTeamKey, openWithTeamKeys, teamKey, useShelf } from './teamKeys'

// Few rounds in the tests: on a phone they are lockedCopy's ROUNDS.
const ROUNDS = 1000
const work = JSON.stringify({ format: 'servos-compartir', from: 'Ana', project: { id: 'kichwa', name: 'Biblia en kichwa', privacy: 'equipo' } })

beforeEach(() => {
  const kept = new Map<string, CopyKey[]>()
  useShelf({
    get: async (id) => kept.get(id) ?? [],
    put: async (id, keys) => void (keys.length ? kept.set(id, keys) : kept.delete(id)),
    all: async () => [...kept.entries()],
  })
})

describe('work shared within a team', () => {
  it('is sealed and told apart from a copy on a memory card', async () => {
    const key = await keyFrom('maíz y frijol', undefined, ROUNDS)
    const shared = await lock(work, key, 'compartido')
    const copy = await lock(work, key)
    expect(isLocked(shared)).toBe(true)
    expect(lockedKind(shared)).toBe('compartido')
    expect(lockedKind(copy)).toBe('copia')
    expect(lockedKind(work)).toBeNull()
    for (const word of ['Biblia', 'kichwa', 'servos', 'Ana']) expect(shared.toLowerCase()).not.toContain(word.toLowerCase())
  })

  it('opens with the team password on another phone, which keeps the key for the next file', async () => {
    const here = await chooseTeamPassword('kichwa', 'maíz y frijol', ROUNDS)
    const first = await lock(work, here, 'compartido')

    // The other phone: the same project's keys are not there.
    useShelf({ get: async () => [], put: async () => {}, all: async () => [] })
    expect(await openWithTeamKeys(first)).toBeNull()
    expect(await unlockKeeping(first, 'maiz y frijol', ROUNDS)).toBeNull()
    const opened = await unlockKeeping(first, 'maíz y frijol', ROUNDS)
    expect(opened?.text).toBe(work)

    const kept = new Map<string, CopyKey[]>()
    useShelf({ get: async (id) => kept.get(id) ?? [], put: async (id, keys) => void kept.set(id, keys), all: async () => [...kept.entries()] })
    await keepTeamKey('kichwa', opened!.key)
    // The next file from the same phone opens without asking.
    expect(await openWithTeamKeys(await lock(work, here, 'compartido'))).toBe(work)
  })

  it('shares with the key chosen here, and keeps the others to receive with', async () => {
    const own = await chooseTeamPassword('kichwa', 'maíz y frijol', ROUNDS)
    const theirs = await keyFrom('maíz y frijol', undefined, ROUNDS)
    await keepTeamKey('kichwa', theirs)
    await keepTeamKey('kichwa', theirs)
    expect((await teamKey('kichwa'))?.salt).toEqual(own.salt)
    expect(await openWithTeamKeys(await lock(work, theirs, 'compartido'))).toBe(work)
  })

  it('forgotten, nothing opens by itself and there is no key to share with', async () => {
    const own = await chooseTeamPassword('kichwa', 'maíz y frijol', ROUNDS)
    await forgetTeamKeys('kichwa')
    expect(await teamKey('kichwa')).toBeNull()
    expect(await openWithTeamKeys(await lock(work, own, 'compartido'))).toBeNull()
  })

  it('a copy on a memory card is never opened with a team key', async () => {
    const own = await chooseTeamPassword('kichwa', 'maíz y frijol', ROUNDS)
    const copy = await lock(work, own)
    expect(await openWithTeamKeys(copy)).toBeNull()
    expect(await unlock(copy, 'maíz y frijol', ROUNDS)).toBe(work)
  })

  it('goes under a name that says only the day', () => {
    expect(sealedFileName(new Date(2026, 9, 18, 22, 30))).toBe('copia-18-10.servos')
  })
})
