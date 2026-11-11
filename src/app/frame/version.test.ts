import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { appLabel } from './version'

describe('the version label', () => {
  const kept = new Map<string, string>()
  beforeEach(() => {
    kept.clear()
    vi.stubGlobal('localStorage', { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => void kept.set(k, v), removeItem: (k: string) => void kept.delete(k) })
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('says «staging» when the packs come from staging (format 3), whatever the build', () => {
    expect(appLabel(() => 3)).toMatch(/ · staging$/)
    expect(appLabel(() => 2)).not.toContain('staging')
    // A device that chose staging, in a production build.
    kept.set('servos.enLinea.servidor', 'staging')
    expect(appLabel()).toMatch(/ · staging$/)
  })

  it('a test build whose person chose production says nothing: the saved choice wins', () => {
    vi.stubEnv('VITE_SERVOS_PACKS', 'staging')
    expect(appLabel()).toMatch(/ · staging$/)
    kept.set('servos.enLinea.servidor', 'produccion')
    expect(appLabel()).not.toContain('staging')
  })

  it('does not fail where the server cannot be read', () => {
    expect(appLabel(() => {
      throw new Error('no storage')
    })).toMatch(/^Servos /)
  })
})
