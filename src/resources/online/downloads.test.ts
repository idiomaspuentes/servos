import { describe, expect, it } from 'vitest'
import { memoryByteStore, stagingFrom, type PartEntry } from '@bt-synergy/language-pack'
import { downloadParts, type Progress } from './downloads'
import { fetchPart } from './packsClient'
import { ANSWERS, fakeWorker } from './fakeWorker'

type Worker = ReturnType<typeof fakeWorker>

/** A worker serving `n` language parts and `o` originals parts, each with its own rows. */
async function setup(n: number, o = 0) {
  const w = fakeWorker()
  const lang: PartEntry[] = []
  const orig: PartEntry[] = []
  for (let i = 0; i < n; i++) {
    lang.push(await w.addPart({ kind: 'book', resource: 'a/b/tn', book: `b${i}` }, [row(`tn:b${i}`)]))
  }
  for (let i = 0; i < o; i++) {
    orig.push(await w.addPart({ kind: 'original', resource: 'o/u/hbo', book: `o${i}` }, [row(`hbo:o${i}`)]))
  }
  return { w, lang, orig, staging: stagingFrom(memoryByteStore()) }
}
const row = (key: string) => ({ layer: 'sot' as const, key, value: { x: key, pad: key.repeat(20) } })
const viaFake = (w: Worker) => (server: string, sha: string) => fetchPart(server, sha, { fetch: w.fetch })
const shaOfCall = (url: string) => url.slice(url.lastIndexOf('/') + 1)
const staged = async (staging: ReturnType<typeof stagingFrom>) => new Set((await staging.list()).map((s) => s.sha))

describe('downloadParts', () => {
  it('keeps at most 4 parts in flight, or `at` of them, and stages them all', async () => {
    const { w, lang, staging } = await setup(10)
    w.gate(() => new Promise((r) => setTimeout(r, 2)))
    const r = await downloadParts({ server: w.server, parts: lang, originals: new Set(), staging, fetchPart: viaFake(w) })
    expect(r).toEqual({ kind: 'listo' })
    expect(w.maxInFlight).toBe(4)
    expect(await staged(staging)).toEqual(new Set(lang.map((p) => p.sha256)))

    const two = await setup(6)
    two.w.gate(() => new Promise((r) => setTimeout(r, 2)))
    const r2 = await downloadParts({
      server: two.w.server, parts: two.lang, originals: new Set(), staging: two.staging, fetchPart: viaFake(two.w), at: 2,
    })
    expect(r2).toEqual({ kind: 'listo' })
    expect(two.w.maxInFlight).toBe(2)
  })

  it('fetches the originals parts first, wherever the plan lists them', async () => {
    const { w, lang, orig, staging } = await setup(5, 3)
    const r = await downloadParts({
      server: w.server,
      parts: [...lang, ...orig],
      originals: new Set(orig.map((p) => p.sha256)),
      staging,
      fetchPart: viaFake(w),
    })
    expect(r).toEqual({ kind: 'listo' })
    const order = w.calls.map((c) => shaOfCall(c.url))
    expect(new Set(order.slice(0, 3))).toEqual(new Set(orig.map((p) => p.sha256)))
    expect(order).toHaveLength(8)
  })

  it('does not fetch a part already staged, nor the same sha twice', async () => {
    const { w, lang, staging } = await setup(5)
    for (const p of lang.slice(0, 2)) await staging.put(p.sha256, w.parts.get(p.sha256)!)
    const r = await downloadParts({
      server: w.server, parts: [...lang, lang[4]], originals: new Set(), staging, fetchPart: viaFake(w),
    })
    expect(r).toEqual({ kind: 'listo' })
    expect(w.calls.map((c) => shaOfCall(c.url)).sort()).toEqual(lang.slice(2).map((p) => p.sha256).sort())
    expect(await staged(staging)).toEqual(new Set(lang.map((p) => p.sha256)))
  })

  it('after a cut in the middle, a second run fetches only the rest: no part is downloaded twice', async () => {
    const { w, lang, staging } = await setup(9)
    const input = { server: w.server, parts: lang, originals: new Set<string>(), staging, fetchPart: viaFake(w) }

    w.cutAfter(3)
    const first = await downloadParts(input)
    expect(first.kind).toBe('falla')
    const afterCut = await staged(staging)
    expect(afterCut.size).toBe(3)

    w.online()
    const seen: Progress[] = []
    const second = await downloadParts({ ...input, onProgress: (p) => seen.push(p) })
    expect(second).toEqual({ kind: 'listo' })
    expect(await staged(staging)).toEqual(new Set(lang.map((p) => p.sha256)))

    // Every part reached the Worker exactly once over both runs; the second run asked only for the six missing.
    const counts = new Map<string, number>()
    for (const c of w.calls) counts.set(shaOfCall(c.url), (counts.get(shaOfCall(c.url)) ?? 0) + 1)
    expect([...counts.values()].every((n) => n === 1)).toBe(true)
    expect(counts.size).toBe(9)
    // The second run starts from what the first one staged.
    expect(seen[0]).toMatchObject({ done: 3, total: 9 })
    expect(seen.at(-1)).toMatchObject({ done: 9, total: 9 })
  })

  it('a part the Worker no longer has stops the queue: listaOtraVez, and the parts in flight stay staged', async () => {
    const { w, lang, staging } = await setup(8)
    w.parts.delete(lang[0].sha256)
    const r = await downloadParts({ server: w.server, parts: lang, originals: new Set(), staging, fetchPart: viaFake(w) })
    expect(r).toEqual({ kind: 'listaOtraVez' })
    // The four started together; the three that came are staged, and none was started after the 404.
    expect(w.calls).toHaveLength(4)
    expect(await staged(staging)).toEqual(new Set(lang.slice(1, 4).map((p) => p.sha256)))
  })

  it('a 429 stops the queue with espera and the Worker’s wait', async () => {
    const { w, lang, staging } = await setup(6)
    w.setAnswer('part', ANSWERS.limite)
    const r = await downloadParts({ server: w.server, parts: lang, originals: new Set(), staging, fetchPart: viaFake(w) })
    expect(r).toEqual({ kind: 'espera', retryAfter: 30 })
    expect(w.calls).toHaveLength(4)
    expect((await staging.list()).length).toBe(0)
  })

  it('tries a failing part three times: two failures are forgiven, three are a falla', async () => {
    const ok = await setup(3)
    ok.w.setAnswer('part', ANSWERS.red, 2)
    const r = await downloadParts({
      server: ok.w.server, parts: ok.lang, originals: new Set(), staging: ok.staging, fetchPart: viaFake(ok.w), at: 1,
    })
    expect(r).toEqual({ kind: 'listo' })
    expect(ok.w.calls).toHaveLength(5)

    const bad = await setup(3)
    // Bytes that are not what their name says: the client says falla every time.
    bad.w.parts.set(bad.lang[0].sha256, new Uint8Array([1, 2, 3]))
    const r2 = await downloadParts({
      server: bad.w.server, parts: bad.lang, originals: new Set(), staging: bad.staging, fetchPart: viaFake(bad.w), at: 1,
    })
    expect(r2.kind).toBe('falla')
    expect(r2.kind === 'falla' && r2.message).toContain(bad.lang[0].sha256.slice(0, 12))
    expect(bad.w.calls).toHaveLength(3)
    expect((await bad.staging.list()).length).toBe(0)
  })

  it('counts progress in parts and bytes, already staged ones as done from the start, never going back', async () => {
    const { w, lang, staging } = await setup(5)
    await staging.put(lang[2].sha256, w.parts.get(lang[2].sha256)!)
    const seen: Progress[] = []
    const r = await downloadParts({
      server: w.server, parts: lang, originals: new Set(), staging, fetchPart: viaFake(w), onProgress: (p) => seen.push(p),
    })
    expect(r).toEqual({ kind: 'listo' })
    const bytesTotal = lang.reduce((s, p) => s + p.bytes, 0)
    expect(seen[0]).toEqual({ done: 1, total: 5, bytesDone: lang[2].bytes, bytesTotal })
    expect(seen.at(-1)).toEqual({ done: 5, total: 5, bytesDone: bytesTotal, bytesTotal })
    expect(seen).toHaveLength(5)
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i].done).toBeGreaterThan(seen[i - 1].done)
      expect(seen[i].bytesDone).toBeGreaterThan(seen[i - 1].bytesDone)
    }
  })

  it('an empty plan, or one all staged, is listo without asking the Worker', async () => {
    const { w, lang, staging } = await setup(2)
    for (const p of lang) await staging.put(p.sha256, w.parts.get(p.sha256)!)
    expect(await downloadParts({ server: w.server, parts: [], originals: new Set(), staging, fetchPart: viaFake(w) })).toEqual({
      kind: 'listo',
    })
    expect(await downloadParts({ server: w.server, parts: lang, originals: new Set(), staging, fetchPart: viaFake(w) })).toEqual({
      kind: 'listo',
    })
    expect(w.calls).toHaveLength(0)
  })
})
