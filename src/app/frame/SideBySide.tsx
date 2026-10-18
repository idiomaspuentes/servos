/**
 * The texts of the chapter side by side, on a computer (philosophy, principle 13; the design in `parallel.ts`). Each
 * text's name is a switch: on, its text is a column; one more is added beside with a click, up to `max`. With one on,
 * the mini app draws it as it always has (`single`); with two or more, one row per verse, the verses open as one band
 * across, a touched word lit in every text that translates the same words of the original, and its helps under the
 * row. What was chosen is kept on this device, for each mini app.
 */

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { PrototypeText } from '../../prototype/data'
import { useT } from '../i18n/i18n'
import { cellOfOwn, cellOfText, shownAtStart, toggleShown, versesOf, type SideCell } from './parallel'
import { WordLines } from './TouchWords'

export interface SideText {
  id: string
  /** Its name on its switch and over its column: TPL, TPS, Hebreo, Su traducción. */
  label: string
  /** A text of words to touch. */
  text?: PrototypeText
  /** The team's own text, verse by verse (`textOf`), and where a verse said with others starts (`joinStartOf`). */
  own?: { textOf(verse: number): string; startOf(verse: number): number }
}

const keptKey = (app: string) => `servos.prototipo.lado.${app}`
function readKept(app: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(keptKey(app)) ?? 'null')
  } catch {
    return null
  }
}
function keep(app: string, ids: string[]) {
  try {
    localStorage.setItem(keptKey(app), JSON.stringify(ids))
  } catch {
    /* a private window keeps nothing: the screen opens as the first time */
  }
}

export function SideBySide({
  app,
  texts,
  max,
  initial,
  single,
  verses,
  open,
  at,
  line,
  lit,
  glossed,
  onWord,
  under,
  after,
}: {
  /** The mini app, whose choice is kept apart from the others'. */
  app: string
  texts: SideText[]
  /** The most texts that fit side by side in this window. */
  max: number
  /** The text the person reads, always among those shown. */
  initial?: string
  /** One text alone, as the mini app draws it; nothing for one it does not draw alone (then a row per verse). */
  single(id: string): ReactNode
  /** The verses that have a row: the whole chapter, or only those open (the study). */
  verses?: number[]
  /** The verses open (the verse, or those of its section): one band across the texts. */
  open: number[]
  /** The verse brought into sight. */
  at: number
  /** The line being written in that verse, lit in each text. */
  line: number | null
  lit(id: string): Set<number>
  glossed?: Record<string, Set<number> | undefined>
  onWord(id: string, verse: number, place: number): void
  /** What goes under a verse's row: the helps of a word touched in one of the texts. */
  under(ids: string[], verse: number): ReactNode
  /** What follows the rows (the study's helps, all together). */
  after?: ReactNode
}) {
  const t = useT()
  const order = texts.map((x) => x.id)
  const [chosen, setChosen] = useState<string[] | null>(null)
  const shownIds = shownAtStart(chosen ?? readKept(app), order, initial, max)
  const shown = texts.filter((x) => shownIds.includes(x.id))
  const full = shownIds.length >= max
  const touch = (id: string) => {
    const next = toggleShown(shownIds, id, order, max)
    setChosen(next)
    keep(app, next)
  }

  const switches = (
    <div className="side-switches" role="group" aria-label={t('marco.lado.textos')}>
      {texts.map((x) => {
        const on = shownIds.includes(x.id)
        const lone = on && shownIds.length === 1
        return (
          <button
            key={x.id}
            type="button"
            className={on ? 'side-switch is-on' : 'side-switch'}
            aria-pressed={on}
            disabled={!on && full}
            // The last one on stays (a touch leaves it): it is not offered as something to take away.
            title={!on && full ? t('marco.lado.lleno', { n: max }) : lone ? undefined : on ? t('marco.lado.quitar', { texto: x.label }) : t('marco.lado.poner', { texto: x.label })}
            onClick={() => touch(x.id)}
          >
            {x.label}
          </button>
        )
      })}
    </div>
  )

  // One text alone is drawn as the mini app draws it, when it has a way to (the team's own text has none: a row each).
  const alone = shown.length === 1 ? single(shown[0].id) : null
  return (
    <div className="side-by-side" data-n={shown.length}>
      {switches}
      {alone !== null && alone !== undefined ? (
        <>
          <p className="side-hint">{t('marco.lado.ayuda', { n: max })}</p>
          {alone}
        </>
      ) : (
        <>
          <Rows texts={shown} verses={verses} open={open} at={at} line={line} lit={lit} glossed={glossed} onWord={onWord} under={under} />
          {after}
        </>
      )}
    </div>
  )
}

function Rows({
  texts,
  verses: only,
  open,
  at,
  line,
  lit,
  glossed,
  onWord,
  under,
}: {
  texts: SideText[]
  verses?: number[]
  open: number[]
  at: number
  line: number | null
  lit(id: string): Set<number>
  glossed?: Record<string, Set<number> | undefined>
  onWord(id: string, verse: number, place: number): void
  under(ids: string[], verse: number): ReactNode
}) {
  const t = useT()
  const current = useRef<HTMLDivElement>(null)
  const verses = only ?? versesOf(texts.map((x) => (x.text ? Object.keys(x.text.lines).map(Number) : [])))
  const ids = texts.map((x) => x.id)
  // The verse open is brought into sight within its pane, as one text alone does (ChapterLines).
  useEffect(() => {
    const row = current.current
    const pane = row?.closest<HTMLElement>('.pane')
    if (!row || !pane) return
    const top = row.offsetTop - 12
    pane.scrollTop = top < pane.clientHeight / 3 ? 0 : top
  }, [at, ids.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const cellOf = (x: SideText, verse: number): SideCell =>
    x.text ? cellOfText(x.text.lines, verse) : x.own ? cellOfOwn(verse, x.own.startOf, x.own.textOf) : { kind: 'missing' }

  return (
    <div className="side-rows" role="table" aria-label={t('marco.lado.textos')} style={{ '--side-n': texts.length } as CSSProperties}>
      <div className="side-row is-head" role="row">
        <span className="side-num" role="columnheader" aria-label={t('marco.lado.versiculo')} />
        {texts.map((x) => (
          <span key={x.id} className="side-head" role="columnheader" title={x.text?.title}>
            {x.label}
          </span>
        ))}
      </div>
      {verses.map((v) => {
        const here = open.includes(v)
        const below = under(ids, v)
        return (
          <div key={v} ref={v === at ? current : undefined} className="side-verse" role="rowgroup">
            <div className={here ? 'side-row is-here' : 'side-row'} role="row">
              <span className="side-num" role="rowheader">
                {v}
              </span>
              {texts.map((x) => {
                const cell = cellOf(x, v)
                if (cell.kind === 'missing')
                  return (
                    <span key={x.id} className="side-cell is-empty" role="cell" aria-label={t('marco.lado.falta')}>
                      —
                    </span>
                  )
                if (cell.kind === 'joined')
                  return (
                    <span key={x.id} className="side-cell is-empty" role="cell">
                      {t('marco.lado.junto', { n: cell.from })}
                    </span>
                  )
                if (x.own)
                  return (
                    <span key={x.id} className="side-cell is-own" role="cell">
                      {x.own.textOf(v)}
                    </span>
                  )
                const text = x.text!
                const count = text.lines[v]?.length ?? 0
                const writing = v === at && line !== null && count ? Math.min(line, count - 1) : undefined
                return (
                  <div key={x.id} className={text.original ? 'side-cell is-original' : 'side-cell'} role="cell" dir={text.dir ?? 'ltr'} lang={text.lang}>
                    <WordLines lines={text.lines[v]} verse={v} lit={lit(x.id)} onWord={(place) => onWord(x.id, v, place)} writing={writing} glossed={glossed?.[x.id]} numbered={false} />
                  </div>
                )
              })}
            </div>
            {below && (
              <div className="side-row is-under" role="row">
                <div className="side-under" role="cell">
                  {below}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
