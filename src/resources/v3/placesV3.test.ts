import { describe, expect, it, vi } from 'vitest'
import type { PackReader, PlaceAt, PlaceData } from '@bt-synergy/language-pack-client'

// `placesOf`, `passagePlaces` and `placeQuery` read an `xtopics` core; here they answer from a table.
const world = vi.hoisted(() => ({
  verse: [] as unknown[] | null,
  chapter: [] as unknown[] | null,
  data: {} as Record<string, unknown>,
}))
vi.mock('@bt-synergy/language-pack-client', async (original) => ({
  ...(await original<typeof import('@bt-synergy/language-pack-client')>()),
  placesOf: async () => ({ data: world.verse }),
  passagePlaces: async () => ({ data: world.chapter }),
  placeQuery: async (_: unknown, id: string) => ({ data: world.data[id] ?? null }),
}))

import { bookPlaces, bookRangeV3, chapterPlaces, citeOfVerse, inBasemap, mapFrame, mapPoints, neighbours, placeOfWord, sheetBounds, verseIdV3, type Bbox } from './placesV3'

const reader = {} as PackReader
/** The basemap of the common catalog: from 8 to 52 east, from 22 to 43 north (degrees x 100). */
const bbox: Bbox = [800, 2200, 5200, 4300]

const at = (id: string, name: string, lat: number | undefined, lon: number | undefined, sure: 0 | 1 | 2 | 3 = 3, form: PlaceAt['form'] = 1): PlaceAt => ({
  id,
  name,
  ...(lat === undefined ? {} : { lat, lon }),
  sure,
  form,
  verse: 32001003,
})
const joppa = at('lug:joppa', 'Jope', 32.05, 34.75)
const nineveh = at('lug:nineveh', 'Nínive', 36.36, 43.15)
const article = { kind: 'tw' as const, path: 'bible/names/joppa' }

function teach(place: PlaceAt, tw: string[], sources: string[] = ['openbible']) {
  world.data[place.id] = { ...place, tw, verses: 3, born: [], died: [], events: [], sources } satisfies PlaceData
}

describe('verseIdV3', () => {
  it('is book × 1,000,000 + chapter × 1,000 + verse', () => {
    expect(verseIdV3('jon', 1, 3)).toBe(32001003)
    expect(verseIdV3('gen', 1, 1)).toBe(1001001)
  })
})

describe('inBasemap', () => {
  it('is the box in degrees x 100', () => {
    expect(inBasemap({ lat: 32, lon: 35 }, bbox)).toBe(true)
    expect(inBasemap({ lat: 40, lon: 0 }, bbox)).toBe(false) // Tartessos, west of the box
    expect(inBasemap({ lat: 50, lon: 35 }, bbox)).toBe(false)
  })
})

describe('placeOfWord', () => {
  const ask = () => placeOfWord(reader, article, 32001003, bbox)

  it('is null when the verse names no place, or xtopics is not installed', async () => {
    world.verse = []
    expect(await ask()).toBeNull()
    world.verse = null
    expect(await ask()).toBeNull()
  })

  it('is the place whose articles include the touched one', async () => {
    world.verse = [nineveh, joppa]
    world.data = {}
    teach(joppa, ['tw:names/joppa'], ['openbible', 'theographic'])
    teach(nineveh, ['tw:names/nineveh'])
    const found = await ask()
    expect(found?.place.id).toBe('lug:joppa')
    expect(found?.sources).toEqual(['openbible', 'theographic'])
  })

  it('is null when no place of the verse has that article', async () => {
    world.verse = [nineveh]
    world.data = {}
    teach(nineveh, ['tw:names/nineveh'])
    expect(await ask()).toBeNull()
  })

  it('takes the surest of several, and the first when they tie', async () => {
    const a = at('lug:a', 'A', 32, 35, 2)
    const b = at('lug:b', 'B', 32.1, 35.1, 3)
    const c = at('lug:c', 'C', 32.2, 35.2, 3)
    world.verse = [a, b, c]
    world.data = {}
    for (const p of [a, b, c]) teach(p, ['tw:names/joppa'])
    expect((await ask())?.place.id).toBe('lug:b')
  })

  it('leaves out places with no point and places outside the basemap', async () => {
    const none = at('lug:none', 'Sin punto', undefined, undefined, 0)
    const tartessos = at('lug:tartessos', 'Tarsis', 37, -6, 2)
    world.verse = [none, tartessos]
    world.data = {}
    teach(none, ['tw:names/joppa'])
    teach(tartessos, ['tw:names/joppa'])
    expect(await ask()).toBeNull()
  })

  it('accepts a region, shown as a point', async () => {
    const region = at('lug:region', 'Región', 32, 35, 2, 2)
    world.verse = [region]
    world.data = {}
    teach(region, ['tw:names/joppa'])
    expect((await ask())?.place.id).toBe('lug:region')
  })
})

describe('neighbours', () => {
  it('keeps the six nearest of seven', () => {
    const seven = Array.from({ length: 7 }, (_, i) => at(`lug:n${i}`, `N${i}`, 32.05 + i * 0.3, 34.75))
    const got = neighbours(joppa, seven, bbox)
    expect(got.map((p) => p.id)).toEqual(['lug:n0', 'lug:n1', 'lug:n2', 'lug:n3', 'lug:n4', 'lug:n5'])
    expect(neighbours(joppa, seven, bbox, 100)).toHaveLength(7)
  })

  it('leaves out the place itself, one with sure 0, one outside the basemap and one beyond 1,000 km', () => {
    const far = at('lug:far', 'Lejos', 32, 47) // about 1,200 km east
    const none = at('lug:none', 'Sin punto', 32.5, 35, 0)
    const out = at('lug:out', 'Fuera', 32.5, 5)
    const near = at('lug:near', 'Cerca', 33, 35.5)
    expect(neighbours(joppa, [joppa, far, none, out, near], bbox).map((p) => p.id)).toEqual(['lug:near'])
  })

  it('shows Nineveh for Joppa, as the design says (about 950 km)', () => {
    expect(neighbours(joppa, [nineveh], bbox).map((p) => p.id)).toEqual(['lug:nineveh'])
  })
})

describe('mapPoints and mapFrame', () => {
  it('draws the place as a full dot and the neighbours as references', () => {
    const doubtful = at('lug:d', 'Dudoso', 32, 35, 1, 2)
    const points = mapPoints(doubtful, [nineveh])
    expect(points[0]).toMatchObject({ id: 'lug:d', sure: 3, form: 1, label: 'Dudoso' })
    expect(points[0].ref).toBeUndefined()
    expect(points[1]).toMatchObject({ id: 'lug:nineveh', ref: true, label: 'Nínive' })
  })

  it('shows about 300 km around a place alone', () => {
    const f = mapFrame(joppa, [], 343, 180)
    const heightKm = (180 - 56) / f.scale / (1 / 111.2)
    expect(f.lat).toBeCloseTo(32.05, 5)
    // the span of 2.7 degrees of latitude fills the height less the margins
    expect(heightKm).toBeGreaterThanOrEqual(290)
    expect(heightKm).toBeLessThan(310)
  })

  it('includes the neighbours', () => {
    const near = at('lug:ashdod', 'Asdod', 31.8, 34.65)
    const withNear = mapFrame(joppa, [near, nineveh], 343, 180)
    const alone = mapFrame(joppa, [], 343, 180)
    expect(withNear.scale).toBeLessThan(alone.scale)
    expect(withNear.lon).toBeGreaterThan(alone.lon)
  })
})

describe('chapterPlaces', () => {
  it('is the places of the chapter, or none', async () => {
    world.chapter = [joppa]
    expect(await chapterPlaces(reader, 'jon', 1)).toEqual([joppa])
    world.chapter = null
    expect(await chapterPlaces(reader, 'jon', 1)).toEqual([])
  })
})

describe('bookPlaces and bookRangeV3', () => {
  it('asks for the whole book, from its first verse id to its last', () => {
    expect(bookRangeV3('jon')).toEqual([32000000, 32999999])
    expect(bookRangeV3('gen')).toEqual([1000000, 1999999])
  })

  it('is the places of the book, or none without xtopics', async () => {
    world.chapter = [joppa, nineveh]
    expect(await bookPlaces(reader, 'jon')).toEqual([joppa, nineveh])
    world.chapter = null
    expect(await bookPlaces(reader, 'jon')).toEqual([])
  })
})

describe('citeOfVerse', () => {
  it('is the chapter and verse of the place own verse', () => {
    expect(citeOfVerse(32001003)).toBe('1:3')
    expect(citeOfVerse(32003010)).toBe('3:10')
  })
})

describe('sheetBounds', () => {
  it('is the place, the others and the two corners 150 km around the place', () => {
    const b = sheetBounds(joppa, [nineveh])
    expect(b).toHaveLength(4)
    expect(b[0]).toEqual({ lat: 32.05, lon: 34.75 })
    expect(b[1]).toEqual({ lat: 36.36, lon: 43.15 })
    expect(b[2]!.lat).toBeCloseTo(32.05 + 1.35, 6)
    expect(b[3]!.lat).toBeCloseTo(32.05 - 1.35, 6)
    expect(b[2]!.lon).toBeLessThan(34.75)
    expect(b[3]!.lon).toBeGreaterThan(34.75)
  })
})
