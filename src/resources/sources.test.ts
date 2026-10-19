/// <reference types="node" />
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openPack } from './packs'
import type { ResourceKind } from './reading'
import { GREEK, HEBREW } from './screenData'
import { availability, languagesOnDevice, originalOf, sourcesFor, type DeviceIndex, type ResourceHere } from './sources'

const resource = (key: string, kind: ResourceKind, books: string[], inRelease = books, articles = false, subject = ''): ResourceHere => {
  const [owner, language, resourceId] = key.split('/')
  return { key, owner, language, resourceId, kind, subject, title: key, stamp: 'v1', books, inRelease, articles, stale: false, interrupted: false }
}

/** es-419 as its packs leave it: Ruth with everything, Esther with its literal text only, Genesis published elsewhere. */
const index: DeviceIndex = {
  resources: [
    resource('unfoldingWord/hbo/uhb', 'original', ['rut', 'est', 'jon']),
    resource('unfoldingWord/el-x-koine/ugnt', 'original', ['tit']),
    resource('es-419_gl/es-419/glt', 'scripture', ['rut', 'est', 'jon', 'tit'], ['gen', 'rut', 'est', 'jon', 'tit']),
    resource('es-419_gl/es-419/gst', 'scripture', ['rut', 'jon', 'tit']),
    resource('es-419_gl/es-419/tn', 'notes', ['rut', 'jon', 'tit'], ['rut', 'jon', 'tit', 'est']),
    resource('es-419_gl/es-419/tq', 'questions', ['rut', 'jon', 'tit']),
    resource('es-419_gl/es-419/twl', 'word-links', ['rut', 'jon', 'tit']),
    resource('es-419_obt/es-419/tw', 'words', [], [], true),
    resource('es-419_gl/es-419/tw', 'words', [], [], true),
    resource('es-419_gl/es-419/ta', 'academy', [], [], true),
    resource('es-419_gl/es-419/uhl', 'other', [], [], true, 'Hebrew Lexicon'),
    resource('Biblica/hbo/macula', 'other', [], ['rut', 'est', 'jon'], true, 'Original Language Syntax'),
  ],
}

describe('qué tiene cada idioma en este teléfono', () => {
  it('los idiomas son los de los textos puente, no los de los originales', () => {
    expect(languagesOnDevice(index)).toEqual(['es-419'])
  })

  it('un libro se lee de sus recursos: los del dueño del TPL primero, y las palabras del dueño de sus enlaces', () => {
    expect(sourcesFor(index, 'es-419')).toEqual({
      language: 'es-419',
      owner: 'es-419_gl/es-419',
      literal: 'es-419_gl/es-419/glt',
      simple: 'es-419_gl/es-419/gst',
      notes: 'es-419_gl/es-419/tn',
      questions: 'es-419_gl/es-419/tq',
      wordLinks: 'es-419_gl/es-419/twl',
      words: 'es-419_gl/es-419/tw',
      academy: 'es-419_gl/es-419/ta',
    })
    expect(sourcesFor(index, 'qu')).toBeNull()
  })

  it('el original va por testamento', () => {
    expect(originalOf('rut')).toBe(HEBREW)
    expect(originalOf('mal')).toBe(HEBREW)
    expect(originalOf('MAT')).toBe(GREEK)
    expect(originalOf('tit')).toBe(GREEK)
  })

  it('Rut se abre con todo', () => {
    const rut = availability(index, 'es-419', 'rut')
    expect(rut.here).toBe(true)
    expect(rut.notOnDevice).toEqual([])
    expect(rut.notInLanguage).toEqual([])
    expect(rut.sources?.original).toBe(HEBREW)
  })

  it('el léxico va por el original del libro, en su idioma; MACULA, por libro', () => {
    expect(availability(index, 'es-419', 'rut').sources).toMatchObject({ lexicon: 'es-419_gl/es-419/uhl', macula: 'Biblica/hbo/macula' })
    // Titus: the Greek lexicon and MACULA's Greek are not on this device; it opens all the same.
    const tit = availability(index, 'es-419', 'tit')
    expect(tit.here).toBe(true)
    expect(tit.extras).toEqual({ lexicon: false, macula: false })
  })

  it('Ester se abre con su TPL; sus notas existen pero no están aquí, y lo demás el idioma no lo publicó', () => {
    const est = availability(index, 'es-419', 'est')
    expect(est.here).toBe(true)
    expect(est.notOnDevice).toEqual(['notes'])
    expect(est.notInLanguage).toEqual(['simple', 'questions', 'wordLinks'])
  })

  it('Génesis está publicado pero no en este teléfono, y le falta además el hebreo; Marcos no existe en el idioma', () => {
    const gen = availability(index, 'es-419', 'gen')
    expect(gen.here).toBe(false)
    expect(gen.notOnDevice).toEqual(['literal'])
    expect(gen.needsOriginal).toBe(true)
    expect(gen.sources).toBeNull()
    expect(availability(index, 'es-419', 'mrk').notInLanguage).toContain('literal')
  })

  it('un texto hecho para una versión anterior de la app está, pero no se abre: se pide su paquete de nuevo', () => {
    const old = (key: string) => ({ ...index, resources: index.resources.map((r) => (r.key === key ? { ...r, stale: true } : r)) })
    const byText = availability(old('es-419_gl/es-419/glt'), 'es-419', 'rut')
    expect(byText).toMatchObject({ here: false, stale: true, sources: null, notOnDevice: [] })
    const byOriginal = availability(old('unfoldingWord/hbo/uhb'), 'es-419', 'rut')
    expect(byOriginal).toMatchObject({ here: false, stale: true, needsOriginal: false })
    // The Greek is not Ruth's original: Ruth opens.
    expect(availability(old('unfoldingWord/el-x-koine/ugnt'), 'es-419', 'rut')).toMatchObject({ here: true, stale: false })
    expect(availability(index, 'es-419', 'rut').stale).toBe(false)
  })

  it('un libro cuyo paquete no se terminó de abrir no se abre, y se dice: hay que recibirlo de nuevo', () => {
    const cut = { ...index, resources: index.resources.map((r) => (r.key === 'es-419_gl/es-419/tn' ? { ...r, interrupted: true } : r)) }
    expect(availability(cut, 'es-419', 'rut')).toMatchObject({ here: false, interrupted: true })
    expect(availability(index, 'es-419', 'rut').interrupted).toBe(false)
    // The language's pack cut halfway, even in a resource cut before its first article (a lexicon): every book of the
    // language says so. The Greek cut halfway: only the New Testament's.
    const lexicon = { ...index, resources: index.resources.map((r) => (r.key === 'es-419_gl/es-419/uhl' ? { ...r, interrupted: true, articles: false } : r)) }
    expect(availability(lexicon, 'es-419', 'rut').interrupted).toBe(true)
    expect(availability(lexicon, 'es-419', 'tit').interrupted).toBe(true)
    const greek = { ...index, resources: index.resources.map((r) => (r.key === 'unfoldingWord/el-x-koine/ugnt' ? { ...r, interrupted: true } : r)) }
    expect(availability(greek, 'es-419', 'tit').interrupted).toBe(true)
    expect(availability(greek, 'es-419', 'rut').interrupted).toBe(false)
  })
})

/** With the real packs (`SERVOS_PAQUETES=<folder>`): the index read from the device itself, from keys alone. */
const folder = process.env.SERVOS_PAQUETES
describe.skipIf(!folder)('el índice desde los paquetes reales', () => {
  it('es-419 y los originales: los libros de cada recurso, sin leer sus filas', async () => {
    const { deviceIndex } = await import('./sources')
    const { openResourceStores } = await import('./store')
    const stores = openResourceStores({ cache: 'idx-cache', catalog: 'idx-catalog' })
    for (const file of ['originals', 'es-419']) await openPack(stores, readFileSync(join(folder!, `${file}.langpack.zip`)))
    const real = await deviceIndex(stores)
    const glt = real.resources.find((r) => r.key === 'es-419_gl/es-419/glt')!
    // Packs made with this version of the code (bt-synergy's CLI at the same commit): nothing to receive again.
    expect(real.resources.filter((r) => r.stale).map((r) => r.key)).toEqual([])
    expect(glt.books).toEqual(expect.arrayContaining(['rut', 'est', 'jon', 'tit', '3jn']))
    expect(availability(real, 'es-419', 'rut').here).toBe(true)
    expect(availability(real, 'es-419', 'est').notInLanguage).toContain('simple')
    expect(availability(real, 'es-419', 'tit').sources?.original).toBe(GREEK)
    // With packs made with the lexicons and MACULA (bt-synergy's CLI with --macula): Ruth's Hebrew explained, Titus's Greek.
    const rut = availability(real, 'es-419', 'rut')
    if (!rut.extras.lexicon) return
    const { readLexiconEntry, readMacula } = await import('./companions')
    expect(rut.extras).toEqual({ lexicon: true, macula: true })
    const entry = await readLexiconEntry(stores, rut.sources!.lexicon!, 7121)
    expect(entry?.entries.length).toBeGreaterThan(0)
    const macula = await readMacula(stores, rut.sources!.macula!, 'rut')
    expect(macula.trees).not.toBeNull()
    expect(macula.referents).not.toBeNull()
    expect(availability(real, 'es-419', 'tit').sources).toMatchObject({ lexicon: 'es-419_gl/es-419/ugl', macula: 'Biblica/el-x-koine/macula' })
  }, 600_000)
})
