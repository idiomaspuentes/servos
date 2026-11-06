/**
 * Which translation-helps Worker Servos downloads language-pack parts from. Production for everyone; its staging copy
 * for whoever tries the app, who opens it once with `?packs=staging` (kept for the next times, the installed app too,
 * until it is opened with `?packs=produccion`). Any other `?packs=` is ignored, so a link cannot point Servos at a
 * server it does not know. The setting to switch is shown only once a choice was made (`packsServerChoice`), as the
 * Door43 host picker (`src/app/projects/door43.ts`, `?server=qa`).
 */

/** The servers, each ending in `/v2/packs/`. Their origins are in the desktop app's CSP (`connect-src`). */
export const PACKS_SERVERS = {
  produccion: 'https://tc-helps.mcp.servant.bible/v2/packs/',
  staging: 'https://translation-helps-mcp-v2-preview.unfoldingword.workers.dev/v2/packs/',
} as const

export type PacksServerId = keyof typeof PACKS_SERVERS

const KEY = 'servos.enLinea.servidor'

const isId = (v: unknown): v is PacksServerId => v === 'produccion' || v === 'staging'

const saved = (): PacksServerId | null => {
  try {
    const v = localStorage.getItem(KEY)
    return isId(v) ? v : null
  } catch {
    return null
  }
}

/** Saves the choice; when it cannot be kept, it is only lost for the next times. */
export function setPacksServer(id: PacksServerId): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* kept for this visit by the URL that asked for it */
  }
}

const currentSearch = () => (typeof location === 'undefined' ? '' : location.search)

/** The server chosen on this device: one asked for in the URL (and saved), else the saved one, else none. */
export function packsServerChoice(search = currentSearch()): PacksServerId | null {
  const asked = new URLSearchParams(search).get('packs')
  if (isId(asked)) {
    setPacksServer(asked)
    return asked
  }
  return saved()
}

/** The server to download from: the chosen one, else production. */
export function packsServer(search = currentSearch()): string {
  return PACKS_SERVERS[packsServerChoice(search) ?? 'produccion']
}

/**
 * Where format 3 packs (`/v3/packs/...`, read with `@bt-synergy/language-pack-client`) are served from. Production's
 * origin is listed for completeness only: `packsFormat()` is never 3 there, so no request is sent to it.
 */
export const V3_ORIGINS: Record<PacksServerId, string> = {
  produccion: 'https://tc-helps.mcp.servant.bible',
  staging: 'https://translation-helps-mcp-v2-preview.unfoldingword.workers.dev',
}

/** The packs format this device downloads: 3 exactly when the packs server is staging, else today's 2. */
export function packsFormat(search = currentSearch()): 2 | 3 {
  return packsServer(search) === PACKS_SERVERS.staging ? 3 : 2
}
