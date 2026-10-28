import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import {
  PARTS_FORMAT_VERSION,
  applyParts,
  compatKeyOf,
  packTargetFrom,
  planParts,
  sha256Hex,
  writePart,
  type PartEntry,
  type PartsList,
} from '@bt-synergy/language-pack'
import { RESOURCE_VERSIONS, openPartsStaging, openResourceStores, readPartsRegister } from '../store'

const TN = 'es-419_gl/es-419/tn'
const META = {
  resourceKey: TN, owner: 'es-419_gl', language: 'es-419', resourceId: 'tn', type: 'notes',
  subject: 'TSV Translation Notes', title: 'Notas', release: { tag_name: 'v66', published_at: '2024-07-17T20:13:08Z' },
}

let n = 0
const unique = (what: string) => `${what}-${Date.now()}-${n++}`

/** A one-part list: the notes of Ruth, as the Worker would name them. */
async function tinyList() {
  const part = await writePart([
    { layer: 'sot', key: `tn:${TN}:rut`, value: { content: { book: 'rut' } } },
    { layer: 'sot', key: `tn:${TN}:rut:1`, value: { content: { notes: [] } } },
  ])
  const entry: PartEntry = {
    sha256: part.sha256, bytes: part.bytes.byteLength, rows: part.rows, kind: 'book', resource: TN, book: 'rut',
    fingerprint: 'f'.repeat(64), layers: ['sot'],
  }
  const list: PartsList = {
    schema: 2,
    language: 'es-419',
    compat: compatKeyOf(PARTS_FORMAT_VERSION, RESOURCE_VERSIONS),
    code: 'c+0',
    versions: RESOURCE_VERSIONS,
    resources: [{ key: TN, stamp: 'v66#2024-07-17T20:13:08Z', role: 'language', subject: META.subject, title: META.title, metadata: META }],
    parts: [entry],
  }
  return { list, entry, bytes: part.bytes }
}

describe('the parts importer, reached from Servos', () => {
  it('the staging keeps verified parts and the register reads back what applyParts wrote', async () => {
    const { list, entry, bytes } = await tinyList()
    const staging = openPartsStaging(unique('partes'))

    // Staging refuses bytes that are not what their name says, and keeps the ones that are.
    await expect(staging.put('0'.repeat(64), bytes)).rejects.toThrow()
    await staging.put(entry.sha256, bytes)
    expect(await staging.has(entry.sha256)).toBe(true)
    expect(await sha256Hex((await staging.get(entry.sha256))!)).toBe(entry.sha256)
    expect((await staging.list()).map((s) => s.sha)).toEqual([entry.sha256])

    const stores = openResourceStores({ cache: unique('recursos'), catalog: unique('catalogo') })
    const before = await readPartsRegister(stores)
    expect(before.size).toBe(0)

    const chosen = ['book rut']
    const plan = planParts({ list, register: before, chosen })
    expect(plan.download.map((p) => p.sha256)).toEqual([entry.sha256])

    const result = await applyParts({
      target: packTargetFrom({ cache: stores.cache, catalog: stores.catalog }),
      staging, plan, list, register: before, chosen, versions: RESOURCE_VERSIONS,
    })
    expect(result.failed).toEqual([])
    expect(result.applied).toEqual(['book rut'])

    const after = await readPartsRegister(stores)
    expect([...after.values()].map((r) => r.sha256)).toEqual([entry.sha256])
    expect([...after.values()][0].list).toBe('es-419')
    // The rows are in the store, and a second plan has nothing left to download.
    expect([...(await stores.cache.hasRawKeys([`tn:${TN}:rut:1`]))]).toEqual([`tn:${TN}:rut:1`])
    expect(planParts({ list, register: after, chosen }).download).toEqual([])
  })
})
