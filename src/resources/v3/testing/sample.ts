// @ts-nocheck -- Test helper. It builds a signed format 3 sample with bt-synergy's own builders, which Servos does not
// declare (btSynergy.d.ts has only what the app calls); the client's `test/sample.ts` is Bun-only, so this is its small
// equivalent: es-419 Titus over the spec's test data, signed with a key made now.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUILDER, buildCatalog, buildCommon, buildLanguage, catalogView, encodeBasemap, keyId, publicKeyOf, signCatalog } from '@bt-synergy/language-pack-v3'
import { partsSource } from '@bt-synergy/language-pack-v3/node/partsSource'
import { btSynergyRoot } from '../../../../scripts/btSynergy'

export type Sample = {
  segments: Map<string, Uint8Array>
  langCatalog: Uint8Array
  commonCatalog: Uint8Array
  keyId: string
  publicKey: Uint8Array
  /** The complements the common catalog lists (the basemap, when asked for), by the hex of their sha256. */
  complements: Map<string, Uint8Array>
}

/** A small basemap: a square of land around Joppa with a lake in it, inside the box of the real one (degrees x 100). */
export const TEST_BASEMAP = {
  bbox: [800, 2200, 5200, 4300] as [number, number, number, number],
  paths: [
    { layer: 1 as const, points: [[3300, 3000], [3700, 3000], [3700, 3400], [3300, 3400]] as [number, number][] },
    { layer: 2 as const, points: [[3450, 3100], [3550, 3100], [3550, 3200]] as [number, number][] },
    { layer: 3 as const, points: [[3400, 3100], [3500, 3300]] as [number, number][] },
  ],
}

const ROOT = btSynergyRoot(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..'))
const DATA = join(ROOT, 'packages', 'language-pack-v3', 'spec', 'tests', 'data')
const aboutOf = (revision: number) => ({ format: '3.0', publisher: 'unfoldingWord', origin: 'published', revision, built: '2026-11-01T10:00:00Z', builder: BUILDER })

const memo = new Map<string, Promise<Sample>>()
/**
 * The sample as its catalogs' `revision` says (the same content, signed with a key made for each revision). With
 * `basemap` the common catalog also lists a `basemap` complement (`TEST_BASEMAP`) that the fake server serves.
 */
export function buildSample(revision = 1, o: { basemap?: boolean } = {}): Promise<Sample> {
  const key = `${revision}${o.basemap ? 'b' : ''}`
  let made = memo.get(key)
  if (!made) memo.set(key, (made = make(aboutOf(revision), o.basemap === true)))
  return made
}

async function make(about: ReturnType<typeof aboutOf>, withBasemap = false): Promise<Sample> {
  const parts = join(DATA, 'parts')
  const originals = join(DATA, 'originals', 'list.json')
  const source = (lang: string) => partsSource({ list: join(DATA, lang, 'list.json'), partsDir: parts, originals })
  const common = await buildCommon({ source: await source('en'), about, mapLang: 'en' })
  const complements = new Map<string, Uint8Array>()
  if (withBasemap) {
    // The common catalog again, listing the basemap: the sample's data has no maps sources to build it from.
    const bytes = encodeBasemap(TEST_BASEMAP)
    const id = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    const model = catalogView(common.catalog.seg)
    common.catalog = await buildCatalog({
      about: model.about,
      resources: model.resources,
      segments: common.segments,
      complements: [{ kind: 'basemap', id, size: bytes.length, media: 'application/cbor', version: '1' }],
    })
    complements.set(Array.from(id, (b) => b.toString(16).padStart(2, '0')).join(''), bytes)
  }
  const lang = await buildLanguage({
    source: await source('es-419'),
    lang: 'es-419',
    registry: {},
    about,
    requires: [['common', about.revision, common.catalog.id]],
  })
  const { privateKey } = await crypto.subtle.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify'])
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', privateKey))
  const publicKey = await publicKeyOf(pkcs8)
  const segments = new Map<string, Uint8Array>()
  for (const s of [...common.segments, ...lang.segments]) segments.set(s.id, s.bytes)
  return {
    segments,
    langCatalog: await signCatalog(lang.catalog.bytes, pkcs8),
    commonCatalog: await signCatalog(common.catalog.bytes, pkcs8),
    keyId: keyId(publicKey),
    publicKey,
    complements,
  }
}

/** A `fetch` that answers like the packs Worker (`spec/serving.md`) from the sample, and remembers what was asked. */
export function fakeFetch(sample: Sample): typeof fetch & { urls: string[] } {
  const urls: string[] = []
  const answer = (bytes: Uint8Array | undefined, what: string) =>
    bytes
      ? new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } })
      : new Response(JSON.stringify({ error: `${what} not found` }), { status: 404 })
  const fn = async (input: RequestInfo | URL) => {
    const url = String(input)
    urls.push(url)
    const path = new URL(url).pathname
    const seg = /^\/v3\/packs\/seg\/([0-9a-f]{64})$/.exec(path)
    if (seg) return answer(sample.segments.get(seg[1]), 'segment')
    const comp = /^\/v3\/packs\/complement\/([0-9a-f]{64})$/.exec(path)
    if (comp) return answer(sample.complements.get(comp[1]), 'complement')
    const cat = /^\/v3\/packs\/([^/]+)\/catalog$/.exec(path)
    if (cat?.[1] === 'common') return answer(sample.commonCatalog, 'catalog')
    if (cat?.[1] === 'es-419') return answer(sample.langCatalog, 'catalog')
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
  }
  return Object.assign(fn, { urls })
}

export const readKeyFile = (id: string) => readFileSync(join(ROOT, 'packages', 'language-pack-v3', 'keys', `${id}.pub`), 'utf8')

/** A file of the spec's test data (`es-419-tit.langpack.zip`, `originals-tit.langpack.zip`...). */
export const specData = (name: string): Uint8Array => new Uint8Array(readFileSync(join(DATA, name)))
