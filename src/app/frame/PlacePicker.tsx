/**
 * Where to go in the book: the chapters, then the verses (or sections) of the one chosen, as a Bible app or
 * translationCore 4's chapter grid does, from the reference the person touches. Each chapter says how far the work
 * has gone and who did it, and each verse whether it is done and by whom: a team may split a book by chapters, by
 * sections or by verses, so what each one did shows at every grain.
 */

import { useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { useT, type T } from '../i18n/i18n'
import { BOOK_INTRO, CHAPTER_INTRO, type MiniApp, type Unit } from '../miniapps/contract'
import { authorOf, workOf } from '../projects/work'
import { Sheet } from './Sheet'

/** The stops of a chapter: its verses, or its sections; first its introductions, for a mini app that reads them. */
export function stopsOf(data: PrototypeData, unit: Unit, intros = false): number[][] {
  const body = unit === 'section' && data.sections.length ? data.sections : data.verses.map((v) => [v.verse])
  if (!intros) return body
  return [...(data.bookIntro ? [[BOOK_INTRO]] : []), ...(data.intro ? [[CHAPTER_INTRO]] : []), ...body]
}

export const rangeOf = (s: number[]) => (s.length > 1 ? `${s[0]}–${s[s.length - 1]}` : String(s[0]))

/** A stop as a list cell says it: «4–5», «Intro.», «Libro». */
export const stopLabel = (s: number[], t: T) =>
  s[0] === BOOK_INTRO ? t('marco.introLibroCorta') : s[0] === CHAPTER_INTRO ? t('marco.introCapituloCorta') : rangeOf(s)

/** A stop as the position line says it: «Jonás 2:3–4», «Jonás 2 · Introducción». */
export const passageOf = (book: string, chapter: number, s: number[], t: T) =>
  s[0] === BOOK_INTRO
    ? `${book} · ${t('marco.introLibro')}`
    : s[0] === CHAPTER_INTRO
      ? `${book} ${chapter} · ${t('marco.introCapitulo')}`
      : `${book} ${chapter}:${rangeOf(s)}`

const initials = (name: string) => name.slice(0, 1).toUpperCase()

export function PlacePicker({
  app,
  bookName,
  bookId,
  chapters,
  dataOf,
  chapter,
  verse,
  unit,
  onUnit,
  onGo,
  onClose,
}: {
  app: MiniApp
  bookName: string
  bookId: string
  chapters: number[]
  dataOf(chapter: number): PrototypeData | null
  chapter: number
  verse: number
  unit: Unit
  /** For a mini app that also works by sections: choose a verse or a section at a time, here where the place is chosen. */
  onUnit?(unit: Unit): void
  onGo(chapter: number, verse: number): void
  onClose(): void
}) {
  const t = useT()
  const [open, setOpen] = useState(chapter)
  const data = dataOf(open)
  const stops = data ? stopsOf(data, unit, app.intros) : []
  const doneIn = (c: number, verses: number[]) =>
    app.done && verses[0] > 0 ? verses.filter((v) => app.done!({ book: bookId, chapter: c, verse: v })).length : null

  return (
    <Sheet title={bookName} onClose={onClose}>
      {onUnit && (
        <div className="unit-switch" role="radiogroup" aria-label={t('marco.verPor')}>
          {(['verse', 'section'] as const).map((u) => (
            <button key={u} type="button" role="radio" aria-checked={unit === u} className="unit-switch-option" onClick={() => onUnit(u)}>
              {t(u === 'verse' ? 'marco.porVersiculo' : 'marco.porSeccion')}
            </button>
          ))}
        </div>
      )}
      <h3 className="picker-heading">{t('marco.capitulos')}</h3>
      <div className="chapter-grid">
        {chapters.map((c) => {
          const d = dataOf(c)
          const verses = d?.verses.map((v) => v.verse) ?? []
          const done = doneIn(c, verses)
          const people = app.writes ? workOf(bookId, c, verses).people : []
          return (
            <button
              key={c}
              type="button"
              className={c === open ? 'chapter-cell is-open' : 'chapter-cell'}
              aria-current={c === chapter}
              aria-pressed={c === open}
              onClick={() => setOpen(c)}
            >
              <span className="chapter-cell-number">{c}</span>
              {done !== null && (
                <span className="chapter-cell-done">{t('marco.hechosDe', { hechos: done, total: verses.length })}</span>
              )}
              {people.length > 0 && <span className="chapter-cell-people">{people.map(([name]) => name).join(', ')}</span>}
            </button>
          )
        })}
      </div>

      <h3 className="picker-heading">
        {t(unit === 'section' ? 'marco.seccionesDe' : 'marco.versiculosDe', { libro: bookName, capitulo: open })}
      </h3>
      <div className={unit === 'section' ? 'verse-grid is-sections' : 'verse-grid'}>
        {stops.map((s) => {
          const here = open === chapter && s.includes(verse)
          const done = doneIn(open, s)
          const writers = s[0] > 0 && app.writes ? s.map((v) => authorOf(bookId, open, v)) : []
          const by = [...new Set(writers.filter((x): x is string => Boolean(x)))]
          const state = done === null ? '' : done === s.length ? ' is-done' : done > 0 ? ' is-some' : ''
          return (
            <button
              key={s[0]}
              type="button"
              className={`verse-cell${here ? ' is-current' : ''}${state}`}
              aria-current={here}
              title={by.join(', ') || undefined}
              onClick={() => onGo(open, s[0])}
            >
              {stopLabel(s, t)}
              {by.length > 0 && <span className="verse-cell-by">{by.map(initials).join('')}</span>}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
