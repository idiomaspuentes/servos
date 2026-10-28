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

  it('returns the list when the sha256 of its bytes is its name', async () => {
    const { w, orig, sha } = await withOriginals()
    expect(await get(w, sha)).toEqual(orig)
    expect(w.calls[0].url).toBe(`${w.server}${w.compat}/originals/${sha}`)
  })

  it('returns null when the bytes are not the name', async () => {
    const { w, sha } = await withOriginals()
    const other = await w.setOriginals({
      schema: 2, language: 'originals', parts: [], resources: [], code: 'other',
    } as unknown as PartsList)
    w.originals.set(sha, w.originals.get(other.sha256)!)
    expect(await get(w, sha)).toBeNull()
  })

  it('returns null for a 404, HTML with a 200, a network error, and bytes that are not an originals list', async () => {
    const { w, sha } = await withOriginals()
    w.setAnswer('originals', ANSWERS.originalsNoEsta)
    expect(await get(w, sha)).toBeNull()
    w.setAnswer('originals', ANSWERS.html)
    expect(await get(w, sha)).toBeNull()
    w.setAnswer('originals', null)
    // Bytes whose sha256 does match their name, but which are not a list.
    const html = new TextEncoder().encode('<html></html>')
    const htmlSha = await sha256Hex(html)
    w.originals.set(htmlSha, html)
    expect(await get(w, htmlSha)).toBeNull()
    w.offline()
    expect(await get(w, sha)).toBeNull()
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
