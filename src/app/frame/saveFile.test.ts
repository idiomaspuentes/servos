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

const { writeFile, share } = vi.hoisted(() => ({ writeFile: vi.fn(), share: vi.fn() }))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: { writeFile }, Directory: { Cache: 'CACHE' }, Encoding: { UTF8: 'utf8' } }))
vi.mock('@capacitor/share', () => ({ Share: { share } }))

describe('saving a file in the app for phones', () => {
  beforeEach(() => {
    writeFile.mockReset().mockResolvedValue({ uri: 'file:///cache/compartir/Jonás.servos' })
    share.mockReset()
    vi.stubGlobal('window', { Capacitor: { isNativePlatform: () => true } })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('hands the file, under the name the app gave it, to the phone\'s share sheet', async () => {
    share.mockResolvedValue({})
    expect(await saveFile('Jonás.servos', '{}')).toEqual({ state: 'shared', name: 'Jonás.servos' })
    expect(writeFile).toHaveBeenCalledWith(expect.objectContaining({ path: 'compartir/Jonás.servos', data: '{}' }))
    expect(share).toHaveBeenCalledWith({ files: ['file:///cache/compartir/Jonás.servos'], title: 'Jonás.servos' })
  })

  it('takes the sheet left without choosing as no answer, not as a failure', async () => {
    share.mockRejectedValue(new Error('Share canceled'))
    expect(await saveFile('JON.usfm', '\id JON', 'text/plain')).toEqual({ state: 'declined', name: 'JON.usfm' })
  })

  it('says it could not when the file could not be written', async () => {
    writeFile.mockRejectedValue(new Error('No space left'))
    expect(await saveFile('Jonás.servos', '{}')).toEqual({ state: 'failed', name: 'Jonás.servos' })
  })
})
