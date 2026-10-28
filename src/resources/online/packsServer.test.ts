import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PACKS_SERVERS, packsServer, packsServerChoice, setPacksServer } from './packsServer'

const KEY = 'servos.enLinea.servidor'

describe('the server to download parts from', () => {
  const kept = new Map<string, string>()
  const storage = {
    getItem: (k: string) => kept.get(k) ?? null,
    setItem: (k: string, v: string) => void kept.set(k, v),
    removeItem: (k: string) => void kept.delete(k),
  }
  beforeEach(() => {
    kept.clear()
    vi.stubGlobal('localStorage', storage)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('names production and staging, both ending in /v2/packs/', () => {
    expect(PACKS_SERVERS.produccion).toBe('https://tc-helps.mcp.servant.bible/v2/packs/')
    expect(PACKS_SERVERS.staging).toBe('https://translation-helps-mcp-v2-preview.unfoldingword.workers.dev/v2/packs/')
  })

  it('is production, and no choice, when none was ever made', () => {
    expect(packsServer('')).toBe(PACKS_SERVERS.produccion)
    expect(packsServerChoice('')).toBeNull()
    expect(kept.size).toBe(0)
  })

  it('?packs=staging is saved and kept for the next times, until ?packs=produccion', () => {
    expect(packsServer('?packs=staging')).toBe(PACKS_SERVERS.staging)
    expect(kept.get(KEY)).toBe('staging')
    expect(packsServer('')).toBe(PACKS_SERVERS.staging)
    expect(packsServerChoice('')).toBe('staging')
    expect(packsServer('?packs=produccion')).toBe(PACKS_SERVERS.produccion)
    expect(packsServer('')).toBe(PACKS_SERVERS.produccion)
    // Chosen once, the setting stays shown.
    expect(packsServerChoice('')).toBe('produccion')
  })

  it('the URL wins over the saved choice', () => {
    setPacksServer('produccion')
    expect(packsServer('?other=1&packs=staging')).toBe(PACKS_SERVERS.staging)
  })

  it('ignores an unknown ?packs= and leaves the saved choice alone', () => {
    expect(packsServer('?packs=qa')).toBe(PACKS_SERVERS.produccion)
    expect(packsServerChoice('?packs=')).toBeNull()
    expect(kept.size).toBe(0)
    setPacksServer('staging')
    expect(packsServer('?packs=https://evil.example/')).toBe(PACKS_SERVERS.staging)
    expect(kept.get(KEY)).toBe('staging')
  })

  it('ignores a saved value that is not a server', () => {
    kept.set(KEY, 'https://evil.example/')
    expect(packsServer('')).toBe(PACKS_SERVERS.produccion)
    expect(packsServerChoice('')).toBeNull()
  })

  it('setPacksServer saves the choice', () => {
    setPacksServer('staging')
    expect(packsServerChoice('')).toBe('staging')
    expect(packsServer('')).toBe(PACKS_SERVERS.staging)
  })

  it('is production, and never throws, when localStorage cannot be used', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    })
    expect(packsServer('')).toBe(PACKS_SERVERS.produccion)
    // Asked for in the URL, it is used for this visit though it cannot be kept.
    expect(packsServer('?packs=staging')).toBe(PACKS_SERVERS.staging)
    expect(() => setPacksServer('staging')).not.toThrow()
    expect(packsServerChoice('')).toBeNull()
  })

  it('reads location.search by default, and works with no location (node)', () => {
    expect(typeof location).toBe('undefined')
    expect(packsServer()).toBe(PACKS_SERVERS.produccion)
    vi.stubGlobal('location', { search: '?packs=staging' })
    expect(packsServer()).toBe(PACKS_SERVERS.staging)
    expect(packsServerChoice()).toBe('staging')
  })
})

describe('the desktop app may reach the servers', () => {
  const HERE = dirname(fileURLToPath(import.meta.url))
  const raw = readFileSync(resolve(HERE, '../../../src-tauri/tauri.conf.json'), 'utf8')

  it('tauri.conf.json is still valid JSON', () => {
    expect(() => JSON.parse(raw)).not.toThrow()
  })

  it('connect-src names the origin of both servers', () => {
    const conf = JSON.parse(raw) as { app: { security: { csp: Record<string, string> } } }
    const sources = conf.app.security.csp['connect-src'].split(/\s+/)
    for (const url of Object.values(PACKS_SERVERS)) expect(sources).toContain(new URL(url).origin)
  })
})
