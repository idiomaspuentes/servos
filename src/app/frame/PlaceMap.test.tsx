import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LIGHT_REFERENCE, LIGHT_THEME, type PlaceAt } from '@bt-synergy/language-pack-client'
import es from '../i18n/es.json'
import { TEST_BASEMAP } from '../../resources/v3/testing/sample'
import { PlaceMapView, PlaceSheetView, placeMapSvg, sourceName, type PlaceMapState } from './PlaceMap'

const texts = es as Record<string, string>
const t = (key: string, values: Record<string, string | number> = {}) => (texts[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? ''))

const at = (id: string, name: string, lat: number, lon: number, sure: 0 | 1 | 2 | 3 = 3, verse = 32001003): PlaceAt => ({ id, name, lat, lon, sure, form: 1, verse })
const joppa = at('lug:joppa', 'Jope', 33.2, 34.9)
const nineveh = at('lug:nineveh', 'Nínive', 33.5, 36.1, 3, 32003003)
const base = { id: 'a'.repeat(64), basemap: TEST_BASEMAP as never }
const state = (place: PlaceAt, withBase = true): PlaceMapState => ({
  found: { place, sources: ['openbibleinfo/Bible-Geocoding-Data'], base: withBase ? base : null },
  chapter: [place, nineveh],
  bbox: [800, 2200, 5200, 4300],
})
const theme = { ...LIGHT_THEME, ...LIGHT_REFERENCE }
const drawn = (dir?: 'ltr' | 'rtl') => placeMapSvg({ t, place: joppa, near: [nineveh], basemap: TEST_BASEMAP as never, width: 343, height: 180, theme, ...(dir ? { dir } : {}) })

describe('placeMapSvg', () => {
  it('draws the place with its name, the reference, and a summary in the app language', () => {
    const svg = drawn()
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('Jope')
    expect(svg).toContain('Mapa: Jope, con Nínive de referencia')
    expect(svg).toContain('class="map-land"')
  })

  it('says only the place when it has no neighbours', () => {
    const svg = placeMapSvg({ t, place: joppa, near: [], basemap: TEST_BASEMAP as never, width: 343, height: 180, theme })
    expect(svg).toContain('aria-label="Mapa: Jope"')
  })

  it('goes right to left for a right-to-left project', () => {
    expect(drawn('rtl')).toContain('direction="rtl"')
  })

  it('takes its colours from the theme', () => {
    const dark = placeMapSvg({ t, place: joppa, near: [], basemap: TEST_BASEMAP as never, width: 343, height: 180, theme: { ...theme, sea: '#10222c' } })
    expect(dark).toContain('#10222c')
    expect(drawn()).not.toContain('#10222c')
  })
})

describe('PlaceMapView', () => {
  const view = (s: PlaceMapState | null | undefined, svg: string | null = drawn()) => renderToStaticMarkup(<PlaceMapView t={t} state={s} svg={svg} onBig={() => {}} />)

  it('shows the map and the row to the big one', () => {
    const html = view(state(joppa))
    expect(html).toContain('<svg')
    expect(html).toContain('Ver el mapa grande ›')
    expect(html).not.toContain('No se sabe con certeza')
  })

  it('keeps a space of 180 px while the map is drawn', () => {
    const html = view(state(joppa), null)
    expect(html).toContain('is-waiting')
    expect(html).toContain('height:180px')
    expect(html).not.toContain('<svg')
  })

  it('says it when the place is doubtful (sure 1), and not for sure 2', () => {
    expect(view(state(at('lug:x', 'Dudoso', 33, 35, 1)))).toContain('No se sabe con certeza dónde quedaba.')
    expect(view(state(at('lug:y', 'Probable', 33, 35, 2)))).not.toContain('No se sabe con certeza')
  })

  it('without the basemap says only that the map is not on this device', () => {
    const html = view(state(joppa, false))
    expect(html).toContain('El mapa no está en este aparato.')
    expect(html).not.toContain('<svg')
    expect(html).not.toContain('Ver el mapa grande')
  })

  it('shows nothing without a place, or while asking', () => {
    expect(view(null)).toBe('')
    expect(view(undefined)).toBe('')
  })
})

describe('PlaceSheetView', () => {
  it('lists the places with where the chapter names them, and credits the sources', () => {
    const html = renderToStaticMarkup(<PlaceSheetView t={t} state={state(joppa)} chapterNumber={1} svg={drawn()} />)
    expect(html).toContain('<svg')
    expect(html).toContain('Jope · 1:3')
    expect(html).toContain('Nínive · 1:3')
    expect(html).toContain('Natural Earth, de dominio público')
    expect(html).toContain('OpenBible.info (CC BY 4.0)')
  })

  it('names the sources of the places', () => {
    expect(sourceName('robertrouse/theographic-bible-metadata')).toBe('Theographic')
    expect(sourceName('x/otra')).toBe('otra')
  })
})
