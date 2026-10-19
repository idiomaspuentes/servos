import { describe, expect, it } from 'vitest'

import { isLocked, keyFrom, lock, unlock } from './lockedCopy'

// Few rounds in the tests: the copies on a phone use ROUNDS.
const ROUNDS = 1000
const work = JSON.stringify({ format: 'servos-compartir', project: { name: 'Biblia en kichwa' }, books: [{ code: 'tit', text: 'Pablo Diospak servik' }] })

describe('a copy only its password opens', () => {
  it('opens with its password and gives back the work as it was', async () => {
    const copy = await lock(work, await keyFrom('maíz y frijol 7', undefined, ROUNDS))
    expect(isLocked(copy)).toBe(true)
    expect(await unlock(copy, 'maíz y frijol 7', ROUNDS)).toBe(work)
  })

  it('does not open with another password', async () => {
    const copy = await lock(work, await keyFrom('maíz y frijol 7', undefined, ROUNDS))
    expect(await unlock(copy, 'maiz y frijol 7', ROUNDS)).toBeNull()
    expect(await unlock(copy, '', ROUNDS)).toBeNull()
  })

  it('says nothing to whoever reads it: no names, no words, not Servos', async () => {
    const copy = await lock(work, await keyFrom('clave', undefined, ROUNDS))
    expect(copy).toMatch(/^[A-Za-z0-9+/]+=*$/)
    for (const word of ['Biblia', 'kichwa', 'servos', 'Pablo', 'tit']) expect(copy.toLowerCase()).not.toContain(word.toLowerCase())
    expect(atob(copy)).not.toMatch(/Biblia|servos|kichwa/i)
  })

  it('is different each time, even of the same work with the same key', async () => {
    const key = await keyFrom('clave', undefined, ROUNDS)
    expect(await lock(work, key)).not.toBe(await lock(work, key))
  })

  it('opened with the password on another phone: the key is drawn again from the salt in the copy', async () => {
    const here = await keyFrom('clave', undefined, ROUNDS)
    const copy = await lock(work, here)
    expect(await unlock(copy, 'clave', ROUNDS)).toBe(work)
  })

  it('is told apart from work shared openly and from anything else', () => {
    expect(isLocked(work)).toBe(false)
    expect(isLocked('hola')).toBe(false)
    expect(isLocked('')).toBe(false)
  })

  it('keeps a whole book with its recordings small', async () => {
    const big = JSON.stringify({ verses: Array.from({ length: 2000 }, (_, i) => ({ v: i, text: 'Pablo Diospak servik, Jesucristopak apostol '.repeat(3) })) })
    const copy = await lock(big, await keyFrom('clave', undefined, ROUNDS))
    expect(copy.length).toBeLessThan(big.length / 4)
  })
})
