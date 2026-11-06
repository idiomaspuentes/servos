// @ts-nocheck -- Test helper. It builds a signed format 3 sample with bt-synergy's own builders, which Servos does not
// declare (btSynergy.d.ts has only what the app calls); the client's `test/sample.ts` is Bun-only, so this is its small
// equivalent: es-419 Titus over the spec's test data, signed with a key made now.
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { BUILDER, buildCommon, buildLanguage, keyId, publicKeyOf, signCatalog } from '@bt-synergy/language-pack-v3'
import { partsSource } from '@bt-synergy/language-pack-v3/node/partsSource'
import { btSynergyRoot } from '../../../scripts/btSynergy'

export type Sample = {
  segments: Map<string, Uint8Array>
  langCatalog: Uint8Array
  commonCatalog: Uint8Array
  keyId: string
  publicKey: Uint8Array
}

const ROOT = btSynergyRoot(join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..'))
const DATA = join(ROOT, 'packages', 'language-pack-v3', 'spec', 'tests', 'data')
const about = { format: '3.0', publisher: 'unfoldingWord', origin: 'published', revision: 1, built: '2026-11-01T10:00:00Z', builder: BUILDER }

let memo: Promise<Sample> | undefined
export function buildSample(): Promise<Sample> {
  return (memo ??= make())
}

async function make(): Promise<Sample> {
  const parts = join(DATA, 'parts')
  const originals = join(DATA, 'originals', 'list.json')
  const source = (lang: string) => partsSource({ list: join(DATA, lang, 'list.json'), partsDir: parts, originals })
  const common = await buildCommon({ source: await source('en'), about, mapLang: 'en' })
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
    const cat = /^\/v3\/packs\/([^/]+)\/catalog$/.exec(path)
    if (cat?.[1] === 'common') return answer(sample.commonCatalog, 'catalog')
    if (cat?.[1] === 'es-419') return answer(sample.langCatalog, 'catalog')
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
  }
  return Object.assign(fn, { urls })
}

export const readKeyFile = (id: string) => readFileSync(join(ROOT, 'packages', 'language-pack-v3', 'keys', `${id}.pub`), 'utf8')
