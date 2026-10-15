/**
 * The frame every mini app sits in (philosophy, principle 10): the header with «‹», the passage, who is working and
 * the saving state; the position line («Tito 1:3 · 3 de 16 ‹ ›»); the mini app's center; its one filled button; and
 * the helps panel under the verse. The mini app draws only its center.
 */

import { useCallback, useMemo, useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { useT } from '../i18n/i18n'
import type { MiniApp, MiniAppContext, Position } from '../miniapps/contract'
import { HelpsPanel } from './HelpsPanel'
import { MenuRow, Sheet } from './Sheet'

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
  const onMark = useCallback((w: string | null) => setMarked(w), [])

  const text = data.texts.find((x) => x.abbreviation === textAbbreviation) ?? data.texts[0]
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
        const other = data.texts.find((x) => x.abbreviation !== text.abbreviation)
        if (other) onTextAbbreviation(other.abbreviation)
      },
      showChapter: () => setChapter(true),
    },
  }
  const Center = app.Center

  return (
    <div className="screen">
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onBack}>
          ‹ {t('marco.volver')}
        </button>
        <div className="header-title">
          <span className="header-app">{t(`${app.id}.nombre`)}</span>
          <span className="header-person">
            {t('marco.trabaja', { nombre: person })}
            {app.writes && ` · ${t('marco.guardadoAqui')}`}
          </span>
        </div>
        <button type="button" className="button-quiet" onClick={() => setMore(true)}>
          {t('marco.mas')}
        </button>
      </header>

      <nav className="position" aria-label={passage}>
        <button type="button" className="button-quiet position-arrow" aria-label={t('marco.anterior')} disabled={at <= 0} onClick={() => onPosition({ ...position, verse: verses[at - 1] })}>
          ‹
        </button>
        <button type="button" className="position-label" onClick={() => setVerseList(true)}>
          <strong>{passage}</strong> · {t('marco.posicion', { n: at + 1, total: verses.length })}
        </button>
        <button type="button" className="button-quiet position-arrow" aria-label={t('marco.siguiente')} disabled={at >= verses.length - 1} onClick={() => onPosition({ ...position, verse: verses[at + 1] })}>
          ›
        </button>
      </nav>

      <main className="main">
        <Center context={context} />
        {app.primary && (
          <button type="button" className="button-primary" onClick={() => app.primary!.run(context)}>
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
