/**
 * A route of places in the big map (design: «Un recorrido en el mapa grande»). Pure functions: the legs between the
 * stops and their total, the words for a range of days (as an i18n key and its values, never loose text), the numbers
 * of the stops, which place a touch means, and the bounds of the frame. The drawing is `drawMap`; the list is
 * `PlaceMap.tsx`.
 */
import { distance, project, trip, type Frame, type LatLon, type PlaceAt } from '@bt-synergy/language-pack-client'
import { inBasemap, type Bbox } from './placesV3'

export type DayRange = { low: number; high: number }
export type LegDays = { foot: DayRange; horse: DayRange; ship?: DayRange }
/** Why a leg has no time: the place has no point, is a region, is water, the two are the same place, or it is doubtful. */
export type NoTime = 'sinPunto' | 'region' | 'agua' | 'cerca' | 'dudoso'

export type Leg = {
  from: PlaceAt
  to: PlaceAt
  km?: number
  days?: LegDays
  /** Set when `days` is absent; `cerca` still counts as no days for the total. */
  why?: NoTime
  /** The place that causes `why` (the region, the doubtful one…); absent for `cerca`. */
  because?: PlaceAt
  /** One of the two places is not drawn in the map (no point or outside the basemap), so the leg is not seen. */
  offMap: boolean
}

const hasPoint = (p: PlaceAt): boolean => p.sure > 0 && p.lat !== undefined && p.lon !== undefined

/** Whether the map draws the place: it has a point inside the basemap. */
export function drawnIn(p: PlaceAt, bbox: Bbox): boolean {
  return hasPoint(p) && inBasemap({ lat: p.lat!, lon: p.lon! }, bbox)
}

/** The reason `trip` gives no days, deduced in this order: no point, region, water, the same place, doubtful. */
function whyNoTime(a: PlaceAt, b: PlaceAt, near: boolean): { why: NoTime; because?: PlaceAt } {
  const pair = [a, b]
  const no = pair.find((p) => !hasPoint(p))
  if (no) return { why: 'sinPunto', because: no }
  const region = pair.find((p) => p.form === 2)
  if (region) return { why: 'region', because: region }
  const water = pair.find((p) => p.form === 3)
  if (water) return { why: 'agua', because: water }
  if (near) return { why: 'cerca' }
  return { why: 'dudoso', because: pair.find((p) => p.sure === 1) ?? a }
}

/** One leg for each pair of stops that follow each other. */
export function legsOf(stops: readonly PlaceAt[], bbox: Bbox): Leg[] {
  const legs: Leg[] = []
  for (let i = 1; i < stops.length; i++) {
    const from = stops[i - 1]!
    const to = stops[i]!
    const got = trip(from, to)
    const km = got?.km ?? (hasPoint(from) && hasPoint(to) ? distance({ lat: from.lat!, lon: from.lon! }, { lat: to.lat!, lon: to.lon! }).km : undefined)
    const leg: Leg = { from, to, offMap: !drawnIn(from, bbox) || !drawnIn(to, bbox) }
    if (km !== undefined) leg.km = km
    if (got?.days) leg.days = got.days
    else Object.assign(leg, whyNoTime(from, to, got?.near === true))
    legs.push(leg)
  }
  return legs
}

export type Total = { km: number; foot?: DayRange; horse?: DayRange; missing: number }

/**
 * The sum of the legs: the km that are known, and the sums of the low and of the high days on foot and on horseback.
 * A leg that is the same place counts as no days; any other leg without days leaves the total without days (`missing`
 * counts them). The ship is never summed.
 */
export function totalOf(legs: readonly Leg[]): Total {
  let km = 0
  let missing = 0
  const foot = { low: 0, high: 0 }
  const horse = { low: 0, high: 0 }
  for (const leg of legs) {
    km += leg.km ?? 0
    if (leg.days) {
      foot.low += leg.days.foot.low
      foot.high += leg.days.foot.high
      horse.low += leg.days.horse.low
      horse.high += leg.days.horse.high
    } else if (leg.why !== 'cerca') missing++
  }
  return missing > 0 ? { km, missing } : { km, foot, horse, missing }
}

/** Km rounded to 10 above 100, to 1 otherwise. */
export const roundKm = (km: number): number => (km > 100 ? Math.round(km / 10) * 10 : Math.round(km))

/** An i18n key and its values. */
export type Words = { key: string; values?: Record<string, number> }

/** A range of days, each shape its own key so that no plural rule is needed. */
export function daysText(r: DayRange): Words {
  if (r.low === 0 && r.high <= 1) return { key: 'ayudas.recorridoDiasMenos' }
  if (r.low === 0) return { key: 'ayudas.recorridoDiasHasta', values: { m: r.high } }
  if (r.low >= 60) return { key: 'ayudas.recorridoDiasMuchos' }
  if (r.low === r.high) return r.low === 1 ? { key: 'ayudas.recorridoDiasUno' } : { key: 'ayudas.recorridoDiasUnos', values: { n: r.low } }
  return { key: 'ayudas.recorridoDiasDe', values: { n: r.low, m: r.high } }
}

/** The stop numbers of each place for its badge: «1, 3» when the route passes twice. */
export function badgesOf(stops: readonly PlaceAt[]): Map<string, string> {
  const numbers = new Map<string, number[]>()
  stops.forEach((p, i) => numbers.set(p.id, [...(numbers.get(p.id) ?? []), i + 1]))
  return new Map([...numbers].map(([id, n]) => [id, n.join(', ')]))
}

/** Whether a place can be added after the stops: it has a point and is not the last stop again. */
export function canAdd(stops: readonly PlaceAt[], place: PlaceAt): boolean {
  return place.sure > 0 && stops[stops.length - 1]?.id !== place.id
}

/** The point nearest to a touch (SVG pixels of `frame`) within `radius` px, or null. */
export function nearestStop<P extends LatLon & { id: string }>(frame: Frame, points: readonly P[], x: number, y: number, radius = 22): P | null {
  let best: P | null = null
  let bestD = radius
  for (const p of points) {
    const [px, py] = project(frame, p.lat, p.lon)
    const d = Math.hypot(px - x, py - y)
    if (d <= bestD) {
      best = p
      bestD = d
    }
  }
  return best
}

/** Whether a point lies in the frame, with `margin` px to spare (the margin `fit` leaves). */
export function inFrame(frame: Frame, p: LatLon, margin = 28): boolean {
  const [x, y] = project(frame, p.lat, p.lon)
  return x >= margin && x <= frame.width - margin && y >= margin && y <= frame.height - margin
}

/** The bounds with one more point when the frame does not show it; never loses a point. */
export function growBounds(bounds: readonly LatLon[], stop: LatLon, frame: Frame): readonly LatLon[] {
  return inFrame(frame, stop) ? bounds : [...bounds, stop]
}
