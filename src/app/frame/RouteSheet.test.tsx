import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { fit, LIGHT_REFERENCE, LIGHT_THEME, type PlaceAt } from '@bt-synergy/language-pack-client'
import en from '../i18n/en.json'
import es from '../i18n/es.json'
import { TEST_BASEMAP } from '../../resources/v3/testing/sample'
import { legsOf, roundKm } from '../../resources/v3/routeV3'
import { sheetBounds } from '../../resources/v3/placesV3'
import type { PlaceMapState } from './PlaceMap'
import { legWords, numberIn, PlaceSheetView, routeMapSvg, routeOverlay, sourceName, totalWords } from './RouteSheet'

const texts = es as Record<string, string>
const t = (key: string, values: Record<string, string | number> = {}) => (texts[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''))
const bbox = [800, 2200, 5200, 4300] as const

const at = (id: string, name: string, lat: number | undefined, lon: number | undefined, sure: 0 | 1 | 2 | 3 = 3, verse = 32001003, form: PlaceAt['form'] = 1): PlaceAt => ({
  id,
  name,
  ...(lat === undefined ? {} : { lat, lon }),
  sure,
  form,
  verse,
})
const joppa = at('lug:joppa', 'Jope', 33.2, 34.9)
const nineveh = at('lug:nineveh', 'Nínive', 36.36, 43.15, 3, 32003003)
const tarshish = at('lug:tarshish', 'Tarsis', 36.7, -6.2, 1)
const lost = at('lug:lost', 'Perdido', undefined, undefined, 0, 32001004)
const tyre = at('lug:tyre', 'Tiro', 33.27, 35.2)
const tyreNear = at('lug:tyre2', 'Tiro cerca', 33.28, 35.21)
const base = { id: 'a'.repeat(64), basemap: TEST_BASEMAP as never }
const state: PlaceMapState = { found: { place: joppa, sources: ['openbibleinfo/Bible-Geocoding-Data'], base }, chapter: [joppa, nineveh, tarshish, lost], bbox }
const theme = { ...LIGHT_THEME, ...LIGHT_REFERENCE }

const noop = () => {}
const view = (o: Partial<Parameters<typeof PlaceSheetView>[0]> = {}) =>
  renderToStaticMarkup(
    <PlaceSheetView
      t={t}
      language="es"
      state={state}
      map={null}
      stops={[]}
      notice={false}
      book={undefined}
      bookOpen={false}
      onAdd={noop}
      onRemove={noop}
      onClear={noop}
      onBook={noop}
      {...o}
    />,
  )

describe('PlaceSheetView', () => {
  it('without stops asks to touch the places, and shows no route', () => {
    const html = view()
    expect(html).toContain('Toque los lugares en el orden del viaje.')
    expect(html).not.toContain('Borrar el recorrido')
    expect(html).not.toContain('Parada 1')
  })

  it('lists all the places of the chapter, also those the map leaves out, and credits the sources', () => {
    const html = view()
    expect(html).toContain('Jope · 1:3')
    expect(html).toContain('Nínive · 3:3')
    expect(html).toContain('Tarsis · 1:3<span class="quiet"> · fuera de este mapa</span>')
    expect(html).not.toContain('Nínive · 3:3<span class="quiet"> · fuera de este mapa')
    expect(html).toContain('OpenBible.info (CC BY 4.0)')
    expect(html).toContain('Natural Earth, de dominio público')
  })

  it('shows a place without a point in grey, with no button', () => {
    const html = view()
    expect(html).toContain('Perdido · 1:4')
    expect(html).toContain('sin punto en el mapa')
    expect(html).not.toMatch(/<button[^>]*>(?:(?!<\/button>).)*Perdido/)
  })

  it('with one stop says «Parada 1», «Quitar» and to touch another place', () => {
    const html = view({ stops: [joppa] })
    expect(html).toContain('Toque otro lugar para ver el camino.')
    expect(html).toContain('Parada 1')
    expect(html).toContain('>Quitar<')
    expect(html).toContain('aria-label="Quitar la parada 1, Jope"')
    expect(html).toContain('Borrar el recorrido')
    expect(html).not.toContain('Medido en línea recta')
  })

  it('with two stops gives the leg, on foot and on horseback, and says it is a straight line', () => {
    const html = view({ stops: [joppa, nineveh] })
    const leg = legsOf([joppa, nineveh], bbox)[0]!
    expect(html).toContain('Parada 2')
    expect(html).toContain(`Jope → Nínive: unos ${roundKm(leg.km!)} km.`)
    expect(html).toContain('A pie, de ')
    expect(html).toContain('A caballo, de ')
    expect(html).toContain('Medido en línea recta, con un margen por las vueltas del camino.')
    expect(html).not.toContain('Total:') // one leg is its own total
  })

  it('with a third stop gives the total, and a place twice is two stops', () => {
    const html = view({ stops: [joppa, nineveh, joppa] })
    expect(html).toContain('Parada 3')
    expect(html).toContain('Total: unos ')
    expect(html.match(/Medido en línea recta/g)).toHaveLength(1)
  })

  it('says why a leg has no time, that it is not seen in the map, and that the total lacks it', () => {
    const html = view({ stops: [joppa, tarshish] })
    expect(html).toContain('No se puede calcular el tiempo: no se sabe con certeza dónde quedaba Tarsis.')
    expect(html).toContain('Este tramo no se ve en el mapa.')
    const three = view({ stops: [joppa, nineveh, tarshish] })
    expect(three).toContain('el tiempo falta en un tramo.')
  })

  it('says the last stop again is not added', () => {
    expect(view({ stops: [joppa], notice: true })).toContain('Ya es la última parada.')
    expect(view({ stops: [joppa] })).not.toContain('Ya es la última parada.')
  })

  it('draws the map and the line over it, and keeps the space while it is drawn', () => {
    const map = routeMapSvg({ t, place: joppa, stops: [joppa, nineveh], legs: legsOf([joppa, nineveh], bbox), near: [], bbox, basemap: TEST_BASEMAP as never, bounds: sheetBounds(joppa, [nineveh]), width: 343, height: 280, theme })
    const html = view({ map, stops: [joppa, nineveh] })
    expect(html).toContain('<svg')
    expect(html).toContain('route-map-overlay')
    expect(html).toContain('stroke-dasharray="6 4"')
    expect(view()).toContain('route-map-box is-waiting')
    expect(view()).toContain('height:280px')
  })

  it('without the basemap shows no map but still the route', () => {
    const html = view({ state: { ...state, found: { ...state.found, base: null } }, stops: [joppa, nineveh] })
    expect(html).not.toContain('route-map')
    expect(html).toContain('A pie, de ')
  })

  it('lists the other places of the book when they are there, and leaves out those of the chapter', () => {
    const sidon = at('lug:sidon', 'Sidón', 33.56, 35.37, 3, 32002001)
    const html = view({ book: [joppa, sidon], bookOpen: true })
    expect(html).toContain('+ Lugares de todo el libro')
    expect(html).toContain('Sidón · 2:1')
    expect(html.match(/Jope · 1:3/g)).toHaveLength(1)
    expect(view({ book: undefined, bookOpen: true })).toContain('Buscando los lugares del libro')
    expect(view({ book: [joppa], bookOpen: true })).toContain('No hay otros lugares en este libro.')
  })
})

describe('routeMapSvg', () => {
  const draw = (stops: PlaceAt[], near: PlaceAt[] = [nineveh]) => routeMapSvg({ t, place: joppa, stops, legs: legsOf(stops, bbox), near, bbox, basemap: TEST_BASEMAP as never, bounds: sheetBounds(joppa, near), width: 343, height: 280, theme })

  it('without stops draws as the card does: the place and the references, no line', () => {
    const d = draw([])
    expect(d.svg).toContain('Mapa: Jope, con Nínive de referencia')
    expect(d.points.map((p) => p.id)).toEqual(['lug:joppa', 'lug:nineveh'])
    expect(d.points[1]!.ref).toBe(true)
    expect(d.overlay).not.toContain('<line')
  })

  it('draws each stop once as a normal point with its number, «1, 3» for one passed twice, and never as a reference', () => {
    const d = draw([joppa, nineveh, joppa])
    expect(d.points.map((p) => [p.id, p.badge, p.ref])).toEqual([
      ['lug:joppa', '1, 3', undefined],
      ['lug:nineveh', '2', undefined],
    ])
    expect(d.svg).toContain('Recorrido: Jope, Nínive, Jope')
    // two legs, each a segment
    expect(d.overlay.match(/<line /g)).toHaveLength(2)
  })

  it('draws no segment for a leg that is off the map, and no point for the place outside', () => {
    const d = draw([joppa, tarshish, nineveh])
    expect(d.points.map((p) => p.id)).not.toContain('lug:tarshish')
    expect(d.overlay).not.toContain('<line')
  })

  it('draws a region stop as a normal point', () => {
    const galilee = at('lug:galilee', 'Galilea', 32.9, 35.5, 3, 32001001, 2)
    const d = routeMapSvg({ t, place: galilee, stops: [galilee], legs: [], near: [], bbox, basemap: TEST_BASEMAP as never, bounds: sheetBounds(galilee, []), width: 343, height: 280, theme })
    expect(d.points[0]).toMatchObject({ id: 'lug:galilee', form: 1, sure: 3, badge: '1' })
  })

  it('frames the bounds at the width given, so the same bounds fit again at another width', () => {
    const bounds = sheetBounds(joppa, [nineveh])
    expect(draw([]).frame).toEqual(fit(bounds, 343, 280, 64))
    expect(fit(bounds, 600, 280).scale).not.toBe(fit(bounds, 343, 280).scale)
  })
})

describe('routeOverlay', () => {
  it('draws a dashed line in the route colour between the projected ends, taking no touches', () => {
    const frame = fit([joppa as never, nineveh as never], 343, 280)
    const svg = routeOverlay(frame, [[joppa as never, nineveh as never]], '#b3402b')
    expect(svg).toContain('viewBox="0 0 343 280"')
    expect(svg).toContain('stroke="#b3402b"')
    expect(svg).toContain('stroke-dasharray="6 4"')
    expect(svg).toContain('aria-hidden="true"')
  })
})

describe('legWords and totalWords', () => {
  const num = (n: number) => numberIn('es', n)

  it('says «casi en el mismo lugar» for two places at the same point', () => {
    const [leg] = legsOf([tyre, tyreNear], bbox)
    expect(legWords(t, num, leg!)).toEqual({ head: 'Tiro → Tiro cerca.', lines: ['Están casi en el mismo lugar.'] })
  })

  it('says the region and the water as the reason', () => {
    const galilee = at('lug:galilee', 'Galilea', 32.9, 35.5, 3, 32001001, 2)
    const sea = at('lug:sea', 'Mar', 34, 33, 3, 32001001, 3)
    expect(legWords(t, num, legsOf([joppa, galilee], bbox)[0]!).lines[0]).toBe('No se puede calcular el tiempo: Galilea es una región.')
    expect(legWords(t, num, legsOf([joppa, sea], bbox)[0]!).lines[0]).toBe('No se puede calcular el tiempo: Mar es agua.')
  })

  it('says «en barco» only in the leg between ports', () => {
    const port = (id: string, name: string, lat: number, lon: number) => at(id, name, lat, lon, 3, 32001001, 5)
    const words = legWords(t, num, legsOf([port('a', 'Tiro', 33.27, 35.2), port('b', 'Sidón', 33.56, 35.37)], bbox)[0]!)
    expect(words.lines).toHaveLength(3)
    expect(words.lines[2]).toMatch(/^En barco, /)
  })

  it('writes the numbers with the separator of the language', () => {
    expect(numberIn('es', 1200)).toBe('1200') // Spanish has no separator for four digits
    expect(numberIn('es', 12000)).toBe('12.000')
    expect(numberIn('en', 12000)).toBe('12,000')
    expect(numberIn('xx-invalid-tag-', 12000)).toBe('12.000')
  })

  it('the total of legs with days gives them, and without them says the time is missing', () => {
    const ok = totalWords(t, num, { km: 1800, foot: { low: 60, high: 90 }, horse: { low: 30, high: 40 }, missing: 0 })
    expect(ok.head).toBe('Total: unos 1800 km.')
    expect(ok.lines).toEqual(['A pie, más de dos meses.', 'A caballo, de 30 a 40 días.'])
    expect(totalWords(t, num, { km: 1800, missing: 2 }).head).toBe('Total: unos 1800 km; el tiempo falta en 2 tramos.')
  })
})

describe('the words of the route in the three languages', () => {
  it('every key of es has its pt and en, and the computer forms are there', async () => {
    const pt = (await import('../i18n/pt.json')).default as Record<string, string>
    const keys = Object.keys(es).filter((k) => k.startsWith('ayudas.recorrido'))
    expect(keys.length).toBeGreaterThan(30)
    for (const k of keys) {
      expect(pt[k], k).toBeTruthy()
      expect((en as Record<string, string>)[k], k).toBeTruthy()
    }
    expect(texts['ayudas.recorridoToque.computadora']).toBe('Haga clic en los lugares en el orden del viaje.')
    expect(texts['ayudas.recorridoToqueOtro.computadora']).toBe('Haga clic en otro lugar para ver el camino.')
  })
})

describe('sourceName', () => {
  it('names the sources of the places', () => {
    expect(sourceName('robertrouse/theographic-bible-metadata')).toBe('Theographic')
    expect(sourceName('x/otra')).toBe('otra')
  })
})
