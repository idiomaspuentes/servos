/**
 * The translation-helps Worker's parts routes in memory, for the tests: language lists (with an ETag and 304), originals
 * lists and parts by their sha256, and any answer the real Worker can give forced in their place. `offline()` makes it
 * unreachable, as a phone without internet. Pass `fetch` to the client; nothing is stubbed globally.
 */

import { sha256Hex, writePart, type PartEntry, type PartRow, type PartsList } from '@bt-synergy/language-pack'

export const FAKE_SERVER = 'https://worker.test/v2/packs/'
export const FAKE_COMPAT = 'f2.0-test'

/** A forced answer: its status, body (JSON-encoded unless a string) and headers. */
export type Forced = { status: number; body?: unknown; headers?: Record<string, string>; contentType?: string }

/** The answers the Worker's contract names, ready to force. */
export const ANSWERS = {
  preparando: { status: 202, body: { state: 'preparing' }, headers: { 'Retry-After': '600' } },
  nodisponible: { status: 503, body: { state: 'unavailable' }, headers: { 'Retry-After': '300' } },
  detenido: { status: 503, body: { state: 'unavailable', reason: 'stopped' }, headers: { 'Retry-After': '3600' } },
  oldCompat: { status: 404, body: { state: 'unavailable', reason: 'old-compat' } },
  partsOff: { status: 404, body: { state: 'unavailable', reason: 'parts-off' } },
  sinPacks: { status: 404, body: { error: 'no packs for this language' } },
  parteNoEsta: { status: 404, body: { error: 'part not found' } },
  originalsNoEsta: { status: 404, body: { error: 'originals list not found' } },
  limite: { status: 429, body: { error: 'rate limited' }, headers: { 'Retry-After': '30' } },
  /** A captive portal: HTML with a 200. */
  html: { status: 200, body: '<html><body>Log in to the Wi-Fi</body></html>', contentType: 'text/html' },
} satisfies Record<string, Forced>

export type FakeWorkerOptions = { server?: string; compat?: string }
type Kind = 'list' | 'originals' | 'part'

export function fakeWorker(opts: FakeWorkerOptions = {}) {
  const server = opts.server ?? FAKE_SERVER
  const compat = opts.compat ?? FAKE_COMPAT
  const lists = new Map<string, PartsList>()
  const originals = new Map<string, PartsList | Uint8Array>()
  const parts = new Map<string, Uint8Array>()
  const forced: Record<Kind, { answer: Forced; left: number } | null> = { list: null, originals: null, part: null }
  const calls: { url: string; headers: Record<string, string> }[] = []
  let reachable = true

  const reply = (f: Forced) => {
    const text = typeof f.body === 'string' ? f.body : f.body === undefined ? '' : JSON.stringify(f.body)
    return new Response(text, {
      status: f.status,
      headers: { 'Content-Type': f.contentType ?? 'application/json', ...f.headers },
    })
  }
  const take = (kind: Kind): Forced | null => {
    const slot = forced[kind]
    if (!slot) return null
    if (--slot.left <= 0) forced[kind] = null
    return slot.answer
  }
  const bytesOf = (v: PartsList | Uint8Array) => (v instanceof Uint8Array ? v : new TextEncoder().encode(JSON.stringify(v)))

  const fetchFake = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    if (!reachable) throw new TypeError('Failed to fetch')
    const url = String(input)
    const headers = (init.headers ?? {}) as Record<string, string>
    calls.push({ url, headers })
    if (!url.startsWith(server)) return reply({ status: 404, body: 'not found', contentType: 'text/plain' })
    const path = url.slice(server.length)

    let m = /^parts\/([0-9a-f]+)$/.exec(path)
    if (m) {
      const f = take('part')
      if (f) return reply(f)
      const bytes = parts.get(m[1])
      return bytes
        ? new Response(bytes.slice(), { status: 200, headers: { 'Content-Type': 'application/gzip' } })
        : reply(ANSWERS.parteNoEsta)
    }
    m = new RegExp(`^${compat}/originals/([0-9a-f]+)$`).exec(path)
    if (m) {
      const f = take('originals')
      if (f) return reply(f)
      const o = originals.get(m[1])
      return o
        ? new Response(bytesOf(o).slice(), { status: 200, headers: { 'Content-Type': 'application/json' } })
        : reply(ANSWERS.originalsNoEsta)
    }
    m = new RegExp(`^${compat}/([^/]+)$`).exec(path)
    if (m) {
      const f = take('list')
      if (f) return reply(f)
      const list = lists.get(m[1])
      if (!list) return reply(ANSWERS.sinPacks)
      const etag = `"${(await sha256Hex(bytesOf(list))).slice(0, 16)}"`
      if (headers['If-None-Match'] === etag) return new Response(null, { status: 304, headers: { ETag: etag } })
      return new Response(JSON.stringify(list), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ETag: etag },
      })
    }
    return reply({ status: 400, body: { error: 'bad pack path' } })
  }

  return {
    server,
    compat,
    fetch: fetchFake as typeof globalThis.fetch,
    lists,
    originals,
    parts,
    calls,
    /** Force this answer on the next `times` requests of a kind (all of them by default); `null` clears it. */
    setAnswer(kind: Kind, answer: Forced | null, times = Infinity) {
      forced[kind] = answer ? { answer, left: times } : null
    },
    offline() {
      reachable = false
    },
    online() {
      reachable = true
    },
    /** Make a part from rows, keep its bytes under its sha256, and return its list entry. */
    async addPart(
      entry: Pick<PartEntry, 'kind' | 'resource'> & Partial<PartEntry>,
      rows: PartRow[],
    ): Promise<PartEntry> {
      const made = await writePart(rows)
      parts.set(made.sha256, made.bytes)
      return {
        fingerprint: `fp-${made.sha256.slice(0, 8)}`,
        layers: ['sot'],
        ...entry,
        sha256: made.sha256,
        bytes: made.bytes.length,
        rows: made.rows,
      }
    },
    /** A schema-2 list of a language with these parts, stored under it. */
    async setList(language: string, entries: PartEntry[], extra: Partial<PartsList> = {}): Promise<PartsList> {
      const list = {
        schema: 2,
        language,
        compat,
        code: 'code-1',
        versions: {},
        resources: [],
        parts: entries,
        ...extra,
      } as unknown as PartsList
      lists.set(language, list)
      return list
    },
    /** Keep an originals list under the sha256 of its bytes and return the reference a language list carries. */
    async setOriginals(list: PartsList): Promise<{ path: string; sha256: string }> {
      const sha256 = await sha256Hex(bytesOf(list))
      originals.set(sha256, list)
      return { path: `catalog/${compat}/originals/${sha256}.json`, sha256 }
    },
  }
}
