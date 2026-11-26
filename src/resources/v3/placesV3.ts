/**
 * Which place a touched word is, and the points of its map (design: «El mapa de un lugar»). Pure functions over the
 * answers of `placesOf`, `placeQuery` and `passagePlaces`; the drawing itself is `drawMap` of bt-synergy.
 */
import { BOOKS } from '@bt-synergy/language-pack-v3'
import {
  distance,
  fit,
  passagePlaces,
  placeQuery,
  placesOf,
  type Frame,
  type LatLon,
  type MapPoint,
  type PackReader,
  type PlaceAt,
} from '@bt-synergy/language-pack-client'
import type { ArticleRef } from '../articleLinks'
import { articleIdV3 } from './lookups'

/** The basemap's box: `[west, south, east, north]` in degrees x 100. */
export type Bbox = readonly [number, number, number, number]

/** How far a grey neighbour may be from the place, and how many are shown in the card. */
export const NEIGHBOUR_KM = 1000
export const NEIGHBOURS_IN_CARD = 6
/** The corners that keep the map from being too close: 150 km (1.35 degrees of latitude) around the place. */
const MARGIN_DEGREES = 1.35

/** `book × 1,000,000 + chapter × 1,000 + verse`, the id `placesOf` takes; `book` is the lowercase code (`jon`). */
export function verseIdV3(book: string, chapter: number, verse: number): number {
  return (BOOKS.indexOf(book.toLowerCase()) + 1) * 1_000_000 + chapter * 1_000 + verse
}

/** The first and last verse id of a chapter (`passagePlaces` takes a range). */
export function chapterRangeV3(book: string, chapter: number): [number, number] {
  return [verseIdV3(book, chapter, 0), verseIdV3(book, chapter, 999)]
}

/** Whether a point lies inside the basemap's box. */
export function inBasemap(p: LatLon, bbox: Bbox): boolean {
  return p.lon * 100 >= bbox[0] && p.lon * 100 <= bbox[2] && p.lat * 100 >= bbox[1] && p.lat * 100 <= bbox[3]
}

/** A place a map can draw: it has a point (`sure` above 0) inside the basemap. */
const drawable = (p: PlaceAt, bbox: Bbox): p is PlaceAt & LatLon => p.sure > 0 && p.lat !== undefined && p.lon !== undefined && inBasemap({ lat: p.lat, lon: p.lon }, bbox)

/** The place with its articles and sources, as the big sheet credits it. */
export type WordPlace = { place: PlaceAt; sources: string[] }

/**
 * The place a word is: of the places the verse names (those with a point, inside the basemap), the one whose `tw`
 * articles include the touched article; the surest one if several do, the first if they tie. `null` when there is
 * none, or when `xtopics` is not installed. Regions (`form` 2) count: they are shown as a point.
 */
export async function placeOfWord(reader: PackReader, article: ArticleRef, verseId: number, bbox: Bbox): Promise<WordPlace | null> {
  const here = await placesOf(reader, verseId)
  if (here.data === null) return null
  const concept = articleIdV3(article)
  let best: WordPlace | null = null
  for (const place of here.data.filter((p) => drawable(p, bbox))) {
    const asked = await placeQuery(reader, place.id)
    if (asked.data === null || !asked.data.tw.includes(concept)) continue
    if (best === null || place.sure > best.place.sure) best = { place, sources: asked.data.sources }
  }
  return best
}

/**
 * The other places a map shows in grey: not the place itself, with a point inside the basemap, the nearest first and
 * only those under 1,000 km; at most `limit` (six in the card, all in the big sheet).
 */
export function neighbours(place: PlaceAt, candidates: readonly PlaceAt[], bbox: Bbox, limit = NEIGHBOURS_IN_CARD): PlaceAt[] {
  if (place.lat === undefined || place.lon === undefined) return []
  const from = { lat: place.lat, lon: place.lon }
  return candidates
    .filter((p) => p.id !== place.id && drawable(p, bbox))
    .map((p) => ({ p, km: distance(from, { lat: p.lat!, lon: p.lon! }).km }))
    .filter((x) => x.km < NEIGHBOUR_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit)
    .map((x) => x.p)
}

/** The places of a chapter as `passagePlaces` gives them (empty when `xtopics` is not here). */
export async function chapterPlaces(reader: PackReader, book: string, chapter: number): Promise<PlaceAt[]> {
  const [first, last] = chapterRangeV3(book, chapter)
  return (await passagePlaces(reader, first, last)).data ?? []
}

/**
 * The points for `drawMap`: the place always as a full dot with its name (`sure: 3`, `form: 1`: the doubt is said by a
 * line under the map, not by the drawing), the neighbours as grey references.
 */
export function mapPoints(place: PlaceAt, near: readonly PlaceAt[]): MapPoint[] {
  const out: MapPoint[] = [{ id: place.id, lat: place.lat!, lon: place.lon!, sure: 3, form: 1, label: place.name }]
  for (const p of near) {
    out.push({ id: p.id, lat: p.lat!, lon: p.lon!, sure: Math.max(1, p.sure) as 1 | 2 | 3, form: p.form, label: p.name, ref: true })
  }
  return out
}

/**
 * The frame: `fit` of the place, its neighbours and two invisible corners 150 km to the north-west and the south-east
 * of the place, so that at least about 300 km are seen around it. None of them is `ref`, or `fit` would ignore them.
 */
export function mapFrame(place: PlaceAt, near: readonly PlaceAt[], width: number, height: number): Frame {
  const lat = place.lat!
  const lon = place.lon!
  const dLon = MARGIN_DEGREES / Math.cos((lat * Math.PI) / 180)
  const all = [
    { lat, lon },
    ...near.map((p) => ({ lat: p.lat!, lon: p.lon! })),
    { lat: lat + MARGIN_DEGREES, lon: lon - dLon },
    { lat: lat - MARGIN_DEGREES, lon: lon + dLon },
  ]
  return fit(all, width, height)
}
