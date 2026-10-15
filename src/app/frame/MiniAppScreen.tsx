/**
 * The frame every mini app sits in (philosophy, principle 10): the header with «‹», the passage, who is working and
 * the saving state; the position line («Tito 1:3 · 3 de 16 ‹ ›»); the mini app's center; its one filled button; and
 * the helps panel under the verse. The mini app draws only its center.
 */

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { useT } from '../i18n/i18n'
import type { MiniApp, MiniAppContext, Position } from '../miniapps/contract'
import { HelpsPanel } from './HelpsPanel'
import { keepFocus } from './Panes'
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
  position,
  onPosition,
  textAbbreviation,
  onTextAbbreviation,
  onBack,
}: {
  app: MiniApp
  data: PrototypeData
  person: string
  position: Position
  onPosition(p: Position): void
  textAbbreviation: string
  onTextAbbreviation(a: string): void
  onBack(): void
}) {
  const t = useT()
  const [marked, setMarked] = useState<string | null>(null)
  const [verseList, setVerseList] = useState(false)
  const [more, setMore] = useState(false)
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
  const verses = data.verses.map((v) => v.verse)
  const at = verses.indexOf(position.verse)
  const passage = `${data.book.name} ${position.chapter}:${position.verse}`

  const context: MiniAppContext = {
    t,
    person: { name: person },
    data,
    textAbbreviation: text.abbreviation,
    verseText: (v) => verseTexts.get(v) ?? '',
    position,
    goTo: onPosition,
    marked,
    frame: {
      switchText: () => {
        const other = data.texts.find((x) => x.abbreviation !== text.abbreviation && !x.original)
        if (other) onTextAbbreviation(other.abbreviation)
      },
      showChapter: () => setChapter(true),
      helps: () => <HelpsPanel data={data} verse={position.verse} textAbbreviation={text.abbreviation} onMark={onMark} />,
      setSaved,
    },
  }
  const Center = app.Center

  return (
    // While writing on a phone the header and the filled button step aside: the keyboard leaves room for little more
    // than the box and the text it translates, and the arrows of the position line still move on.
    <div className={app.fills ? (keyboard ? 'screen screen-fill is-writing' : 'screen screen-fill') : 'screen'} style={box}>
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onBack}>
          ‹ {t('marco.volver')}
        </button>
        <div className="header-title">
          <span className="header-app">{t(`${app.id}.nombre`)}</span>
          <span className="header-person">
            {t('marco.trabaja', { nombre: person })}
            {app.writes && ` · ${t(saved === 'guardado' ? 'marco.guardadoAqui' : 'marco.sinCambios')}`}
          </span>
        </div>
        <button type="button" className="button-quiet" onClick={() => setMore(true)}>
          {t('marco.mas')}
        </button>
      </header>

      <nav className="position" aria-label={passage}>
        <button type="button" className="button-quiet position-arrow" aria-label={t('marco.anterior')} disabled={at <= 0} onPointerDown={keep} onClick={() => onPosition({ ...position, verse: verses[at - 1] })}>
          ‹
        </button>
        <button type="button" className="position-label" onClick={() => setVerseList(true)}>
          <strong>{passage}</strong> · {t('marco.posicion', { n: at + 1, total: verses.length })}
        </button>
        <button type="button" className="button-quiet position-arrow" aria-label={t('marco.siguiente')} disabled={at >= verses.length - 1} onPointerDown={keep} onClick={() => onPosition({ ...position, verse: verses[at + 1] })}>
          ›
        </button>
      </nav>

      <main className={app.fills ? 'main main-fill' : 'main'}>
        <Center context={context} />
        {app.primary && (
          <button type="button" className="button-primary" onPointerDown={keep} onClick={() => app.primary!.run(context)}>
            {t(app.primary.label)}
          </button>
        )}
        {app.helps && <HelpsPanel data={data} verse={position.verse} textAbbreviation={text.abbreviation} onMark={onMark} />}
      </main>

      {verseList && (
        <Sheet title={t('marco.listaVersiculos', { libro: data.book.name, capitulo: position.chapter })} onClose={() => setVerseList(false)}>
          <p className="quiet">{t('marco.listaVersiculosAyuda')}</p>
          <div className="verse-grid">
            {verses.map((v) => (
              <button
                key={v}
                type="button"
                className={v === position.verse ? 'verse-cell is-current' : 'verse-cell'}
                aria-current={v === position.verse}
                onClick={() => {
                  onPosition({ ...position, verse: v })
                  setVerseList(false)
                }}
              >
                {v}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {more && (
        <Sheet title={t('marco.mas')} onClose={() => setMore(false)}>
          {app.more?.map((action) => (
            <MenuRow
              key={action.label}
              label={t(action.label)}
              description={action.description ? t(action.description) : undefined}
              onClick={() => {
                setMore(false)
                action.run(context)
              }}
            />
          ))}
        </Sheet>
      )}

      {chapter && (
        <Sheet title={`${data.book.name} ${position.chapter} · ${text.abbreviation}`} onClose={() => setChapter(false)}>
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
