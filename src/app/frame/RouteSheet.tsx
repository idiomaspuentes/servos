/**
 * The big sheet of a place, with a route (design: «Un recorrido en el mapa grande»). The map stays at the top of the
 * sheet while the list runs under it; touching the places, in the list or on the map, builds a route in the order of
 * the journey, and under the map are its legs (km, days on foot and on horseback) and their total.
 *
 * `routeMapSvg` is the drawing, pure; `PlaceSheetView` only shows; `PlaceSheet` holds the state, which is lost when the
 * sheet is closed (a route is a question, not the translator's work).
 *
 * `drawMap` joins every id of its `route` that it draws, even with one missing in between, and takes only one route, so
 * the line is drawn here: one dashed segment for each leg whose two ends are in the map, in an SVG over the map's.
 */

import { useCallback, useMemo, useState, type MouseEvent } from 'react'
import { drawMap, fit, project, type Frame, type LatLon, type MapPoint, type PlaceAt, type Theme } from '@bt-synergy/language-pack-client'
import type { PrototypeData } from '../../prototype/data'
import type { BasemapHere } from '../../resources/v3/basemapV3'
import { bookPlaces, citeOfVerse, mapPoints, neighbours, sheetBounds, type Bbox } from '../../resources/v3/placesV3'
import { badgesOf, canAdd, daysText, drawnIn, growBounds, legsOf, nearestStop, roundKm, totalOf, type DayRange, type Leg, type Total } from '../../resources/v3/routeV3'
import { useI18n, useT, type T } from '../i18n/i18n'
import { useLookup } from './acrossBooks'
import { currentMapTheme, measureText } from './mapTheme'
import type { PlaceMapState } from './PlaceMap'
import { Sheet } from './Sheet'
import { useBoxWidth, useThemeTick } from './useMapBox'

/** The map is 280 px high in the sheet and stays at the top. */

/** The room kept around the points of the sheet's map, in pixels, so the names beside the dots fit. */
const LABEL_MARGIN = 64
export const ROUTE_MAP_HEIGHT = 280

/** A source of the places as the credit names it. */
export const sourceName = (key: string): string =>
  key.startsWith('openbibleinfo/') ? 'OpenBible.info (CC BY 4.0)' : key.startsWith('robertrouse/') ? 'Theographic' : (key.split('/').pop() ?? key)

/** A number as the app's language writes it (`1.200` or `1,200`); Spanish for a tag `Intl` does not take. */
export function numberIn(language: string, n: number): string {
  try {
    return new Intl.NumberFormat(language).format(n)
  } catch {
    return new Intl.NumberFormat('es').format(n)
  }
}

// ---- the words of the legs ----

const daysIn = (t: T, num: (n: number) => string, r: DayRange): string => {
  const { key, values } = daysText(r)
  return t(key, Object.fromEntries(Object.entries(values ?? {}).map(([k, v]) => [k, num(v)])))
}

const kmIn = (t: T, num: (n: number) => string, km: number): string => t('ayudas.recorridoKm', { km: num(roundKm(km)) })

/** On foot, on horseback and, when the leg has it, by ship. */
const movesIn = (t: T, num: (n: number) => string, days: { foot: DayRange; horse: DayRange; ship?: DayRange }): string[] => [
  t('ayudas.recorridoAPie', { dias: daysIn(t, num, days.foot) }),
  t('ayudas.recorridoACaballo', { dias: daysIn(t, num, days.horse) }),
  ...(days.ship ? [t('ayudas.recorridoEnBarco', { dias: daysIn(t, num, days.ship) })] : []),
]

/** A leg in words: the head («Jope → Nínive: unos 880 km.») and the lines under it. */
export function legWords(t: T, num: (n: number) => string, leg: Leg): { head: string; lines: string[] } {
  const ends = { de: leg.from.name, a: leg.to.name }
  const head = leg.km !== undefined && leg.why !== 'cerca' ? t('ayudas.recorridoTramo', { ...ends, km: kmIn(t, num, leg.km) }) : t('ayudas.recorridoTramoSin', ends)
  if (leg.days) return { head, lines: movesIn(t, num, leg.days) }
  if (leg.why === 'cerca') return { head, lines: [t('ayudas.recorridoCerca')] }
  const motive = {
    dudoso: 'ayudas.recorridoMotivoDudoso',
    region: 'ayudas.recorridoMotivoRegion',
    agua: 'ayudas.recorridoMotivoAgua',
    sinPunto: 'ayudas.recorridoMotivoSinPunto',
  }[leg.why ?? 'dudoso']
  return { head, lines: [t('ayudas.recorridoSinTiempo', { motivo: t(motive, { lugar: leg.because?.name ?? leg.to.name }) })] }
}

/** The total of two or more legs in words. */
export function totalWords(t: T, num: (n: number) => string, total: Total): { head: string; lines: string[] } {
  const km = kmIn(t, num, total.km)
  if (total.foot && total.horse) return { head: t('ayudas.recorridoTotal', { km }), lines: movesIn(t, num, { foot: total.foot, horse: total.horse }) }
  return { head: t(total.missing === 1 ? 'ayudas.recorridoTotalFalta' : 'ayudas.recorridoTotalFaltan', { km, n: total.missing }), lines: [] }
}

// ---- the drawing ----

/** What was drawn: the map's SVG, the SVG of the line over it, the frame they share, and the points drawn (for a touch). */
export type RouteDrawn = { svg: string; overlay: string; frame: Frame; points: MapPoint[] }

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)

/** The SVG over the map: a dashed line for each segment, in the frame's pixels. */
export function routeOverlay(frame: Frame, segments: readonly (readonly [LatLon, LatLon])[], color: string): string {
  const lines = segments
    .map(([a, b]) => {
      const [x1, y1] = project(frame, a.lat, a.lon)
      const [x2, y2] = project(frame, b.lat, b.lon)
      return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${frame.width} ${frame.height}" width="${frame.width}" height="${frame.height}" aria-hidden="true" focusable="false"><g fill="none" stroke="${esc(color)}" stroke-width="2.5" stroke-dasharray="6 4" stroke-linecap="round" opacity="0.95">${lines}</g></svg>`
}

/**
 * The map of the sheet: the chapter's places in grey, the place touched in the card as a full dot (until it is a stop),
 * each stop once, as a normal dot with its number (`badge`: «1, 3» if the route passes twice), framed to the bounds.
 * The line is in `overlay`.
 */
export function routeMapSvg(o: {
  t: T
  place: PlaceAt
  stops: readonly PlaceAt[]
  legs: readonly Leg[]
  near: readonly PlaceAt[]
  bbox: Bbox
  basemap: BasemapHere['basemap']
  bounds: readonly LatLon[]
  width: number
  height: number
  theme: Theme
  dir?: 'ltr' | 'rtl'
  measure?: (text: string) => number
}): RouteDrawn {
  const stopIds = new Set(o.stops.map((p) => p.id))
  const badges = badgesOf(o.stops)
  const points = mapPoints(o.place, o.near).filter((p) => !stopIds.has(p.id))
  const seen = new Set<string>()
  for (const p of o.stops) {
    if (seen.has(p.id) || !drawnIn(p, o.bbox)) continue
    seen.add(p.id)
    points.push({ id: p.id, lat: p.lat!, lon: p.lon!, sure: 3, form: 1, label: p.name, badge: badges.get(p.id)! })
  }
  // A wider margin than fit's 28 px: a name goes beside its dot, and a stop at the edge (Nineveh) would lose it.
  const frame = fit(o.bounds, o.width, o.height, LABEL_MARGIN)
  const summary = o.stops.length
    ? o.t('ayudas.recorridoResumen', { lugares: o.stops.map((p) => p.name).join(', ') })
    : o.near.length
      ? o.t('ayudas.mapaResumen', { lugar: o.place.name, otros: o.near.map((p) => p.name).join(', ') })
      : o.t('ayudas.mapaResumenSolo', { lugar: o.place.name })
  const svg = drawMap({
    points,
    basemap: o.basemap,
    frame,
    theme: o.theme,
    ...(o.dir ? { dir: o.dir } : {}),
    summary,
    ...(o.measure ? { measure: o.measure } : {}),
    fontSize: 12,
  })
  const segments = o.legs.filter((l) => !l.offMap).map((l) => [{ lat: l.from.lat!, lon: l.from.lon! }, { lat: l.to.lat!, lon: l.to.lon! }] as const)
  return { svg, overlay: routeOverlay(frame, segments, o.theme.route), frame, points }
}

/** Draws the sheet's map at the box's width, again when the theme changes. Null until the box is measured. */
function useRouteMap(o: Omit<Parameters<typeof routeMapSvg>[0], 'width' | 'theme' | 'measure' | 't' | 'basemap'> & { basemap: BasemapHere | null }): {
  setBox(el: HTMLElement | null): void
  drawn: RouteDrawn | null
} {
  const t = useT()
  const [box, setBoxState] = useState<HTMLElement | null>(null)
  const width = useBoxWidth(box)
  const tick = useThemeTick()
  const { place, stops, legs, near, bbox, basemap, bounds, height, dir } = o
  const drawn = useMemo(
    () => {
      if (!basemap || width <= 0) return null
      try {
        return routeMapSvg({ t, place, stops, legs, near, bbox, basemap: basemap.basemap, bounds, width, height, theme: currentMapTheme(), ...(dir ? { dir } : {}), measure: measureText(12) })
      } catch {
        return null // a map that cannot be drawn is no map; the list stays
      }
    },
    // `tick`: the colours come from the page, not from the arguments
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, place, stops, legs, near, bbox, basemap, bounds, width, height, dir, tick],
  )
  return { setBox: useCallback((el: HTMLElement | null) => setBoxState(el), []), drawn }
}

// ---- the view ----

/** A row of a list of places: a button that adds it, or its grey line when it has no point. */
function PlaceRow({ t, p, here, outside, onAdd }: { t: T; p: PlaceAt; here?: boolean; outside: boolean; onAdd(p: PlaceAt): void }) {
  const text = t('ayudas.mapaLugarEn', { lugar: p.name, cita: citeOfVerse(p.verse) })
  if (p.sure === 0) {
    return (
      <li className="is-none">
        <span className="route-place">
          {text}
          <span className="quiet"> · {t('ayudas.recorridoSinPunto')}</span>
        </span>
      </li>
    )
  }
  return (
    <li className={here ? 'is-here' : undefined}>
      <button type="button" className="route-place" onClick={() => onAdd(p)}>
        <span>
          {text}
          {outside && <span className="quiet"> · {t('ayudas.mapaFuera')}</span>}
        </span>
      </button>
    </li>
  )
}

/** The sheet's content: the map, the route with its legs and total, the chapter's places, the book's, and the credit. */
export function PlaceSheetView({
  t,
  language,
  state,
  dir,
  map,
  setBox,
  onMapClick,
  stops,
  notice,
  book,
  bookOpen,
  onAdd,
  onRemove,
  onClear,
  onBook,
}: {
  t: T
  /** The app's language, for the way numbers are written. */
  language: string
  state: PlaceMapState
  dir?: 'ltr' | 'rtl'
  /** What was drawn, or null while it is drawn. */
  map: RouteDrawn | null
  setBox?(el: HTMLElement | null): void
  onMapClick?(e: MouseEvent<HTMLElement>): void
  stops: readonly PlaceAt[]
  /** «Ya es la última parada». */
  notice: boolean
  /** The places of the whole book: undefined while asking, null when they could not be asked. */
  book: readonly PlaceAt[] | null | undefined
  bookOpen: boolean
  onAdd(p: PlaceAt): void
  onRemove(index: number): void
  onClear(): void
  onBook(open: boolean): void
}) {
  const { place, sources, base } = state.found
  const num = (n: number) => numberIn(language, n)
  const chapter = [place, ...(state.chapter ?? []).filter((p) => p.id !== place.id)]
  const inChapter = new Set(chapter.map((p) => p.id))
  const others = (book ?? []).filter((p) => !inChapter.has(p.id))
  const outside = (p: PlaceAt) => p.sure > 0 && base !== null && !drawnIn(p, state.bbox)
  const legs = legsOf(stops, state.bbox)
  const total = legs.length > 1 ? totalWords(t, num, totalOf(legs)) : null
  const credited = (sources.length ? sources : ['openbibleinfo/Bible-Geocoding-Data']).map(sourceName).join(', ')
  return (
    <>
      {base && (
        <div className="route-map">
          {map ? (
            <div className="route-map-box" ref={setBox} style={{ height: ROUTE_MAP_HEIGHT }} onClick={onMapClick} dangerouslySetInnerHTML={{ __html: map.svg }} />
          ) : (
            <div className="route-map-box is-waiting" ref={setBox} style={{ height: ROUTE_MAP_HEIGHT }} />
          )}
          {map && <div className="route-map-overlay" dangerouslySetInnerHTML={{ __html: map.overlay }} />}
        </div>
      )}
      <div dir={dir}>
        {place.sure === 1 && <p className="quiet place-map-note">{t('ayudas.mapaDudoso')}</p>}
        <h3>{t('ayudas.recorrido')}</h3>
        {stops.length < 2 && <p className="quiet">{t(stops.length === 0 ? 'ayudas.recorridoToque' : 'ayudas.recorridoToqueOtro')}</p>}
        {stops.length > 0 && (
          <ol className="route-stops">
            {stops.map((p, i) => (
              // the key is the position: the same place may be a stop twice
              <li key={i}>
                <span className="route-stop-n">{t('ayudas.recorridoParada', { n: i + 1 })}</span>
                <span className="route-stop-name">{t('ayudas.mapaLugarEn', { lugar: p.name, cita: citeOfVerse(p.verse) })}</span>
                <button type="button" className="button-quiet route-stop-remove" aria-label={t('ayudas.recorridoQuitarA', { n: i + 1, lugar: p.name })} onClick={() => onRemove(i)}>
                  {t('ayudas.recorridoQuitar')}
                </button>
              </li>
            ))}
          </ol>
        )}
        {notice && (
          <p className="quiet" role="status">
            {t('ayudas.recorridoYaUltima')}
          </p>
        )}
        {legs.length > 0 && (
          <div className="route-legs">
            {legs.map((leg, i) => {
              const words = legWords(t, num, leg)
              return (
                <div key={i} className="route-leg">
                  <p className="route-leg-head">{words.head}</p>
                  {words.lines.map((line) => (
                    <p key={line} className="route-leg-line">
                      {line}
                    </p>
                  ))}
                  {leg.offMap && <p className="quiet route-leg-line">{t('ayudas.recorridoFueraTramo')}</p>}
                </div>
              )
            })}
            {total && (
              <div className="route-leg route-total">
                <p className="route-leg-head">{total.head}</p>
                {total.lines.map((line) => (
                  <p key={line} className="route-leg-line">
                    {line}
                  </p>
                ))}
              </div>
            )}
            <p className="quiet">{t('ayudas.recorridoLinea')}</p>
          </div>
        )}
        {stops.length > 0 && (
          <button type="button" className="button-secondary route-clear" onClick={onClear}>
            {t('ayudas.recorridoBorrar')}
          </button>
        )}
        <h3>{t('ayudas.mapaLugares')}</h3>
        <ul className="route-places">
          {chapter.map((p) => (
            <PlaceRow key={p.id} t={t} p={p} here={p.id === place.id} outside={outside(p)} onAdd={onAdd} />
          ))}
        </ul>
        <details className="route-book" open={bookOpen} onToggle={(e) => onBook(e.currentTarget.open)}>
          <summary>{t('ayudas.recorridoLibro')}</summary>
          {book === undefined ? (
            <p className="quiet">{t('ayudas.recorridoLibroBuscando')}</p>
          ) : others.length === 0 ? (
            <p className="quiet">{t('ayudas.recorridoLibroNada')}</p>
          ) : (
            <ul className="route-places">
              {others.map((p) => (
                <PlaceRow key={p.id} t={t} p={p} outside={outside(p)} onAdd={onAdd} />
              ))}
            </ul>
          )}
        </details>
        <p className="quiet place-map-credit">{t('ayudas.mapaCredito', { fuentes: credited })}</p>
      </div>
    </>
  )
}

/**
 * The big sheet: the map and the route. The route (`stops`) and the bounds that frame the map live here: the bounds
 * start as the place, the chapter's places the map draws and the 150 km corners, and only grow when a stop falls
 * outside the frame, so the map never jumps back.
 */
export function PlaceSheet({ data, state, dir, onClose }: { data: PrototypeData; state: PlaceMapState; dir?: 'ltr' | 'rtl'; onClose(): void }) {
  const t = useT()
  const { language } = useI18n()
  const { place, base } = state.found
  const [stops, setStops] = useState<PlaceAt[]>([])
  const [extra, setExtra] = useState<LatLon[]>([])
  const [notice, setNotice] = useState(false)
  const [bookOpen, setBookOpen] = useState(false)
  const near = useMemo(() => neighbours(place, state.chapter ?? [], state.bbox, 1000), [place, state])
  const bounds = useMemo(() => [...sheetBounds(place, near), ...extra], [place, near, extra])
  const legs = useMemo(() => legsOf(stops, state.bbox), [stops, state.bbox])
  const { setBox, drawn } = useRouteMap({ place, stops, legs, near, bbox: state.bbox, basemap: base, bounds, height: ROUTE_MAP_HEIGHT, ...(dir ? { dir } : {}) })
  const book = useLookup<PlaceAt[]>(bookOpen, data.language, `book|${data.book.id}`, (reader) => bookPlaces(reader, data.book.id))

  const add = (p: PlaceAt) => {
    if (!canAdd(stops, p)) {
      setNotice(p.sure > 0)
      return
    }
    setNotice(false)
    setStops([...stops, p])
    // a stop the frame does not show widens the bounds (they are never narrowed)
    if (drawnIn(p, state.bbox) && drawn) {
      const at = { lat: p.lat!, lon: p.lon! }
      if (growBounds(bounds, at, drawn.frame, LABEL_MARGIN) !== bounds) setExtra((e) => [...e, at])
    }
  }
  const onMapClick = (e: MouseEvent<HTMLElement>) => {
    if (!drawn) return
    const box = e.currentTarget.getBoundingClientRect()
    const hit = nearestStop(drawn.frame, drawn.points, e.clientX - box.left, e.clientY - box.top)
    if (!hit) return
    const known = [place, ...(state.chapter ?? []), ...(book ?? []), ...stops].find((p) => p.id === hit.id)
    if (known) add(known)
  }
  return (
    <Sheet title={t('ayudas.mapaTitulo', { lugar: place.name })} onClose={onClose}>
      <PlaceSheetView
        t={t}
        language={language}
        state={state}
        dir={dir}
        map={drawn}
        setBox={setBox}
        onMapClick={onMapClick}
        stops={stops}
        notice={notice}
        book={bookOpen ? book : undefined}
        bookOpen={bookOpen}
        onAdd={add}
        onRemove={(i) => {
          setNotice(false)
          setStops(stops.filter((_, j) => j !== i))
        }}
        onClear={() => {
          setNotice(false)
          setStops([])
        }}
        onBook={setBookOpen}
      />
    </Sheet>
  )
}
