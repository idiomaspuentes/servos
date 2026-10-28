/**
 * Servos' client of the translation-helps Worker's language-pack parts routes (contract: LANGUAGE_PACKS_INFRA.md,
 * "Client contract: parts"). Every answer becomes a typed result the app can explain to a translator; nothing here
 * throws, because a phone's network is never to be trusted (a captive portal answers HTML with a 200).
 *
 * Paths: list `{server}{compat}/{lang}`, originals `{server}{compat}/originals/{sha}`, part `{server}parts/{sha}`.
 * `server` ends with `/`. `fetch` is injected for tests and defaults to the global one, read at call time.
 *
 * A dead link on a phone often stalls instead of failing, so every request has an idle timeout: it is aborted when
 * no headers, or no further body bytes, come for `idleMs` (30 s). The body is read chunk by chunk and each chunk
 * restarts the clock, so a slow link that keeps moving is never cut. A caller's `signal` aborts it at once.
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

export type ClientOptions = {
  fetch?: typeof fetch
  /** How long a request may go without headers or body bytes before it is given up (default 30 s). */
  idleMs?: number
  /** The caller's own abort: the request ends at once. */
  signal?: AbortSignal
}

/** The default idle timeout. */
export const IDLE_MS = 30_000

type Request = { res: Response; bytes: () => Promise<Uint8Array>; text: () => Promise<string>; end: () => void }

/**
 * One request under an idle timeout and the caller's signal. Every wait is raced against the abort, so it ends even
 * with a fetch that ignores its signal. `bytes()` reads the body by chunks, restarting the clock on each; `end()`
 * stops the clock (call it in a `finally`).
 */
async function request(url: string, init: RequestInit, opts: ClientOptions): Promise<Request> {
  const doFetch = opts.fetch ?? globalThis.fetch
  const ctrl = new AbortController()
  const idleMs = opts.idleMs ?? IDLE_MS
  let timer: ReturnType<typeof setTimeout> | undefined
  const kick = () => {
    clearTimeout(timer)
    timer = setTimeout(() => ctrl.abort(new DOMException('no bytes for too long', 'TimeoutError')), idleMs)
  }
  const onCaller = () => ctrl.abort(opts.signal?.reason)
  const end = () => {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onCaller)
  }
  opts.signal?.addEventListener('abort', onCaller, { once: true })
  if (opts.signal?.aborted) ctrl.abort(opts.signal.reason)
  const aborted = new Promise<never>((_, reject) => {
    const fail = () => reject(ctrl.signal.reason ?? new DOMException('aborted', 'AbortError'))
    if (ctrl.signal.aborted) fail()
    else ctrl.signal.addEventListener('abort', fail, { once: true })
  })
  aborted.catch(() => {})
  const race = <T>(p: Promise<T>): Promise<T> => Promise.race([p, aborted])

  kick()
  let res: Response
  try {
    res = await race(doFetch(url, { ...init, signal: ctrl.signal }))
  } catch (e) {
    end()
    throw e
  }
  kick()

  let read: Promise<Uint8Array> | null = null
  const readAll = async (): Promise<Uint8Array> => {
    if (!res.body) return new Uint8Array(await race(res.arrayBuffer()))
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      for (;;) {
        const { done, value } = await race(reader.read())
        if (done) break
        chunks.push(value)
        size += value.byteLength
        kick()
      }
    } catch (e) {
      reader.cancel().catch(() => {})
      throw e
    }
    const all = new Uint8Array(size)
    let at = 0
    for (const c of chunks) {
      all.set(c, at)
      at += c.byteLength
    }
    return all
  }
  const bytes = () => (read ??= readAll().finally(end))
  const text = async () => new TextDecoder().decode(await bytes())
  return { res, bytes, text, end }
}

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

/** The JSON body of an answer, or null when it is not JSON (or not an object, or did not come). */
async function jsonBody(r: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = JSON.parse(await r.text())
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
  let r: Request
  try {
    r = await request(`${server}${compat}/${lang}`, etag ? { headers: { 'If-None-Match': etag } } : {}, opts)
  } catch {
    return NOT_AVAILABLE
  }
  const res = r.res
  try {
    switch (res.status) {
      case 200: {
        // A captive portal answers HTML with a 200: only a schema-2 list of this language counts.
        let body: unknown
        try {
          body = JSON.parse(await r.text())
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
        const body = await jsonBody(r)
        return { kind: 'noDisponible', retryAfter: retryAfterOf(res, body?.reason ? RETRY.stopped : RETRY.unavailable) }
      }
      case 404: {
        const body = await jsonBody(r)
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
  } finally {
    // A body not read (a 304, a 202) is let go, and its clock stopped.
    r.end()
    if (!res.bodyUsed) res.body?.cancel().catch(() => {})
  }
}

/** The originals list a language list names, when the sha256 of its bytes is its name. */
export async function fetchOriginals(
  server: string,
  compat: string,
  sha: string,
  opts: ClientOptions = {},
): Promise<OriginalsAnswer> {
  let r: Request | null = null
  try {
    r = await request(`${server}${compat}/originals/${sha}`, {}, opts)
    const res = r.res
    if (res.status === 404) return { kind: 'noEstá' }
    if (res.status === 429) return { kind: 'espera', retryAfter: retryAfterOf(res, RETRY.rateLimited) }
    if (res.status !== 200) return { kind: 'falla' }
    const bytes = await r.bytes()
    if ((await sha256Hex(bytes)) !== sha) return { kind: 'falla' }
    const list: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return isPartsList(list, 'originals') ? { kind: 'listo', list } : { kind: 'falla' }
  } catch {
    return { kind: 'falla' }
  } finally {
    r?.end()
  }
}

/** One part's gzip bytes, kept as they came: their sha256 is checked, and the importer unzips them. */
export async function fetchPart(server: string, sha: string, opts: ClientOptions = {}): Promise<PartAnswer> {
  let r: Request | null = null
  try {
    r = await request(`${server}parts/${sha}`, {}, opts)
    const res = r.res
    if (res.status === 404) return { kind: 'parteNoEstá' }
    if (res.status === 429) return { kind: 'espera', retryAfter: retryAfterOf(res, RETRY.rateLimited) }
    if (res.status !== 200) return { kind: 'falla' }
    const bytes = await r.bytes()
    return (await sha256Hex(bytes)) === sha ? { kind: 'listo', bytes } : { kind: 'falla' }
  } catch {
    return { kind: 'falla' }
  } finally {
    r?.end()
  }
}
