/**
 * Servos' client of the translation-helps Worker's language-pack parts routes (contract: LANGUAGE_PACKS_INFRA.md,
 * "Client contract: parts"). Every answer becomes a typed result the app can explain to a translator; nothing here
 * throws, because a phone's network is never to be trusted (a captive portal answers HTML with a 200).
 *
 * Paths: list `{server}{compat}/{lang}`, originals `{server}{compat}/originals/{sha}`, part `{server}parts/{sha}`.
 * `server` ends with `/`. `fetch` is injected for tests and defaults to the global one, read at call time.
 */

import { sha256Hex, type PartsList } from '@bt-synergy/language-pack'

export type ListAnswer =
  | { kind: 'listo'; list: PartsList; etag: string | null }
  | { kind: 'igual' }
  | { kind: 'preparando'; retryAfter: number }
  | { kind: 'actualizarApp' }
  | { kind: 'noDisponible'; retryAfter: number }
  | { kind: 'sinIdioma' }
  | { kind: 'espera'; retryAfter: number }

export type PartAnswer =
  | { kind: 'listo'; bytes: Uint8Array }
  | { kind: 'parteNoEstá' }
  | { kind: 'espera'; retryAfter: number }
  | { kind: 'falla' }

/** An originals list: the list, or why not. `noEstá` is a 404 (fetch the language list again), `falla` is a network
 *  error, a sha256 that is not the name, or a body that is not an originals list. */
export type OriginalsAnswer =
  | { kind: 'listo'; list: PartsList }
  | { kind: 'noEstá' }
  | { kind: 'espera'; retryAfter: number }
  | { kind: 'falla' }

export type ClientOptions = { fetch?: typeof fetch }

/** Seconds to wait when the Worker names no `Retry-After`. */
export const RETRY = { preparing: 600, unavailable: 300, stopped: 3600, rateLimited: 60 } as const

/** The longest wait a header can ask for: a day. */
export const MAX_RETRY = 86400

/** `Retry-After` is seconds or an HTTP date; anything else (or not in the future) is the fallback. Capped at a day. */
const retryAfterOf = (res: Response, fallback: number): number => {
  const raw = res.headers.get('Retry-After')?.trim()
  let seconds = NaN
  if (raw && /^\d+$/.test(raw)) seconds = Number(raw)
  else if (raw) seconds = Math.ceil((Date.parse(raw) - Date.now()) / 1000)
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, MAX_RETRY) : fallback
}

/** The JSON body of an answer, or null when it is not JSON (or not an object). */
async function jsonBody(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = JSON.parse(await res.text())
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null
  } catch {
    return null
  }
}

const isEntry = (p: unknown): boolean => {
  const e = p as { sha256?: unknown; bytes?: unknown } | null
  return !!e && typeof e === 'object' && typeof e.sha256 === 'string' && /^[0-9a-f]{64}$/.test(e.sha256) && typeof e.bytes === 'number'
}

/** A schema-2 parts list, of this language when one is named; its entries are checked shallowly. */
function isPartsList(value: unknown, language?: string): value is PartsList {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    v.schema === 2 &&
    Array.isArray(v.parts) &&
    Array.isArray(v.resources) &&
    (!language || v.language === language) &&
    v.parts.every(isEntry)
  )
}

const NOT_AVAILABLE: ListAnswer = { kind: 'noDisponible', retryAfter: RETRY.unavailable }

/** The language's parts list; `etag` (from a previous `listo`) makes an unchanged list a `igual`. */
export async function fetchList(
  server: string,
  compat: string,
  lang: string,
  etag?: string | null,
  opts: ClientOptions = {},
): Promise<ListAnswer> {
  const doFetch = opts.fetch ?? globalThis.fetch
  let res: Response
  try {
    res = await doFetch(`${server}${compat}/${lang}`, etag ? { headers: { 'If-None-Match': etag } } : {})
  } catch {
    return NOT_AVAILABLE
  }
  try {
    switch (res.status) {
      case 200: {
        // A captive portal answers HTML with a 200: only a schema-2 list of this language counts.
        let body: unknown
        try {
          body = JSON.parse(await res.text())
        } catch {
          return NOT_AVAILABLE
        }
        return isPartsList(body, lang) ? { kind: 'listo', list: body, etag: res.headers.get('ETag') } : NOT_AVAILABLE
      }
      case 304:
        return { kind: 'igual' }
      case 202:
        return { kind: 'preparando', retryAfter: retryAfterOf(res, RETRY.preparing) }
      case 429:
        return { kind: 'espera', retryAfter: retryAfterOf(res, RETRY.rateLimited) }
      case 503: {
        // With a `reason` no build comes without a person: do not poll fast.
        const body = await jsonBody(res)
        return { kind: 'noDisponible', retryAfter: retryAfterOf(res, body?.reason ? RETRY.stopped : RETRY.unavailable) }
      }
      case 404: {
        const body = await jsonBody(res)
        if (body?.state === 'unavailable' && body.reason === 'old-compat') return { kind: 'actualizarApp' }
        if (body?.state === 'unavailable' && body.reason === 'parts-off') {
          return { kind: 'noDisponible', retryAfter: retryAfterOf(res, RETRY.stopped) }
        }
        if (body?.error === 'no packs for this language') return { kind: 'sinIdioma' }
        return NOT_AVAILABLE
      }
      default:
        return NOT_AVAILABLE
    }
  } catch {
    return NOT_AVAILABLE
  }
}

/** The originals list a language list names, when the sha256 of its bytes is its name. */
export async function fetchOriginals(
  server: string,
  compat: string,
  sha: string,
  opts: ClientOptions = {},
): Promise<OriginalsAnswer> {
  const doFetch = opts.fetch ?? globalThis.fetch
  try {
    const res = await doFetch(`${server}${compat}/originals/${sha}`)
    if (res.status === 404) return { kind: 'noEstá' }
    if (res.status === 429) return { kind: 'espera', retryAfter: retryAfterOf(res, RETRY.rateLimited) }
    if (res.status !== 200) return { kind: 'falla' }
    const bytes = new Uint8Array(await res.arrayBuffer())
    if ((await sha256Hex(bytes)) !== sha) return { kind: 'falla' }
    const list: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return isPartsList(list, 'originals') ? { kind: 'listo', list } : { kind: 'falla' }
  } catch {
    return { kind: 'falla' }
  }
}

/** One part's gzip bytes, kept as they came: their sha256 is checked, and the importer unzips them. */
export async function fetchPart(server: string, sha: string, opts: ClientOptions = {}): Promise<PartAnswer> {
  const doFetch = opts.fetch ?? globalThis.fetch
  try {
    const res = await doFetch(`${server}parts/${sha}`)
    if (res.status === 404) return { kind: 'parteNoEstá' }
    if (res.status === 429) return { kind: 'espera', retryAfter: retryAfterOf(res, RETRY.rateLimited) }
    if (res.status !== 200) return { kind: 'falla' }
    const bytes = new Uint8Array(await res.arrayBuffer())
    return (await sha256Hex(bytes)) === sha ? { kind: 'listo', bytes } : { kind: 'falla' }
  } catch {
    return { kind: 'falla' }
  }
}
