/**
 * The map of a place, in the word card (design: «El mapa de un lugar»). When the word touched is a place the verse
 * names (a `tw` article joined to a `lug:` of `xtopics`), the card's help «palabra» shows its map between the quote and
 * «Leer sobre…»: a strip with no box of its own, drawn on this device by `drawMap` over the basemap, the place as a full
 * dot with its name and up to six places of the chapter in grey. «Ver el mapa grande ›» opens the chapter's places in a
 * sheet (`RouteSheet.tsx`). Without the basemap only a quiet line says so; without a place, nothing.
 *
 * `usePlaceMap` asks, `PlaceMapView` only shows, and `placeMapSvg` is the drawing, pure.
 */

import { useCallback, useMemo, useState } from 'react'
import { drawMap, type PlaceAt, type Theme } from '@bt-synergy/language-pack-client'
import type { PrototypeData } from '../../prototype/data'
import { basemapV3, type BasemapHere } from '../../resources/v3/basemapV3'
import { chapterPlaces, mapFrame, mapPoints, neighbours, NEIGHBOURS_IN_CARD, placeOfWord, verseIdV3, type Bbox } from '../../resources/v3/placesV3'
import { useT, type T } from '../i18n/i18n'
import { useLookup, useMapHere } from './acrossBooks'
import { currentMapTheme, measureText } from './mapTheme'
import { PlaceSheet } from './RouteSheet'
import { useBoxWidth, useThemeTick } from './useMapBox'

/** The real basemap's box (8 to 52 east, 22 to 43 north), for finding the place before the basemap is known to be here. */
export const DEFAULT_BBOX: Bbox = [800, 2200, 5200, 4300]
/** The card's strip is 180 px high. */
export const CARD_HEIGHT = 180

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
    // The place first, on the real basemap's box: most words are not places, and only a place waits for the basemap.
    const word = await placeOfWord(reader, { kind: 'tw', path: article }, verseIdV3(data.book.id, data.chapter, verse), DEFAULT_BBOX)
    if (!word) return null
    const base = await basemapV3(data.language)
    return { ...word, base }
  })
  const chapter = useLookup<PlaceAt[]>(Boolean(found), data.language, `chapter|${data.book.id}|${data.chapter}`, (reader) => chapterPlaces(reader, data.book.id, data.chapter))
  const state = useMemo(
    () => (found ? { found, chapter: chapter ?? undefined, bbox: found.base?.basemap.bbox ?? DEFAULT_BBOX } : null),
    [found, chapter],
  )
  if (!here || found === undefined) return undefined
  return state
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
  const width = useBoxWidth(box)
  const tick = useThemeTick()
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
