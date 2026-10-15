import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { buildLanguagePack, type PackSource } from '@bt-synergy/language-pack'
import { resourceContentStamp } from '@bt-synergy/resource-catalog'
import { USJ_PROCESSING_VERSION } from '@bt-synergy/usj-processor'
import { HELPS_ALIGN_VERSION } from '@bt-synergy/resource-pipeline/helps/helpsAlignCache'
import { NOTES_PREPARE_VERSION } from '@bt-synergy/resource-pipeline/notes/notesPreparer'
import { SCRIPTURE_PREPARE_VERSION } from '@bt-synergy/resource-pipeline/scripture/scripturePreparer'
import { describePack, openPack } from './packs'
import { booksOfText, notesOfVerse, readChapter, referenceCovers, resourcesOnDevice, textQuoteOf } from './reading'
import { RESOURCE_VERSIONS, openResourceStores } from './store'

const GLT = 'es-419_gl/es-419/glt'
const TN = 'es-419_gl/es-419/tn'
const UGNT = 'unfoldingWord/el-x-koine/ugnt'

const META: Record<string, Record<string, unknown>> = {
  [GLT]: {
    resourceKey: GLT, owner: 'es-419_gl', language: 'es-419', resourceId: 'glt', type: 'scripture',
    subject: 'Aligned Bible', title: 'Texto Puente Literal', release: { tag_name: 'v42', published_at: '2026-08-11T12:22:03Z' },
  },
  [TN]: {
    resourceKey: TN, owner: 'es-419_gl', language: 'es-419', resourceId: 'tn', type: 'notes',
    subject: 'TSV Translation Notes', title: 'Notas', release: { tag_name: 'v66', published_at: '2024-07-17T20:13:08Z' },
  },
}
const stamp = (key: string) => resourceContentStamp(META[key])
const envelope = (content: unknown, version: number, extra: Record<string, unknown> = {}) => ({ content, timestamp: 1, version, ...extra })
const receipt = (key: string, schema: string) => ({
  key: `resource:${key}`,
  entry: { content: {}, metadata: { downloadComplete: true, releaseStamp: stamp(key), ingestSchema: schema } },
})

/** What tc-study's pipeline leaves for Titus 1 of a text and its notes. */
const ROWS = [
  receipt(GLT, `usj:${USJ_PROCESSING_VERSION}`),
  { key: `scripture-usj:${GLT}:tit:1`, entry: { content: {} } },
  {
    // The book's header, as tc-study keeps it: `\h` left in English, `	oc2` translated.
    key: `scripture-usj:${GLT}:tit:0`,
    entry: { content: { usj: { content: [{ type: 'para', marker: 'h', content: ['Titus'] }, { type: 'para', marker: 'toc2', content: ['Tito'] }] } } },
  },
  {
    key: `prepared:scripture:${GLT}:tit:nav`,
    entry: envelope({ version: SCRIPTURE_PREPARE_VERSION, bookId: 'tit', bookName: 'TIT', chapters: [{ number: 3, verseCount: 15 }] }, SCRIPTURE_PREPARE_VERSION),
  },
  {
    key: `prepared:scripture:${GLT}:tit:1:light`,
    entry: envelope(
      {
        version: SCRIPTURE_PREPARE_VERSION,
        unit: 1,
        blocks: [
          { marker: 's1', role: 'heading', indentLevel: 0, chapterNumber: 1, verseNumbers: [], inline: [{ kind: 'heading', text: 'Saludo ' }] },
          {
            marker: 'p', role: 'paragraph', indentLevel: 0, chapterNumber: 1, verseNumbers: [1, 2],
            inline: [
              { kind: 'verse', chapterNumber: 1, verseNumber: 1 },
              { kind: 'text', text: 'Pablo, siervo de Dios' },
              { kind: 'text', text: '  y apóstol,' },
              { kind: 'verse', chapterNumber: 1, verseNumber: 2 },
              { kind: 'text', text: ' en la esperanza de la vida eterna.' },
            ],
          },
        ],
      },
      SCRIPTURE_PREPARE_VERSION
    ),
  },
  receipt(TN, 'helps:1'),
  { key: `tn:${TN}:tit:1`, entry: { content: {} } },
  {
    key: `prepared:notes:${TN}:tit:1:light`,
    entry: envelope(
      {
        version: NOTES_PREPARE_VERSION,
        unit: 1,
        notes: [
          { id: 'intro', reference: '1:intro', quote: '', body: '', note: 'Introducción', supportReference: '', tags: '', occurrence: '', isIntro: true },
          { id: 'abcd', reference: '1:1', quote: 'δοῦλος Θεοῦ', body: '', note: 'Pablo se llama **siervo**.', supportReference: 'rc://*/ta/man/translate/figs-metaphor', tags: '', occurrence: '1' },
          { id: 'efgh', reference: '1:1-2', quote: 'κατὰ πίστιν', body: '', note: 'Para la fe.', supportReference: '', tags: '', occurrence: '1' },
          { id: 'ijkl', reference: '1:3', quote: 'ἐφανέρωσεν', body: '', note: 'Reveló.', supportReference: '', tags: '', occurrence: '1' },
        ],
      },
      NOTES_PREPARE_VERSION
    ),
  },
  {
    // Built long ago: its cache lifetime is over, but it is still right for these releases.
    key: `helps-align:${TN}@${stamp(TN)}:${UGNT}@v0.34#2023-09-27T02_19_31Z+${USJ_PROCESSING_VERSION}:${GLT}@${stamp(GLT)}+${SCRIPTURE_PREPARE_VERSION}:tit:1`,
    entry: envelope({ abcd: { p: [2, 3, 4], m: 1, t: ['siervo', 'de', 'Dios'] }, efgh: { p: [], m: 0 } }, HELPS_ALIGN_VERSION, {
      expiresAt: '2026-01-01T00:00:00.000Z',
    }),
  },
]

const source: PackSource = {
  rowsByPrefix: async (prefix) => ROWS.filter((r) => r.key.startsWith(prefix)),
  catalogRow: async (key) => META[key] ?? null,
  catalogRows: async () => Object.values(META),
}

async function deviceWithPack() {
  const { bytes } = await buildLanguagePack({ source, language: 'es-419', versions: RESOURCE_VERSIONS })
  const stores = openResourceStores({ cache: `prueba-${crypto.randomUUID()}`, catalog: `prueba-cat-${crypto.randomUUID()}` })
  const result = await openPack(stores, bytes)
  return { stores, bytes, result }
}

describe('abrir un paquete de recursos', () => {
  it('dice qué trae antes de abrirlo', async () => {
    const { bytes } = await buildLanguagePack({ source, language: 'es-419', versions: RESOURCE_VERSIONS })
    const summary = await describePack(bytes)
    expect(summary.kind).toBe('language')
    expect(summary.resources.map((r) => r.title).sort()).toEqual(['Notas', 'Texto Puente Literal'])
    expect(summary.needs).toEqual([{ key: UGNT, stamp: 'v0.34#2023-09-27T02_19_31Z' }])
  })

  it('después de abrirlo, el aparato sabe qué recursos y qué libros tiene', async () => {
    const { stores, result } = await deviceWithPack()
    expect(result.skippedResources).toEqual([])
    const resources = await resourcesOnDevice(stores)
    expect(resources.map((r) => [r.key, r.kind, r.books])).toEqual([
      [GLT, 'scripture', ['tit']],
      [TN, 'notes', ['tit']],
    ])
    // The name comes from the text's 	oc2, the chapters from the prepared chapters: tc-study's table keeps only the last.
    expect(await booksOfText(stores, GLT)).toEqual([{ book: 'tit', name: 'Tito', chapters: [{ number: 1, verseCount: 2 }] }])
  })
})

describe('leer sin internet', () => {
  it('lee un capítulo como títulos y párrafos de versículos', async () => {
    const { stores } = await deviceWithPack()
    expect(await readChapter(stores, GLT, 'TIT', 1)).toEqual([
      { kind: 'heading', text: 'Saludo' },
      {
        kind: 'paragraph',
        verses: [
          { verse: 1, text: 'Pablo, siervo de Dios y apóstol,' },
          { verse: 2, text: 'en la esperanza de la vida eterna.' },
        ],
      },
    ])
    expect(await readChapter(stores, GLT, 'tit', 2)).toBeNull()
  })

  it('las notas de un versículo traen sus palabras en el texto, aunque la fila ya haya vencido en la caché', async () => {
    const { stores } = await deviceWithPack()
    const notes = await notesOfVerse(stores, { notesKey: TN, textKey: GLT, book: 'tit', chapter: 1, verse: 1 })
    expect(notes.map((n) => [n.id, n.textQuote])).toEqual([
      ['abcd', 'siervo de Dios'],
      ['efgh', null],
    ])
    expect(notes[0].supportReference).toBe('rc://*/ta/man/translate/figs-metaphor')
    const verse2 = await notesOfVerse(stores, { notesKey: TN, textKey: GLT, book: 'tit', chapter: 1, verse: 2 })
    expect(verse2.map((n) => n.id)).toEqual(['efgh'])
  })

  it('las palabras de una cita salen en el orden del texto, con «…» donde hay palabras en medio', () => {
    expect(textQuoteOf({ p: [12, 10, 11, 13], m: 1, t: ['de', 'que', 'es', 'acuerdo'] })).toBe('que es de acuerdo')
    expect(textQuoteOf({ p: [20, 23, 24, 26], m: 1, t: ['de', 'que', 'es', 'acuerdo'] })).toBe('de … que es … acuerdo')
    expect(textQuoteOf({ p: [], m: 0 })).toBeNull()
    expect(textQuoteOf({ p: [3], m: 2, t: ['a', 'b'] })).toBe('a b')
  })

  it('una referencia cubre los versículos de su rango y nada más', () => {
    expect(referenceCovers('1:3', 1, 3)).toBe(true)
    expect(referenceCovers('1:3-5', 1, 5)).toBe(true)
    expect(referenceCovers('1:3-5', 1, 6)).toBe(false)
    expect(referenceCovers('2:3', 1, 3)).toBe(false)
    expect(referenceCovers('1:intro', 1, 1)).toBe(false)
  })
})
