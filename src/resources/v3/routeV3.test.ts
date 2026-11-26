import { describe, expect, it } from 'vitest'
import { fit, project, type PlaceAt } from '@bt-synergy/language-pack-client'
import { badgesOf, canAdd, daysText, growBounds, legsOf, nearestStop, roundKm, totalOf } from './routeV3'
import type { Bbox } from './placesV3'

const bbox: Bbox = [800, 2200, 5200, 4300]
const at = (id: string, name: string, lat: number | undefined, lon: number | undefined, sure: 0 | 1 | 2 | 3 = 3, form: PlaceAt['form'] = 1): PlaceAt => ({
  id,
  name,
  ...(lat === undefined ? {} : { lat, lon }),
  sure,
  form,
  verse: 32001003,
})
// Fixed coordinates (the test does not depend on a pack): Joppa and Nineveh, about 880 km apart.
const joppa = at('lug:joppa', 'Jope', 32.05, 34.75, 3, 5)
const nineveh = at('lug:nineveh', 'Nínive', 36.36, 43.15)
const tarshish = at('lug:tarshish', 'Tarsis', 36.7, -6.2, 1) // far west of the basemap
const galilee = at('lug:galilee', 'Galilea', 32.9, 35.5, 3, 2)
const sea = at('lug:sea', 'Mar', 34, 33, 3, 3)
const tyre = at('lug:tyre', 'Tiro', 33.27, 35.2, 3, 5)
const sidon = at('lug:sidon', 'Sidón', 33.56, 35.37, 3, 5)
const tyreNear = at('lug:tyre2', 'Tiro 2', 33.28, 35.21, 3, 1)
const unsure = at('lug:x', 'Equis', 34, 36, 1)
const nowhere = at('lug:none', 'Nada', undefined, undefined, 0)

describe('legsOf and totalOf', () => {
  it('has one leg for each pair and a total that sums km and days', () => {
    const legs = legsOf([joppa, nineveh, joppa], bbox)
    expect(legs).toHaveLength(2)
    expect(legs[0]!.km).toBeGreaterThan(850)
    expect(legs[0]!.km).toBeLessThan(920)
    const total = totalOf(legs)
    expect(total.km).toBeCloseTo(legs[0]!.km! + legs[1]!.km!, 6)
    expect(total.foot!.low).toBe(legs[0]!.days!.foot.low + legs[1]!.days!.foot.low)
    expect(total.foot!.high).toBe(legs[0]!.days!.foot.high + legs[1]!.days!.foot.high)
    expect(total.horse!.high).toBe(legs[0]!.days!.horse.high + legs[1]!.days!.horse.high)
  })

  it('Jope to Nínive: days on foot and on horseback from the speeds and road factors', () => {
    const [leg] = legsOf([joppa, nineveh], bbox)
    const km = leg!.km!
    expect(leg!.days!.foot).toEqual({ low: Math.floor((km * 1.15) / 30), high: Math.ceil((km * 1.4) / 30) })
    expect(leg!.days!.horse).toEqual({ low: Math.floor((km * 1.15) / 56), high: Math.ceil((km * 1.4) / 56) })
    expect(leg!.offMap).toBe(false)
  })

  it('says why there is no time: doubtful, region, water, the same place, no point', () => {
    expect(legsOf([joppa, unsure], bbox)[0]).toMatchObject({ why: 'dudoso', because: unsure })
    expect(legsOf([joppa, tarshish], bbox)[0]).toMatchObject({ why: 'dudoso', because: tarshish })
    expect(legsOf([galilee, joppa], bbox)[0]).toMatchObject({ why: 'region', because: galilee })
    expect(legsOf([joppa, sea], bbox)[0]).toMatchObject({ why: 'agua', because: sea })
    expect(legsOf([tyre, tyreNear], bbox)[0]).toMatchObject({ why: 'cerca' })
    expect(legsOf([joppa, nowhere], bbox)[0]).toMatchObject({ why: 'sinPunto', because: nowhere })
  })

  it('still gives the km of a leg without time, and none without a point', () => {
    expect(legsOf([galilee, joppa], bbox)[0]!.km).toBeGreaterThan(0)
    expect(legsOf([joppa, nowhere], bbox)[0]!.km).toBeUndefined()
  })

  it('gives no days in the total when a leg has none, and counts a «cerca» leg as zero', () => {
    const total = totalOf(legsOf([joppa, nineveh, tarshish], bbox))
    expect(total.foot).toBeUndefined()
    expect(total.missing).toBe(1)
    expect(total.km).toBeGreaterThan(880)
    const close = totalOf(legsOf([tyre, tyreNear, joppa], bbox))
    expect(close.missing).toBe(0)
    expect(close.foot!.low).toBeGreaterThanOrEqual(0)
  })

  it('marks a leg with a place outside the basemap, or without a point, as off the map', () => {
    expect(legsOf([joppa, tarshish], bbox)[0]!.offMap).toBe(true)
    expect(legsOf([joppa, nowhere], bbox)[0]!.offMap).toBe(true)
  })

  it('gives the ship only between ports, and never in the total', () => {
    const [leg] = legsOf([tyre, sidon], bbox)
    expect(leg!.days!.ship).toBeDefined()
    expect(legsOf([joppa, nineveh], bbox)[0]!.days!.ship).toBeUndefined()
    expect(totalOf([leg!])).not.toHaveProperty('ship')
  })
})

describe('roundKm', () => {
  it('goes to 10 above 100 and to 1 below', () => {
    expect(roundKm(884)).toBe(880)
    expect(roundKm(101)).toBe(100)
    expect(roundKm(44.6)).toBe(45)
    expect(roundKm(0.4)).toBe(0)
  })
})

describe('daysText', () => {
  it('has a key for each shape', () => {
    expect(daysText({ low: 0, high: 1 })).toEqual({ key: 'ayudas.recorridoDiasMenos' })
    expect(daysText({ low: 0, high: 0 })).toEqual({ key: 'ayudas.recorridoDiasMenos' })
    expect(daysText({ low: 0, high: 4 })).toEqual({ key: 'ayudas.recorridoDiasHasta', values: { m: 4 } })
    expect(daysText({ low: 1, high: 1 })).toEqual({ key: 'ayudas.recorridoDiasUno' })
    expect(daysText({ low: 5, high: 5 })).toEqual({ key: 'ayudas.recorridoDiasUnos', values: { n: 5 } })
    expect(daysText({ low: 60, high: 80 })).toEqual({ key: 'ayudas.recorridoDiasMuchos' })
    expect(daysText({ low: 33, high: 42 })).toEqual({ key: 'ayudas.recorridoDiasDe', values: { n: 33, m: 42 } })
  })
})

describe('badgesOf and canAdd', () => {
  it('numbers the stops, «1, 3» for a place passed twice', () => {
    expect(badgesOf([joppa, nineveh, joppa])).toEqual(
      new Map([
        ['lug:joppa', '1, 3'],
        ['lug:nineveh', '2'],
      ]),
    )
  })

  it('does not add the last stop again, nor a place without a point; going back is fine', () => {
    expect(canAdd([], joppa)).toBe(true)
    expect(canAdd([joppa], joppa)).toBe(false)
    expect(canAdd([joppa, nineveh], joppa)).toBe(true)
    expect(canAdd([joppa], nowhere)).toBe(false)
  })
})

describe('nearestStop', () => {
  const pts = [joppa, nineveh].map((p) => ({ id: p.id, lat: p.lat!, lon: p.lon! }))
  const frame = fit(pts, 343, 280)
  it('finds the nearest point within 22 px', () => {
    const [x, y] = project(frame, joppa.lat!, joppa.lon!)
    expect(nearestStop(frame, pts, x + 15, y - 10)?.id).toBe('lug:joppa')
  })
  it('finds none beyond the radius', () => {
    const [x, y] = project(frame, joppa.lat!, joppa.lon!)
    expect(nearestStop(frame, pts, x + 40, y)).toBeNull()
    expect(nearestStop(frame, [], 10, 10)).toBeNull()
  })
})

describe('growBounds', () => {
  const bounds = [joppa, tyre].map((p) => ({ lat: p.lat!, lon: p.lon! }))
  const frame = fit(bounds, 343, 280)
  it('keeps the bounds when the frame already shows the stop', () => {
    expect(growBounds(bounds, { lat: 32.6, lon: 35 }, frame)).toBe(bounds)
  })
  it('adds a stop the frame does not show, and never loses a point', () => {
    const grown = growBounds(bounds, { lat: nineveh.lat!, lon: nineveh.lon! }, frame)
    expect(grown).toHaveLength(3)
    expect(grown.slice(0, 2)).toEqual(bounds)
    expect(fit(grown, 343, 280).scale).toBeLessThan(frame.scale)
  })
})
