import { describe, expect, it } from 'vitest'
import { sha256Hex, type PartsList } from '@bt-synergy/language-pack'
import { fetchList, fetchOriginals, fetchPart } from './packsClient'
import { ANSWERS, fakeWorker } from './fakeWorker'

const row = (key: string) => ({ layer: 'sot' as const, key, value: { x: key } })

async function withList() {
  const w = fakeWorker()
  const part = await w.addPart({ kind: 'book', resource: 'a/b/tn', book: 'rut' }, [row('tn:rut')])
  const list = await w.setList('es-419', [part])
  return { w, part, list }
}
const list = (w: ReturnType<typeof fakeWorker>, etag?: string | null) =>
  fetchList(w.server, w.compat, 'es-419', etag, { fetch: w.fetch })

describe('fetchList', () => {
  it('returns the list and its ETag on a 200, asking at the right path', async () => {
    const { w, list: l } = await withList()
    const a = await list(w)
    expect(a).toMatchObject({ kind: 'listo', list: l })
    expect(a.kind === 'listo' && a.etag).toMatch(/^"/)
    expect(w.calls[0].url).toBe(`${w.server}${w.compat}/es-419`)
    expect(w.calls[0].headers['If-None-Match']).toBeUndefined()
  })

  it('sends If-None-Match and says igual on a 304', async () => {
    const { w } = await withList()
    const first = await list(w)
    const etag = first.kind === 'listo' ? first.etag : null
    expect(await list(w, etag)).toEqual({ kind: 'igual' })
    expect(w.calls[1].headers['If-None-Match']).toBe(etag)
  })

  it('reads a changed list again when the ETag no longer matches', async () => {
    const { w, part } = await withList()
    const first = await list(w)
    await w.setList('es-419', [part], { code: 'code-2' })
    const a = await list(w, first.kind === 'listo' ? first.etag : null)
    expect(a.kind).toBe('listo')
  })

  it.each([
    ['preparando', ANSWERS.preparando, { kind: 'preparando', retryAfter: 600 }],
    [
      'preparando with its header',
      { ...ANSWERS.preparando, headers: { 'Retry-After': '45' } },
      { kind: 'preparando', retryAfter: 45 },
    ],
    [
      'preparando without a header',
      { status: 202, body: { state: 'preparing' } },
      { kind: 'preparando', retryAfter: 600 },
    ],
    ['old compat', ANSWERS.oldCompat, { kind: 'actualizarApp' }],
    ['parts off', ANSWERS.partsOff, { kind: 'noDisponible', retryAfter: 3600 }],
    ['no packs', ANSWERS.sinPacks, { kind: 'sinIdioma' }],
    ['503', ANSWERS.nodisponible, { kind: 'noDisponible', retryAfter: 300 }],
    [
      '503 without a header',
      { status: 503, body: { state: 'unavailable' } },
      { kind: 'noDisponible', retryAfter: 300 },
    ],
    ['503 with a reason', ANSWERS.detenido, { kind: 'noDisponible', retryAfter: 3600 }],
    [
      '503 with a reason, no header',
      { status: 503, body: { state: 'unavailable', reason: 'error' } },
      { kind: 'noDisponible', retryAfter: 3600 },
    ],
    ['429', ANSWERS.limite, { kind: 'espera', retryAfter: 30 }],
    ['429 without a header', { status: 429, body: {} }, { kind: 'espera', retryAfter: 60 }],
    [
      'a 404 that is not the Worker',
      { status: 404, body: '<html>nope</html>', contentType: 'text/html' },
      { kind: 'noDisponible', retryAfter: 300 },
    ],
    [
      'a 500',
      { status: 500, body: 'boom', contentType: 'text/plain' },
      { kind: 'noDisponible', retryAfter: 300 },
    ],
  ])('%s', async (_name, answer, expected) => {
    const { w } = await withList()
    w.setAnswer('list', answer)
    expect(await list(w)).toEqual(expected)
  })

  it('treats HTML with a 200 (a captive portal) as noDisponible', async () => {
    const { w } = await withList()
    w.setAnswer('list', ANSWERS.html)
    expect(await list(w)).toEqual({ kind: 'noDisponible', retryAfter: 300 })
  })

  it.each([
    ['JSON that is not a list', { hello: 'world' }],
    ['a schema 1 entry', { schema: 1, language: 'es-419', parts: [] }],
    ['a list of another language', { schema: 2, language: 'pt-br', resources: [], parts: [] }],
    ['a list without parts', { schema: 2, language: 'es-419', resources: [] }],
    ['null', 'null'],
  ])('treats %s with a 200 as noDisponible', async (_name, body) => {
    const { w } = await withList()
    w.setAnswer('list', { status: 200, body })
    expect(await list(w)).toEqual({ kind: 'noDisponible', retryAfter: 300 })
  })

  it('reads Retry-After as an HTTP date and caps it at a day', async () => {
    const { w } = await withList()
    const inAMinute = new Date(Date.now() + 60_000).toUTCString()
    w.setAnswer('list', { ...ANSWERS.preparando, headers: { 'Retry-After': inAMinute } }, 1)
    const a = await list(w)
    expect(a.kind === 'preparando' && a.retryAfter).toBeGreaterThan(50)
    expect(a.kind === 'preparando' && a.retryAfter).toBeLessThanOrEqual(61)
    w.setAnswer('list', { ...ANSWERS.preparando, headers: { 'Retry-After': '999999' } }, 1)
    expect(await list(w)).toEqual({ kind: 'preparando', retryAfter: 86400 })
    w.setAnswer('list', { ...ANSWERS.preparando, headers: { 'Retry-After': 'soon' } }, 1)
    expect(await list(w)).toEqual({ kind: 'preparando', retryAfter: 600 })
  })

  it('treats a list whose entries are not parts as noDisponible', async () => {
    const { w } = await withList()
    const bad = { schema: 2, language: 'es-419', resources: [], parts: [{ sha256: 'xyz', bytes: 'many' }] }
    w.setAnswer('list', { status: 200, body: bad })
    expect(await list(w)).toEqual({ kind: 'noDisponible', retryAfter: 300 })
  })

  it('says noDisponible when the network fails', async () => {
    const { w } = await withList()
    w.offline()
    expect(await list(w)).toEqual({ kind: 'noDisponible', retryAfter: 300 })
  })

  it('uses the global fetch when none is given', async () => {
    const { w } = await withList()
    const keep = globalThis.fetch
    globalThis.fetch = w.fetch
    try {
      expect((await fetchList(w.server, w.compat, 'es-419')).kind).toBe('listo')
    } finally {
      globalThis.fetch = keep
    }
  })
})

describe('fetchOriginals', () => {
  async function withOriginals() {
    const { w } = await withList()
    const orig = await w.setList('originals', [])
    const ref = await w.setOriginals(orig)
    return { w, orig, sha: ref.sha256 }
  }
  const get = (w: ReturnType<typeof fakeWorker>, sha: string) => fetchOriginals(w.server, w.compat, sha, { fetch: w.fetch })

  it('listo: the list, when the sha256 of its bytes is its name', async () => {
    const { w, orig, sha } = await withOriginals()
    expect(await get(w, sha)).toEqual({ kind: 'listo', list: orig })
    expect(w.calls[0].url).toBe(`${w.server}${w.compat}/originals/${sha}`)
  })

  it('noEstá: a 404, so the caller fetches the language list again', async () => {
    const { w } = await withOriginals()
    expect(await get(w, 'b'.repeat(64))).toEqual({ kind: 'noEstá' })
  })

  it('espera: a 429, with its Retry-After or 60 seconds', async () => {
    const { w, sha } = await withOriginals()
    w.setAnswer('originals', ANSWERS.limite, 1)
    expect(await get(w, sha)).toEqual({ kind: 'espera', retryAfter: 30 })
    w.setAnswer('originals', { status: 429, body: {} }, 1)
    expect(await get(w, sha)).toEqual({ kind: 'espera', retryAfter: 60 })
  })

  it('falla: a sha256 that is not the name, HTML, a 500, a list that is not originals, a network error', async () => {
    const { w, sha } = await withOriginals()
    // The bytes of another list under this name.
    const other = await w.setOriginals({
      schema: 2, language: 'originals', parts: [], resources: [], code: 'other',
    } as unknown as PartsList)
    w.originals.set(sha, w.originals.get(other.sha256)!)
    expect(await get(w, sha)).toEqual({ kind: 'falla' })
    w.setAnswer('originals', ANSWERS.html)
    expect(await get(w, sha)).toEqual({ kind: 'falla' })
    w.setAnswer('originals', { status: 500, body: 'boom', contentType: 'text/plain' })
    expect(await get(w, sha)).toEqual({ kind: 'falla' })
    w.setAnswer('originals', null)
    // Bytes whose sha256 does match their name, but which are not an originals list.
    const notOriginals = [
      '<html></html>',
      JSON.stringify({ schema: 2, language: 'es-419', parts: [], resources: [] }),
    ]
    for (const text of notOriginals) {
      const bytes = new TextEncoder().encode(text)
      const name = await sha256Hex(bytes)
      w.originals.set(name, bytes)
      expect(await get(w, name)).toEqual({ kind: 'falla' })
    }
    w.offline()
    expect(await get(w, sha)).toEqual({ kind: 'falla' })
  })
})

describe('fetchPart', () => {
  const get = (w: ReturnType<typeof fakeWorker>, sha: string) => fetchPart(w.server, sha, { fetch: w.fetch })

  it('returns the bytes when their sha256 is the name, without unzipping them', async () => {
    const { w, part } = await withList()
    const a = await get(w, part.sha256)
    expect(a.kind).toBe('listo')
    if (a.kind === 'listo') expect(await sha256Hex(a.bytes)).toBe(part.sha256)
    expect(w.calls[0].url).toBe(`${w.server}parts/${part.sha256}`)
  })

  it('says falla when the bytes do not match, including a captive portal page', async () => {
    const { w, part } = await withList()
    w.parts.set(part.sha256, new TextEncoder().encode('garbled'))
    expect(await get(w, part.sha256)).toEqual({ kind: 'falla' })
    w.setAnswer('part', ANSWERS.html)
    expect(await get(w, part.sha256)).toEqual({ kind: 'falla' })
  })

  it('says parteNoEstá on a 404 and asks only once', async () => {
    const { w } = await withList()
    expect(await get(w, 'a'.repeat(64))).toEqual({ kind: 'parteNoEstá' })
    expect(w.calls).toHaveLength(1)
  })

  it('says espera on a 429, with the header or 60 seconds', async () => {
    const { w, part } = await withList()
    w.setAnswer('part', ANSWERS.limite, 1)
    expect(await get(w, part.sha256)).toEqual({ kind: 'espera', retryAfter: 30 })
    w.setAnswer('part', { status: 429, body: {} }, 1)
    expect(await get(w, part.sha256)).toEqual({ kind: 'espera', retryAfter: 60 })
  })

  it('says falla on a 500 and on a network error', async () => {
    const { w, part } = await withList()
    w.setAnswer('part', { status: 500, body: 'boom', contentType: 'text/plain' })
    expect(await get(w, part.sha256)).toEqual({ kind: 'falla' })
    w.setAnswer('part', null)
    w.offline()
    expect(await get(w, part.sha256)).toEqual({ kind: 'falla' })
  })
})

describe('a refused answer frees its connection', () => {
  it('fetchPart cancels the unread body of a 404, a 429 and a 500', async () => {
    const { w, part } = await withList()
    const url = `${w.server}parts/${part.sha256}`
    const missing = `${w.server}parts/${'a'.repeat(64)}`
    expect(await fetchPart(w.server, 'a'.repeat(64), { fetch: w.fetch })).toEqual({ kind: 'parteNoEstá' })
    w.setAnswer('part', ANSWERS.limite, 1)
    expect((await fetchPart(w.server, part.sha256, { fetch: w.fetch })).kind).toBe('espera')
    w.setAnswer('part', { status: 500, body: 'boom', contentType: 'text/plain' }, 1)
    expect(await fetchPart(w.server, part.sha256, { fetch: w.fetch })).toEqual({ kind: 'falla' })
    expect(w.cancelled).toEqual([missing, url, url])
  })

  it('fetchOriginals cancels the unread body of a 404, a 429 and a 500', async () => {
    const { w } = await withList()
    const sha = 'b'.repeat(64)
    const url = `${w.server}${w.compat}/originals/${sha}`
    const get = () => fetchOriginals(w.server, w.compat, sha, { fetch: w.fetch })
    expect(await get()).toEqual({ kind: 'noEstá' })
    w.setAnswer('originals', ANSWERS.limite, 1)
    expect((await get()).kind).toBe('espera')
    w.setAnswer('originals', { status: 500, body: 'boom', contentType: 'text/plain' }, 1)
    expect(await get()).toEqual({ kind: 'falla' })
    expect(w.cancelled).toEqual([url, url, url])
  })

  it('fetchList cancels the unread body of a 429, and a read body is not cancelled', async () => {
    const { w } = await withList()
    w.setAnswer('list', ANSWERS.limite, 1)
    expect((await list(w)).kind).toBe('espera')
    w.setAnswer('list', ANSWERS.sinPacks, 1)
    expect(await list(w)).toEqual({ kind: 'sinIdioma' })
    expect(w.cancelled).toEqual([`${w.server}${w.compat}/es-419`])
  })
})

describe('fakeWorker', () => {
  it('drops the connection after n requests, or on a forced network error, until it is online again', async () => {
    const { w, part } = await withList()
    w.cutAfter(1)
    expect((await fetchPart(w.server, part.sha256, { fetch: w.fetch })).kind).toBe('listo')
    expect(await fetchPart(w.server, part.sha256, { fetch: w.fetch })).toEqual({ kind: 'falla' })
    w.online()
    w.setAnswer('part', ANSWERS.red, 1)
    expect(await fetchPart(w.server, part.sha256, { fetch: w.fetch })).toEqual({ kind: 'falla' })
    expect((await fetchPart(w.server, part.sha256, { fetch: w.fetch })).kind).toBe('listo')
  })

  it('holds requests at a gate and counts how many are in flight at once', async () => {
    const { w, part } = await withList()
    let open!: () => void
    const door = new Promise<void>((r) => (open = r))
    w.gate(() => door)
    const all = [1, 2, 3].map(() => fetchPart(w.server, part.sha256, { fetch: w.fetch }))
    await new Promise((r) => setTimeout(r, 0))
    expect(w.inFlight).toBe(3)
    open()
    await Promise.all(all)
    expect(w.inFlight).toBe(0)
    expect(w.maxInFlight).toBe(3)
  })
})

/** A fetch whose bodies come in `pieces` chunks, one every `everyMs`: a slow link that keeps moving. */
const slowly =
  (doFetch: typeof fetch, everyMs: number, pieces: number): typeof fetch =>
  async (input, init) => {
    const res = await doFetch(input, init)
    const bytes = new Uint8Array(await res.arrayBuffer())
    const size = Math.ceil(bytes.length / pieces)
    let at = 0
    const body = new ReadableStream<Uint8Array>({
      async pull(c) {
        await new Promise((r) => setTimeout(r, everyMs))
        if (at >= bytes.length) return c.close()
        c.enqueue(bytes.slice(at, (at += size)))
      },
    })
    return new Response(body, { status: res.status, headers: res.headers })
  }
const never = () => new Promise<void>(() => {})

describe('a stalled link', () => {
  const IDLE = 150

  it('fetchPart says falla when no headers come, whether or not the fetch heeds the abort', async () => {
    const { w, part } = await withList()
    w.setAnswer('part', ANSWERS.colgado)
    const t = Date.now()
    expect(await fetchPart(w.server, part.sha256, { fetch: w.fetch, idleMs: IDLE })).toEqual({ kind: 'falla' })
    expect(Date.now() - t).toBeLessThan(2000)

    // A fetch that never settles, abort or not (here: a gate that never opens).
    w.setAnswer('part', null)
    w.gate(never)
    expect(await fetchPart(w.server, part.sha256, { fetch: w.fetch, idleMs: IDLE })).toEqual({ kind: 'falla' })
  })

  it('fetchPart says falla when the body stops coming', async () => {
    const { w, part } = await withList()
    w.setAnswer('part', ANSWERS.cuerpoColgado)
    expect(await fetchPart(w.server, part.sha256, { fetch: w.fetch, idleMs: IDLE })).toEqual({ kind: 'falla' })
  })

  it('never cuts a slow link that keeps moving, though the whole takes longer than the idle time', async () => {
    const { w, part } = await withList()
    const t = Date.now()
    const a = await fetchPart(w.server, part.sha256, { fetch: slowly(w.fetch, IDLE / 3, 8), idleMs: IDLE })
    expect(a.kind).toBe('listo')
    expect(Date.now() - t).toBeGreaterThan(IDLE * 2)
    const l = await fetchList(w.server, w.compat, 'es-419', null, { fetch: slowly(w.fetch, IDLE / 3, 8), idleMs: IDLE })
    expect(l.kind).toBe('listo')
  })

  it('fetchOriginals says falla and fetchList says noDisponible (300 s) on a stall', async () => {
    const { w } = await withList()
    const ref = await w.setOriginals({ schema: 2, language: 'originals', parts: [], resources: [] } as unknown as PartsList)
    w.setAnswer('originals', ANSWERS.colgado)
    expect(await fetchOriginals(w.server, w.compat, ref.sha256, { fetch: w.fetch, idleMs: IDLE })).toEqual({ kind: 'falla' })
    w.setAnswer('originals', ANSWERS.cuerpoColgado)
    expect(await fetchOriginals(w.server, w.compat, ref.sha256, { fetch: w.fetch, idleMs: IDLE })).toEqual({ kind: 'falla' })

    w.setAnswer('list', ANSWERS.colgado)
    expect(await list2(w, IDLE)).toEqual({ kind: 'noDisponible', retryAfter: 300 })
    w.setAnswer('list', { ...ANSWERS.cuerpoColgado, contentType: 'application/json' })
    expect(await list2(w, IDLE)).toEqual({ kind: 'noDisponible', retryAfter: 300 })
  })

  it('ends at once when the caller’s signal aborts, long before the idle time', async () => {
    const { w, part } = await withList()
    w.gate(never)
    const ctrl = new AbortController()
    setTimeout(() => ctrl.abort(), 20)
    const t = Date.now()
    const opts = { fetch: w.fetch, idleMs: 60_000, signal: ctrl.signal }
    expect(await fetchPart(w.server, part.sha256, opts)).toEqual({ kind: 'falla' })
    expect(await fetchList(w.server, w.compat, 'es-419', null, opts)).toEqual({ kind: 'noDisponible', retryAfter: 300 })
    expect(Date.now() - t).toBeLessThan(2000)
  })
})
const list2 = (w: ReturnType<typeof fakeWorker>, idleMs: number) =>
  fetchList(w.server, w.compat, 'es-419', null, { fetch: w.fetch, idleMs })

describe('a language code in the list URL (fix round R1)', () => {
  it('is encoded: a `/` or `?` in it stays in its path segment', async () => {
    const urls: string[] = []
    const fetchSpy = (async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return new Response(JSON.stringify({ error: 'no packs for this language' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    await fetchList('https://w.test/v2/packs/', 'f2.0-test', 'a/b?c', null, { fetch: fetchSpy })
    expect(urls).toEqual(['https://w.test/v2/packs/f2.0-test/a%2Fb%3Fc'])
  })
})
