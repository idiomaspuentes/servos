/// <reference types="node" />
import 'fake-indexeddb/auto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { openPack } from './packs'
import type { ChapterPiece } from './reading'
import { chapterData, GREEK, HEBREW, sectionsOf, type BookSources } from './screenData'
import { openResourceStores } from './store'

const paragraph = (...verses: number[]): ChapterPiece => ({ kind: 'paragraph', verses: verses.map((verse) => ({ verse, text: '' })) })

describe('las secciones de un capítulo', () => {
  it('con una tabla, cada sección empieza donde ella dice', () => {
    expect(sectionsOf([1, 2, 3, 4, 5, 6], [1, 4], [])).toEqual([
      [1, 2, 3],
      [4, 5, 6],
    ])
  })

  it('sin tabla, cada párrafo del texto puente es una sección, y un versículo partido entre dos párrafos va en el primero', () => {
    expect(sectionsOf([1, 2, 3, 4, 5], undefined, [paragraph(1, 2), { kind: 'heading', text: 'Oración' }, paragraph(2, 3, 4), paragraph(5)])).toEqual([[1, 2], [3, 4], [5]])
  })

  it('una tabla de otra versificación no deja versículos fuera, ni secciones vacías', () => {
    expect(sectionsOf([0, 1, 2, 3], [1, 3, 9], [])).toEqual([
      [0, 1, 2],
      [3],
    ])
  })

  it('sin tabla ni párrafos, el capítulo entero es una sección', () => {
    expect(sectionsOf([1, 2], undefined, [])).toEqual([[1, 2]])
  })
})

/**
 * The real packs, when there are some (`SERVOS_PAQUETES=<folder>`, written by bt-synergy's prepare-language CLI with
 * `--lang es-419 --books all`): a book with every help, and one whose language has only its literal text.
 */
const folder = process.env.SERVOS_PAQUETES
const ORG = 'es-419_gl/es-419'
const es419 = (original: BookSources['original']): BookSources => ({
  language: 'es-419',
  owner: ORG,
  literal: `${ORG}/glt`,
  simple: `${ORG}/gst`,
  notes: `${ORG}/tn`,
  questions: `${ORG}/tq`,
  wordLinks: `${ORG}/twl`,
  words: `${ORG}/tw`,
  academy: `${ORG}/ta`,
  original,
})

describe.skipIf(!folder)('un capítulo desde los paquetes reales', () => {
  const stores = openResourceStores({ cache: 'screen-cache', catalog: 'screen-catalog' })
  // The suite's body still runs when it is skipped: nothing is opened without the packs' folder.
  const opened = (async () => {
    if (!folder) return
    for (const file of ['originals', 'es-419']) await openPack(stores, readFileSync(join(folder!, `${file}.langpack.zip`)))
  })()

  it('Rut, con todo: los dos textos puente, el hebreo, notas, preguntas y palabras en su lugar', async () => {
    await opened
    const data = await chapterData(stores, es419(HEBREW), 'rut', 1)
    expect(data.texts.map((t) => t.abbreviation)).toEqual(['TPL', 'TPS', 'Hebreo'])
    expect(data.verses.length).toBe(22)
    expect(data.verses.some((v) => v.notes.length && v.notes[0].places.TPL.length)).toBe(true)
    expect(data.verses.some((v) => v.questions.length)).toBe(true)
    expect(data.verses.some((v) => v.words.length)).toBe(true)
    expect(data.sections.flat()).toEqual(data.verses.map((v) => v.verse))
  }, 600_000)

  it('Rut 1:8: el qere de la nota no es una palabra del versículo, que termina en su última palabra, y cada palabra tiene su léxico', async () => {
    await opened
    const data = await chapterData(stores, es419(HEBREW), 'rut', 1)
    const hebrew = data.texts.find((t) => t.original)!
    // Compared by their letters: the points and accents come in more than one order.
    const letters = (w: string) => w.replace(/[֑-ׇ⁠]/g, '')
    const line = hebrew.lines[8].flatMap((l) => l.pieces.filter((p) => p.word !== undefined).map((p) => letters(p.text)))
    expect(line.at(-1)).toBe('ועמדי')
    expect(line).toContain('יעשה')
    expect(line).not.toContain('יעש')
    // MACULA counts the qere: its word 11, after the ketiv (10), is in a note.
    expect(hebrew.inNotes).toEqual({ 8: [11] })
    // The lemma and Strong number of every word, which the lexicon and the glossary go by.
    expect(hebrew.words?.length).toBe(Object.values(hebrew.lines).flat().flatMap((l) => l.pieces).filter((p) => p.word !== undefined).length)
  }, 600_000)

  it('Rut 4:5: el ketiv קניתי y «adquieres», alineado a su qere קָנִ֔יתָה, se encuentran uno al otro', async () => {
    await opened
    const data = await chapterData(stores, es419(HEBREW), 'rut', 4)
    const hebrew = data.texts.find((t) => t.original)!
    const tpl = data.texts.find((t) => t.abbreviation === 'TPL')!
    const placeOf = (text: typeof tpl, word: string) =>
      text.lines[5].flatMap((l) => l.pieces).find((p) => p.word !== undefined && p.text.replace(/[֑-ׇ⁠]/g, '') === word)?.word
    const ketiv = placeOf(hebrew, 'קניתי')
    const adquieres = placeOf(tpl, 'adquieres')
    expect(ketiv).toBeDefined()
    expect(adquieres).toBeDefined()
    expect(tpl.toOriginal?.[adquieres!]).toEqual([ketiv])
  }, 600_000)

  it('Ester, de la que el equipo solo publicó el TPL: abre igual, con el TPL y el hebreo, sin ayudas', async () => {
    await opened
    const data = await chapterData(stores, es419(HEBREW), 'est', 1)
    expect(data.texts.map((t) => t.abbreviation)).toEqual(['TPL', 'Hebreo'])
    expect(data.verses.length).toBeGreaterThan(0)
    expect(data.verses.every((v) => !v.notes.length && !v.questions.length && !v.words.length)).toBe(true)
  }, 600_000)

  it('Tito, con el griego', async () => {
    await opened
    const data = await chapterData(stores, es419(GREEK), 'tit', 1)
    expect(data.texts.at(-1)?.abbreviation).toBe('Griego')
    expect(data.book.name).not.toBe('TIT')
  }, 600_000)
})

describe('la tabla de secciones de toda la Biblia', () => {
  it('trae las de Tito y Jonás tal como estaban, y las de cualquier otro libro', async () => {
    const { sectionStartsOf } = await import('./sections')
    expect(sectionStartsOf('tit', 1)).toEqual([1, 4, 6, 8, 10, 12, 15])
    expect(sectionStartsOf('JON', 2)).toEqual([1, 3, 5, 7, 9])
    expect(sectionStartsOf('rut', 1)?.[0]).toBe(1)
    expect(sectionStartsOf('psa', 119)?.length).toBeGreaterThan(10)
    expect(sectionStartsOf('rut', 9)).toBeUndefined()
  })
})
