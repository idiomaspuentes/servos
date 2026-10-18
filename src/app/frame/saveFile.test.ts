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
