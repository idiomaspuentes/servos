/**
 * The frame every mini app sits in (philosophy, principle 10): the header with «‹», the passage, who is working and
 * the saving state; the position line («Tito 1:3 · 3 de 16 ‹ ›»); the mini app's center; its one filled button; and
 * the helps panel under the verse. The mini app draws only its center.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { useT } from '../i18n/i18n'
import { useProjectFont } from './fonts'
import type { MiniApp, MiniAppContext, Position, Unit } from '../miniapps/contract'
import { HelpsPanel } from './HelpsPanel'
import { keepFocus } from './Panes'
import { PlacePicker, passageOf, stopsOf } from './PlacePicker'
import { MenuRow, Sheet } from './Sheet'

/**
 * The part of the page the person sees: with the keyboard up, the visual viewport is what is left above it. The
 * layout viewport keeps its height on most phones, so a screen sized by it would go on under the keyboard.
 *
 * Whether the keyboard is up is told by the height lost against the tallest seen at this width: some phones shrink
 * the layout viewport with the visual one, so comparing the two says nothing there.
 */
function useVisibleBox(on: boolean): { style: CSSProperties | undefined; keyboard: boolean } {
  const [box, setBox] = useState<{ top: number; height: number; keyboard: boolean } | null>(null)
  useEffect(() => {
    if (!on) return
    const view = window.visualViewport
    let tallest = { width: 0, height: 0 }
    const update = () => {
      const width = view?.width ?? window.innerWidth
      const height = view?.height ?? window.innerHeight
      if (Math.abs(width - tallest.width) > 1 || height > tallest.height) tallest = { width, height }
      setBox({ top: view?.offsetTop ?? 0, height, keyboard: tallest.height - height > 120 })
    }
    update()
    view?.addEventListener('resize', update)
    view?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      view?.removeEventListener('resize', update)
      view?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [on])
  return { style: on && box ? { top: box.top, height: box.height } : undefined, keyboard: Boolean(on && box?.keyboard) }
}

export function MiniAppScreen({
  app,
  data,
  person,
  project,
  bookTitle,
  position,
  onPosition,
  textAbbreviation,
  onTextAbbreviation,
  onBack,
  backLabel,
  chapters,
  dataOf,
  onOpenApp,
}: {
  app: MiniApp
  /** The chapter open. */
  data: PrototypeData
  /** The chapters of the book on this device, and each one's texts and helps. */
  chapters: number[]
  dataOf(chapter: number): PrototypeData | null
  person: string
  project: MiniAppContext['project']
  /** The book's name as the team says it. */
  bookTitle?: string
  position: Position
  onPosition(p: Position): void
  textAbbreviation: string
  onTextAbbreviation(a: string): void
  onBack(): void
  /** What the back arrow says, when it goes back to another mini app rather than to the book. */
  backLabel?: string
  onOpenApp(appId: string, at: Position): void
}) {
  const t = useT()
  const [marked, setMarked] = useState<string | null>(null)
  const [verseList, setVerseList] = useState(false)
  const [more, setMore] = useState(false)
  const [redrawn, setRedrawn] = useState(0)
  const [chapter, setChapter] = useState(false)
  const [saved, setSaved] = useState<'sinCambios' | 'guardado'>('sinCambios')
  const onMark = useCallback((w: string | null) => setMarked(w), [])
  const { style: box, keyboard } = useVisibleBox(Boolean(app.fills))
  // Moving on keeps the box being written in focused, and so the keyboard up.
  const keep = app.fills ? keepFocus : undefined

  // The bridge text shown is TPL or TPS; the original is a pane of its own where a mini app wants it.
  const text = data.texts.find((x) => x.abbreviation === textAbbreviation && !x.original) ?? data.texts[0]
  const verseTexts = useMemo(() => {
    const map = new Map<number, string>()
    for (const piece of text.pieces) if (piece.kind === 'paragraph') for (const v of piece.verses) map.set(v.verse, v.text)
    return map
  }, [text])
  // A verse or a section at a time, as the person chose for this mini app: the arrows, the list and «n of total» go by it.
  const unitKey = `servos.prototipo.unidad.${app.id}`
  const [unit, setUnitState] = useState<Unit>(() => {
    if (!app.sections) return 'verse'
    try {
      const chosen = localStorage.getItem(unitKey)
      return chosen === 'section' || chosen === 'verse' ? chosen : app.unit
    } catch {
      return app.unit
    }
  })
  const setUnit = (next: Unit) => {
    setUnitState(next)
    try {
      localStorage.setItem(unitKey, next)
    } catch {
      /* chosen for this visit */
    }
  }
  const stops = stopsOf(data, unit, app.intros)
  const at = Math.max(0, stops.findIndex((s) => s.includes(position.verse)))
  const shown = stops[at] ?? [position.verse]
  const goStop = (index: number) => onPosition({ ...position, verse: stops[index][0] })
  const title = bookTitle ?? data.book.name
  const passage = passageOf(title, position.chapter, shown, t)
  // A place another mini app left (an introduction, where this one has none) becomes this one's first stop.
  const lost = !stops.some((s) => s.includes(position.verse))
  useEffect(() => {
    if (lost && stops[0]) onPosition({ ...position, verse: stops[0][0] })
  }, [lost]) // eslint-disable-line react-hooks/exhaustive-deps

  // The arrows go on past the chapter's end into the next one (and back): a chapter is not a wall, and the person is
  // told in passing that a new one began, so they do not lose their place.
  const chapterAt = chapters.indexOf(position.chapter)
  const before = chapterAt > 0 ? chapters[chapterAt - 1] : null
  const after = chapterAt >= 0 && chapterAt < chapters.length - 1 ? chapters[chapterAt + 1] : null
  const [crossed, setCrossed] = useState<number | null>(null)
  useEffect(() => {
    if (crossed === null) return
    const done = window.setTimeout(() => setCrossed(null), 2500)
    return () => window.clearTimeout(done)
  }, [crossed])
  const cross = (chapter: number, last: boolean) => {
    const next = dataOf(chapter)
    if (!next) return
    const s = stopsOf(next, unit, app.intros)
    onPosition({ ...position, chapter, verse: (last ? s[s.length - 1] : s[0])[0] })
    setCrossed(chapter)
  }
  const previous = () => (at > 0 ? goStop(at - 1) : before !== null && cross(before, true))
  const following = () => (at < stops.length - 1 ? goStop(at + 1) : after !== null && cross(after, false))
  const atStart = at <= 0 && before === null
  const atEnd = at >= stops.length - 1 && after === null

  const context: MiniAppContext = {
    bookTitle: title,
    t,
    person: { name: person },
    project,
    data,
    textAbbreviation: text.abbreviation,
    verseText: (v) => verseTexts.get(v) ?? '',
    position,
    goTo: onPosition,
    unit,
    shown,
    chapters,
    chapterData: dataOf,
    marked,
    frame: {
      switchText: () => {
        const other = data.texts.find((x) => x.abbreviation !== text.abbreviation && !x.original)
        if (other) onTextAbbreviation(other.abbreviation)
      },
      showChapter: () => setChapter(true),
      helps: (verses, options) => (
        <HelpsPanel
          data={data}
          verse={position.verse}
          verses={verses}
          comments={options?.comments ?? true}
          glossary={options?.glossary}
          textAbbreviation={text.abbreviation}
          onMark={onMark}
        />
      ),
      setSaved,
      setUnit,
      // At the book's last verse the way on is back to the book: a button that does nothing is not offered.
      next: backLabel || atEnd ? onBack : following,
      atEnd: atEnd && !backLabel,
      back: onBack,
      open: onOpenApp,
    },
  }
  const Center = app.Center
  // The actions of «More» offered where the person is.
  const offered = (app.more ?? []).filter((action) => !action.when || action.when(context))
  useProjectFont(project.font)

  return (
    // While writing on a phone the header and the filled button step aside: the keyboard leaves room for little more
    // than the box and the text it translates, and the arrows of the position line still move on.
    <div className={`screen screen-app${app.fills ? ' screen-fill' : ''}${app.fills && keyboard ? ' is-writing' : ''}`} style={box}>
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onBack}>
          {/* Where it goes back to: the mini app it was opened from, or the book. */}
          ‹ {backLabel ?? title}
        </button>
        <div className="header-title">
          <span className="header-app">{t(`${app.id}.nombre`)}</span>
          <span className="header-person">
            {person}
            {app.writes && ` · ${t(saved === 'guardado' ? 'marco.guardadoAqui' : 'marco.sinCambios')}`}
          </span>
        </div>
        {/* «More» only when the mini app has something there: an empty or make-believe menu is not offered. */}
        {offered.length ? (
          <button type="button" className="button-quiet" onClick={() => setMore(true)}>
            {t('marco.mas')}
          </button>
        ) : (
          <span />
        )}
      </header>

      {app.positionLine !== false && (
        <nav className="position" aria-label={passage}>
          <button type="button" className="pager-arrow position-arrow" aria-label={t(unit === 'section' ? 'marco.seccionAnterior' : 'marco.anterior')} disabled={atStart} onPointerDown={keep} onClick={previous}>
            ‹
          </button>
          <button type="button" className="position-label" onClick={() => setVerseList(true)}>
            {/* Which unit it goes by is said, so the person knows there is another (chosen in the sheet this opens). */}
            <strong>{passage}</strong> · {t(app.sections && unit === 'section' && shown[0] > 0 ? 'marco.posicionSeccion' : 'marco.posicion', { n: at + 1, total: stops.length })}
          </button>
          {atEnd && !backLabel ? (
            // At the book's last verse the way on is back to the book: said, where the arrow was.
            <button type="button" className="position-done" onPointerDown={keep} onClick={onBack}>
              {t('marco.listo')}
            </button>
          ) : (
            <button type="button" className="pager-arrow position-arrow" aria-label={t(unit === 'section' ? 'marco.seccionSiguiente' : 'marco.siguiente')} disabled={atEnd} onPointerDown={keep} onClick={following}>
              ›
            </button>
          )}
        </nav>
      )}
      <p className="position-crossed" role="status" aria-live="polite">
        {crossed !== null && <span>{t('marco.capituloNuevo', { libro: title, capitulo: crossed })}</span>}
      </p>

      <main className={app.fills ? 'main main-fill' : 'main'}>
        {/* Drawn anew after an action of «More» changed what it shows (verses joined). */}
        <Center key={redrawn} context={context} />
        {/* One way on: a button that only leads to the next verse is the position line's arrow, not a second way. */}
        {app.primary && (!app.primary.nextOnly || (backLabel && app.primary.returning)) && (
          <button type="button" className="button-primary" onPointerDown={keep} onClick={() => app.primary!.run(context)}>
            {backLabel && app.primary.returning
              ? t(app.primary.returning, { app: backLabel })
              : atEnd
                ? t('marco.listoVolver', { libro: title })
                : t(app.primary.label)}
          </button>
        )}
        {app.helps && <HelpsPanel data={data} verse={position.verse} textAbbreviation={text.abbreviation} onMark={onMark} />}
      </main>

      {verseList && (
        <PlacePicker
          app={app}
          bookName={title}
          bookId={data.book.id}
          chapters={chapters}
          dataOf={dataOf}
          chapter={position.chapter}
          verse={position.verse}
          unit={unit}
          onUnit={app.sections ? setUnit : undefined}
          onGo={(chapter, verse) => {
            onPosition({ ...position, chapter, verse })
            setVerseList(false)
          }}
          onClose={() => setVerseList(false)}
        />
      )}

      {more && (
        <Sheet title={t('marco.mas')} onClose={() => setMore(false)}>
          {offered.map((action) => (
            <MenuRow
              key={action.label}
              label={t(action.label)}
              description={action.description ? t(action.description) : undefined}
              onClick={() => {
                setMore(false)
                action.run(context)
                setRedrawn((n) => n + 1)
              }}
            />
          ))}
        </Sheet>
      )}

      {chapter && (
        <Sheet title={`${title} ${position.chapter} · ${text.abbreviation}`} onClose={() => setChapter(false)}>
          {text.pieces.map((piece, i) =>
            piece.kind === 'heading' ? (
              <h3 key={i}>{piece.text}</h3>
            ) : (
              <p key={i} className="chapter-paragraph">
                {piece.verses.map((v) => (
                  <span key={v.verse}>
                    <sup>{v.verse}</sup> {v.text}{' '}
                  </span>
                ))}
              </p>
            )
          )}
        </Sheet>
      )}
    </div>
  )
}
