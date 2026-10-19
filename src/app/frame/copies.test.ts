import { describe, expect, it } from 'vitest'

import { COPY_NAME, copyName } from './copies'

describe('the names of the copies on a memory card', () => {
  it('say nothing of the project: six letters and when it was made', async () => {
    const { name, prefix } = await copyName('biblia-kichwa', new Date(2026, 9, 18, 22, 5), true)
    expect(name).toMatch(/^copia-[0-9a-f]{6}-20261018-2205\.dat$/)
    expect(name.startsWith(prefix)).toBe(true)
    expect(name).not.toMatch(/biblia|kichwa|servos/i)
  })

  it('tell projects apart, and the same project the same way each time', async () => {
    const at = new Date(2026, 9, 18, 22, 5)
    const a = await copyName('biblia-kichwa', at, true)
    expect((await copyName('biblia-kichwa', at, true)).prefix).toBe(a.prefix)
    expect((await copyName('biblia-quechua', at, true)).prefix).not.toBe(a.prefix)
  })

  it('sort by when they were made, so the oldest is the one that goes', async () => {
    const older = await copyName('p', new Date(2026, 8, 30, 23, 59), true)
    const newer = await copyName('p', new Date(2026, 9, 1, 0, 1), true)
    expect([newer.name, older.name].sort()).toEqual([older.name, newer.name])
  })

  it('are .servos when the copy is open, which «Receive» opens like any shared file', async () => {
    expect((await copyName('p', new Date(2026, 9, 18), false)).name).toMatch(/\.servos$/)
  })

  it('are the only files ever deleted from the folder', async () => {
    expect(COPY_NAME.test((await copyName('p', new Date(), true)).name)).toBe(true)
    expect(COPY_NAME.test((await copyName('p', new Date(), false)).name)).toBe(true)
    expect(COPY_NAME.test('copia-3fa9c1-20261018-2205.dat.parcial')).toBe(true)
    for (const other of ['copia de mi tesis.docx', 'copia-3fa9c1.dat', 'Biblia en kichwa — Tito.servos', 'fotos', 'copia-3fa9c1-20261018-2205.dat.bak'])
      expect(COPY_NAME.test(other)).toBe(false)
  })
})
