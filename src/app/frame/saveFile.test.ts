import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { PIECE, writeInPieces } from './phone'
import { saveFile } from './saveFile'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))

describe('saving a file in the app for computers', () => {
  beforeEach(() => {
    invoke.mockReset()
    vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('asks the system where, under the name the app gave it, and says the name it got', async () => {
    invoke.mockResolvedValue('Jonás para Ana.servos')
    expect(await saveFile('Jonás.servos', '{}')).toEqual({ state: 'saved', name: 'Jonás para Ana.servos' })
    expect(invoke).toHaveBeenCalledWith('save_file', { name: 'Jonás.servos', text: '{}' })
  })

  it('takes the dialog closed as no answer, not as a failure', async () => {
    invoke.mockResolvedValue(null)
    expect(await saveFile('JON.usfm', '\\id JON', 'text/plain')).toEqual({ state: 'declined', name: 'JON.usfm' })
  })

  it('hands bytes over as they are', async () => {
    invoke.mockResolvedValue('es-419-tit.tcpack')
    expect(await saveFile('es-419-tit.tcpack', new Uint8Array([0, 255, 7]), 'application/octet-stream')).toEqual({ state: 'saved', name: 'es-419-tit.tcpack' })
    expect(invoke).toHaveBeenCalledWith('save_file', { name: 'es-419-tit.tcpack', text: '', bytes: [0, 255, 7] })
  })

  it('says it could not when the file could not be written', async () => {
    invoke.mockRejectedValue('Acceso denegado')
    expect(await saveFile('Jonás.servos', '{}')).toEqual({ state: 'failed', name: 'Jonás.servos' })
  })
})

const { share, write, discard } = vi.hoisted(() => ({ share: vi.fn(), write: vi.fn(), discard: vi.fn() }))
// As Capacitor's plugins do, it answers to `then` too: taken for a promise, it would fail.
vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({ share, write, discard, then: () => Promise.reject(new Error('"ServosFiles.then()" is not implemented')) }),
}))

/** The file the fake plugin was given, its pieces put together. */
const written = () => Buffer.concat(write.mock.calls.map(([p]) => Buffer.from((p as { base64: string }).base64, 'base64')))

describe('saving a file in the app for phones', () => {
  beforeEach(() => {
    share.mockReset()
    write.mockReset().mockResolvedValue(undefined)
    discard.mockReset().mockResolvedValue(undefined)
    vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("writes the file first, then hands only its name and type to the phone's share sheet", async () => {
    share.mockResolvedValue({})
    expect(await saveFile('Jonás.servos', '{"á":1}', 'application/json', 'Guardar en el teléfono')).toEqual({ state: 'shared', name: 'Jonás.servos' })
    expect(write).toHaveBeenCalledTimes(1)
    expect(write).toHaveBeenCalledWith({ name: 'Jonás.servos', base64: expect.any(String), append: false })
    // The text as UTF-8, as the plugin wrote it before.
    expect(written().toString('utf8')).toBe('{"á":1}')
    expect(share).toHaveBeenCalledWith({ name: 'Jonás.servos', type: 'application/json', keepHere: 'Guardar en el teléfono' })
    await saveFile('JON.usfm', '\\id JON', 'text/plain')
    expect(share).toHaveBeenLastCalledWith({ name: 'JON.usfm', type: 'text/plain', keepHere: '' })
  })

  it('writes a big file in pieces of 256 KB of base64, none of it in the call that shares it', async () => {
    share.mockResolvedValue({})
    const bytes = new Uint8Array(PIECE * 3 + 5).map((_, i) => (i * 7) % 256)
    await saveFile('es-419-tit.tcpack', bytes, 'application/octet-stream', 'Guardar en el teléfono')
    const pieces = write.mock.calls.map(([p]) => p as { base64: string; append: boolean })
    expect(pieces.length).toBe(Math.ceil(bytes.length / PIECE))
    expect(pieces.every((p) => p.base64.length <= 262_144)).toBe(true)
    expect(pieces.map((p) => p.append)).toEqual(pieces.map((_, i) => i > 0))
    expect(written().equals(bytes)).toBe(true)
    expect(JSON.stringify(share.mock.calls[0]).length).toBeLessThan(200)
  })

  it('writes an empty file as one empty piece', async () => {
    share.mockResolvedValue({})
    await saveFile('vacío.servos', '')
    expect(write).toHaveBeenCalledWith({ name: 'vacío.servos', base64: '', append: false })
  })

  it('puts the pieces together whatever their size', async () => {
    const bytes = new Uint8Array([0, 255, 7, 1, 2, 3, 4])
    await writeInPieces({ write, discard }, 'x.tcpack', bytes, 3)
    expect(write.mock.calls.map(([p]) => p)).toEqual([
      { name: 'x.tcpack', base64: 'AP8H', append: false },
      { name: 'x.tcpack', base64: 'AQID', append: true },
      { name: 'x.tcpack', base64: 'BA==', append: true },
    ])
  })

  it('deletes a file it could not write whole, and does not share it', async () => {
    write.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('No space left'))
    expect(await saveFile('es-419-tit.tcpack', new Uint8Array(PIECE * 3), 'application/octet-stream')).toEqual({ state: 'failed', name: 'es-419-tit.tcpack' })
    expect(discard).toHaveBeenCalledWith({ name: 'es-419-tit.tcpack' })
    expect(share).not.toHaveBeenCalled()
  })

  it('shares one file at a time: a second one waits until the first is written and shared', async () => {
    const log: string[] = []
    let release!: () => void
    share.mockImplementation(async ({ name }: { name: string }) => {
      log.push(`share ${name}`)
      // The first sheet stays up until released.
      if (log.filter((l) => l.startsWith('share')).length === 1) await new Promise<void>((r) => (release = r))
      return {}
    })
    write.mockImplementation(async ({ name, append }: { name: string; append: boolean }) => {
      log.push(`write ${name} ${append ? 'append' : 'start'}`)
      await new Promise((r) => setTimeout(r, 1))
    })
    const bytes = new Uint8Array(PIECE * 2 + 1)
    const a = saveFile('es-419-tit.tcpack', bytes, 'application/octet-stream')
    const b = saveFile('es-419-tit.tcpack', bytes, 'application/octet-stream')
    await vi.waitFor(() => expect(log).toContain('share es-419-tit.tcpack'))
    // While the first is on the sheet, the second has written nothing.
    expect(log.filter((l) => l.startsWith('write'))).toHaveLength(3)
    release()
    await Promise.all([a, b])
    expect(log).toEqual([
      'write es-419-tit.tcpack start',
      'write es-419-tit.tcpack append',
      'write es-419-tit.tcpack append',
      'share es-419-tit.tcpack',
      'write es-419-tit.tcpack start',
      'write es-419-tit.tcpack append',
      'write es-419-tit.tcpack append',
      'share es-419-tit.tcpack',
    ])
  })

  it('goes on after a share that failed', async () => {
    share.mockRejectedValueOnce(new Error('No space left')).mockResolvedValueOnce({})
    const a = saveFile('a.servos', '{}')
    const b = saveFile('b.servos', '{}')
    expect(await a).toEqual({ state: 'failed', name: 'a.servos' })
    expect(await b).toEqual({ state: 'shared', name: 'b.servos' })
  })

  it('says the name it was kept under when it was kept on the phone', async () => {
    share.mockResolvedValue({ saved: 'Jonás (1).servos' })
    expect(await saveFile('Jonás.servos', '{}', 'application/json', 'Guardar en el teléfono')).toEqual({ state: 'saved', name: 'Jonás (1).servos' })
  })

  it('says it could not when the file could not be written', async () => {
    share.mockRejectedValue(new Error('No space left'))
    expect(await saveFile('Jonás.servos', '{}')).toEqual({ state: 'failed', name: 'Jonás.servos' })
  })
})