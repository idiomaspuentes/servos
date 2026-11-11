/**
 * The full-text index of the format 3 client: SQLite FTS5 in the apps, which the client fills on every install and
 * import (so the first search on a phone does not read every book). The web app has none: the library then builds an
 * index in memory on the first search.
 */
import { sqlIndex, type SearchIndex } from '@bt-synergy/language-pack-client'
import { capacitorDriver } from './capacitorDriver'
import { tauriDriver } from './tauriDriver'

export type SearchPlatform = 'computadora' | 'telefono' | 'web'

type Host = { __TAURI_INTERNALS__?: unknown; Capacitor?: { isNativePlatform?(): boolean } }

export function searchPlatform(host: Host | undefined = typeof window === 'undefined' ? undefined : (window as unknown as Host)): SearchPlatform {
  if (host?.__TAURI_INTERNALS__) return 'computadora'
  if (host?.Capacitor?.isNativePlatform?.()) return 'telefono'
  return 'web'
}

let made: { platform: SearchPlatform; index: SearchIndex | undefined } | undefined

/** One index per app run: `sqlIndex` over the platform's SQLite, or `undefined` on the web (the memory index). */
export function searchIndexV3(platform = searchPlatform()): SearchIndex | undefined {
  if (made?.platform !== platform)
    made = {
      platform,
      index: platform === 'computadora' ? sqlIndex(tauriDriver()) : platform === 'telefono' ? sqlIndex(capacitorDriver()) : undefined,
    }
  return made.index
}
