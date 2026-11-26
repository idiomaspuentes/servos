/**
 * The map of a place, in the word card (design: «El mapa de un lugar»). When the word touched is a place the verse
 * names (a `tw` article joined to a `lug:` of `xtopics`), the card's help «palabra» shows its map between the quote and
 * «Leer sobre…»: a strip with no box of its own, drawn on this device by `drawMap` over the basemap, the place as a full
 * dot with its name and up to six places of the chapter in grey. «Ver el mapa grande ›» opens the chapter's places in a
 * sheet. Without the basemap only a quiet line says so; without a place, nothing.
 *
 * `usePlaceMap` asks, `PlaceMapView` and `PlaceSheetView` only show, and `placeMapSvg` is the drawing, pure.
 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { drawMap, type PlaceAt, type Theme } from '@bt-synergy/language-pack-client'
import type { PrototypeData } from '../../prototype/data'
import { basemapV3, type BasemapHere } from '../../resources/v3/basemapV3'
import { chapterPlaces, mapFrame, mapPoints, neighbours, NEIGHBOURS_IN_CARD, placeOfWord, verseIdV3, type Bbox } from '../../resources/v3/placesV3'
import { useT, type T } from '../i18n/i18n'
import { useLookup, useMapHere } from './acrossBooks'
import { currentMapTheme, measureText } from './mapTheme'
import { Sheet } from './Sheet'

/** The real basemap's box (8 to 52 east, 22 to 43 north), for finding the place before the basemap is known to be here. */
export const DEFAULT_BBOX: Bbox = [800, 2200, 5200, 4300]
/** The card's strip is 180 px high; the sheet's map 360. */
export const CARD_HEIGHT = 180
export const SHEET_HEIGHT = 360

/** What is known of the place a word is. */
export type PlaceFound = { place: PlaceAt; sources: string[]; base: BasemapHere | null }
export type PlaceMapState = { found: PlaceFound; chapter: PlaceAt[] | undefined; bbox: Bbox }

/** The names the summary says: the place and its references. */
const summaryOf = (t: T, place: PlaceAt, near: readonly PlaceAt[]): string =>
  near.length ? t('ayudas.mapaResumen', { lugar: place.name, otros: near.map((p) => p.name).join(', ') }) : t('ayudas.mapaResumenSolo', { lugar: place.name })

/** The SVG of the map: the place and its neighbours over the basemap, framed so that about 300 km are seen around it. */
export function placeMapSvg(o: {
  t: T
  place: PlaceAt
  near: readonly PlaceAt[]
  basemap: BasemapHere['basemap']
  width: number
  height: number
  theme: Theme
  dir?: 'ltr' | 'rtl'
  measure?: (text: string) => number
}): string {
  return drawMap({
    points: mapPoints(o.place, o.near),
    basemap: o.basemap,
    frame: mapFrame(o.place, o.near, o.width, o.height),
    theme: o.theme,
    ...(o.dir ? { dir: o.dir } : {}),
    summary: summaryOf(o.t, o.place, o.near),
    ...(o.measure ? { measure: o.measure } : {}),
    fontSize: 12,
  })
}

/** Asks which place the word is and, when it is one, the places of its chapter. Undefined while asking, null for none. */
export function usePlaceMap(data: PrototypeData, article: string, verse: number): PlaceMapState | null | undefined {
  const here = useMapHere(data.language, 'xtopics')
  const where = `${data.book.id}|${data.chapter}|${verse}`
  const found = useLookup<PlaceFound | null>(here, data.language, `place|${article}|${where}`, async (reader) => {
    const base = await basemapV3(data.language)
    const bbox = base?.basemap.bbox ?? DEFAULT_BBOX
    const word = await placeOfWord(reader, { kind: 'tw', path: article }, verseIdV3(data.book.id, data.chapter, verse), bbox)
    return word ? { ...word, base } : null
  })
  const chapter = useLookup<PlaceAt[]>(Boolean(found), data.language, `chapter|${data.book.id}|${data.chapter}`, (reader) => chapterPlaces(reader, data.book.id, data.chapter))
  const state = useMemo(
    () => (found ? { found, chapter: chapter ?? undefined, bbox: found.base?.basemap.bbox ?? DEFAULT_BBOX } : null),
    [found, chapter],
  )
  if (!here || found === undefined) return undefined
  return state
}

/** Counts up when the theme changes (the app's `data-theme`, or the system's scheme): the map is drawn again. */
function useThemeTick(): number {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const bump = () => setTick((n) => n + 1)
    const watcher = new MutationObserver(bump)
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    const scheme = window.matchMedia?.('(prefers-color-scheme: dark)')
    scheme?.addEventListener?.('change', bump)
    return () => {
      watcher.disconnect()
      scheme?.removeEventListener?.('change', bump)
    }
  }, [])
  return tick
}

/**
 * The SVG of a map to put in a box: drawn at the box's width (kept up to date), again when the theme or the language of
 * the app changes. Null until the box is measured and there is a basemap and a place. `setBox` goes on the box.
 */
export function useMapSvg(o: { place: PlaceAt | null; near: readonly PlaceAt[]; basemap: BasemapHere | null; height: number; dir?: 'ltr' | 'rtl' }): {
  setBox(el: HTMLElement | null): void
  svg: string | null
} {
  const t = useT()
  const [box, setBox] = useState<HTMLElement | null>(null)
  const [width, setWidth] = useState(0)
  const tick = useThemeTick()
  useLayoutEffect(() => {
    if (!box) return
    const measure = () => setWidth(Math.round(box.clientWidth))
    measure()
    const watcher = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    watcher?.observe(box)
    return () => watcher?.disconnect()
  }, [box])
  const { place, near, basemap, height, dir } = o
  const svg = useMemo(
    () => {
      if (!place || !basemap || width <= 0) return null
      try {
        return placeMapSvg({ t, place, near, basemap: basemap.basemap, width, height, theme: currentMapTheme(), ...(dir ? { dir } : {}), measure: measureText(12) })
      } catch {
        return null // a map that cannot be drawn is no map; the rest of the card stays
      }
    },
    // `tick`: the colours come from the page, not from the arguments
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, place, near, basemap, width, height, dir, tick],
  )
  return { setBox: useCallback((el: HTMLElement | null) => setBox(el), []), svg }
}

/**
 * The strip of the card, or its quiet line; nothing for no place. `svg` null: the sea-coloured space kept while the
 * map is drawn (it is measured on that box).
 */
export function PlaceMapView({
  t,
  state,
  svg,
  setBox,
  onBig,
}: {
  t: T
  state: PlaceMapState | null | undefined
  svg: string | null
  setBox?(el: HTMLElement | null): void
  onBig(): void
}) {
  if (!state) return null
  const { place, base } = state.found
  if (!base) return <p className="quiet place-map-note">{t('ayudas.mapaNoEsta')}</p>
  return (
    <div className="place-map">
      {svg ? (
        // The row below is the way by keyboard and screen reader; touching the map does the same, for the hand.
        <div className="place-map-svg" ref={setBox} style={{ height: CARD_HEIGHT }} onClick={onBig} dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="place-map-svg is-waiting" ref={setBox} style={{ height: CARD_HEIGHT }} />
      )}
      {place.sure === 1 && <p className="quiet place-map-note">{t('ayudas.mapaDudoso')}</p>}
      <button type="button" className="word-help-read place-map-big" onClick={onBig}>
        {t('ayudas.mapaGrande')} ›
      </button>
    </div>
  )
}

/** A source of the places as the credit names it. */
export const sourceName = (key: string): string =>
  key.startsWith('openbibleinfo/') ? 'OpenBible.info (CC BY 4.0)' : key.startsWith('robertrouse/') ? 'Theographic' : (key.split('/').pop() ?? key)

/** «1:3», where the chapter names a place first. */
const citeOf = (place: PlaceAt, chapter: number): string => `${chapter}:${place.verse % 1000}`

/** The sheet's content: the chapter's map, the list of its places and the credit. */
export function PlaceSheetView({
  t,
  state,
  chapterNumber,
  svg,
  setBox,
  drawn,
}: {
  t: T
  state: PlaceMapState
  chapterNumber: number
  svg: string | null
  setBox?(el: HTMLElement | null): void
  /** The places the map draws; one of the chapter's that it leaves out (too far, off the basemap) is said so. */
  drawn?: ReadonlySet<string>
}) {
  const { place, sources, base } = state.found
  const all = [place, ...(state.chapter ?? []).filter((p) => p.id !== place.id && p.sure > 0)]
  const credited = (sources.length ? sources : ['openbibleinfo/Bible-Geocoding-Data']).map(sourceName).join(', ')
  return (
    <>
      {base &&
        (svg ? (
          <div className="place-map-svg" ref={setBox} style={{ height: SHEET_HEIGHT }} dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="place-map-svg is-waiting" ref={setBox} style={{ height: SHEET_HEIGHT }} />
        ))}
      {place.sure === 1 && <p className="quiet place-map-note">{t('ayudas.mapaDudoso')}</p>}
      <h3>{t('ayudas.mapaLugares')}</h3>
      <ul className="place-map-list">
        {all.map((p) => (
          <li key={p.id} className={p.id === place.id ? 'is-here' : undefined}>
            {t('ayudas.mapaLugarEn', { lugar: p.name, cita: citeOf(p, chapterNumber) })}
            {base && drawn && p.id !== place.id && !drawn.has(p.id) && <span className="quiet"> · {t('ayudas.mapaFuera')}</span>}
          </li>
        ))}
      </ul>
      <p className="quiet place-map-credit">{t('ayudas.mapaCredito', { fuentes: credited })}</p>
    </>
  )
}

/**
 * The map of the place a word is, for its help «palabra». `article` is the key word's path (`bible/names/joppa`), `verse`
 * the verse of the word touched (the bridge text's numbering, which is `xtopics`'), `dir` the touched text's direction.
 */
export function PlaceMap({ data, article, verse, dir }: { data: PrototypeData; article: string; verse: number; dir?: 'ltr' | 'rtl' }) {
  const t = useT()
  const state = usePlaceMap(data, article, verse)
  const [big, setBig] = useState(false)
  const near = useMemo(() => (state ? neighbours(state.found.place, state.chapter ?? [], state.bbox, NEIGHBOURS_IN_CARD) : []), [state])
  const card = useMapSvg({ place: state?.found.place ?? null, near, basemap: state?.found.base ?? null, height: CARD_HEIGHT, ...(dir ? { dir } : {}) })
  // Until the neighbours come, the strip is the sea-coloured space; a map drawn without them would then jump.
  const ready = state?.chapter !== undefined
  return (
    <>
      <PlaceMapView t={t} state={state} svg={ready ? card.svg : null} setBox={card.setBox} onBig={() => setBig(true)} />
      {big && state && <PlaceSheet data={data} state={state} dir={dir} onClose={() => setBig(false)} />}
    </>
  )
}

/** The big sheet: the chapter's places, all those under 1,000 km, with the place touched marked. */
function PlaceSheet({ data, state, dir, onClose }: { data: PrototypeData; state: PlaceMapState; dir?: 'ltr' | 'rtl'; onClose(): void }) {
  const t = useT()
  const near = useMemo(() => neighbours(state.found.place, state.chapter ?? [], state.bbox, 1000), [state])
  const sheet = useMapSvg({ place: state.found.place, near, basemap: state.found.base, height: SHEET_HEIGHT, ...(dir ? { dir } : {}) })
  return (
    <Sheet title={t('ayudas.mapaTitulo', { lugar: state.found.place.name })} onClose={onClose}>
      <div dir={dir}>
        <PlaceSheetView t={t} state={state} chapterNumber={data.chapter} svg={sheet.svg} setBox={sheet.setBox} drawn={new Set(near.map((p) => p.id))} />
      </div>
    </Sheet>
  )
}
