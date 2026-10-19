import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

  it('says it could not when the file could not be written', async () => {
    invoke.mockRejectedValue('Acceso denegado')
    expect(await saveFile('Jonás.servos', '{}')).toEqual({ state: 'failed', name: 'Jonás.servos' })
  })
})

const { share } = vi.hoisted(() => ({ share: vi.fn() }))
// As Capacitor's plugins do, it answers to `then` too: taken for a promise, it would fail.
vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({ share, then: () => Promise.reject(new Error('"ServosFiles.then()" is not implemented')) }) }))

describe('saving a file in the app for phones', () => {
  beforeEach(() => {
    share.mockReset()
    vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("hands the file, under the name the app gave it and with its type, to the phone's share sheet", async () => {
    share.mockResolvedValue({})
    expect(await saveFile('Jonás.servos', '{}', 'application/json', 'Guardar en el teléfono')).toEqual({ state: 'shared', name: 'Jonás.servos' })
    expect(share).toHaveBeenCalledWith({ name: 'Jonás.servos', text: '{}', type: 'application/json', keepHere: 'Guardar en el teléfono' })
    await saveFile('JON.usfm', '\\id JON', 'text/plain')
    expect(share).toHaveBeenLastCalledWith({ name: 'JON.usfm', text: '\\id JON', type: 'text/plain', keepHere: '' })
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
