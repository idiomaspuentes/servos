/**
 * The basemap of the maps (a complement of the common catalog, 6 KB: coasts, lakes and rivers of Natural Earth) on this
 * device. It comes down with the book (`fetchBasemapV3`, called after each install and refresh) and travels in the
 * transfer file (`exportTransfer` carries the complements). `basemapV3` reads it from the store, decoded once.
 */
import { basemapOf, decodeBasemap, type Basemap } from '@bt-synergy/language-pack-v3'
import type { LanguagePackClient } from '@bt-synergy/language-pack-client'
import { complementsV3, packsV3, storedFileV3, subscribeReadersV3 } from './client'

/** The basemap and what the credit needs of its complement. */
export type BasemapHere = { id: string; basemap: Basemap; license?: string }

const hex = (id: Uint8Array): string => Array.from(id, (b) => b.toString(16).padStart(2, '0')).join('')

/**
 * Asks for the basemap of the language's catalogs. Never fails: the basemap is optional, so a network error, a source
 * that has none or a catalog without it are ignored (the card says the map is not here).
 */
export async function fetchBasemapV3(client: LanguagePackClient, lang: string, signal?: AbortSignal): Promise<void> {
  try {
    await client.fetchComplements(lang, { kinds: ['basemap'], ...(signal ? { signal } : {}) })
  } catch {
    /* optional */
  }
}

/** Decoded basemaps by the id of their complement; forgotten with the readers, so a file received is read anew. */
const decoded = new Map<string, Basemap>()
subscribeReadersV3(() => decoded.clear())

/** The languages whose basemap was asked for this run when it was missing: once each, not at every card. */
const asked = new Set<string>()

/** For tests: forgets what was asked and decoded. */
export function resetBasemapV3(): void {
  decoded.clear()
  asked.clear()
}

async function readBasemap(lang: string): Promise<BasemapHere | null> {
  const listed = basemapOf(await complementsV3(lang))
  if (!listed) return null
  const id = hex(listed.id)
  let basemap = decoded.get(id)
  if (!basemap) {
    const bytes = await storedFileV3(await packsV3(), id)
    if (!bytes) return null
    basemap = decodeBasemap(bytes)
    decoded.set(id, basemap)
  }
  return { id, basemap, ...(listed.license ? { license: listed.license } : {}) }
}

/**
 * The basemap on this device for a language, or null when it is not here or cannot be read. When it is missing and the
 * device is online, it is asked for once per run (a device that had the book before the map existed gets it so).
 */
export async function basemapV3(lang: string): Promise<BasemapHere | null> {
  try {
    const here = await readBasemap(lang)
    if (here || asked.has(lang) || (typeof navigator !== 'undefined' && navigator.onLine === false)) return here
    asked.add(lang)
    await fetchBasemapV3(await packsV3(), lang)
    return await readBasemap(lang)
  } catch {
    return null
  }
}
