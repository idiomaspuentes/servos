/**
 * The texts of the chapter side by side, on a computer (philosophy, principle 13; the design in `parallel.ts`). Each
 * text's name is a switch: on, its text is a column; one more is added beside with a click, up to `max`. With one on,
 * the mini app draws it as it always has (`single`); with two or more, one row per verse, the verses open as one band
 * across, a touched word lit in every text that translates the same words of the original, and its helps under the
 * row. What was chosen is kept on this device, for each mini app.
 *
 * Where the team writes (the editor, `writing`), the row ends in the box where its verse is written, as desktop
 * translation tools have it: always in rows, with one text on too, so the box being written in stays where it is when
 * another text is put beside. Verses said together are one row with one box; the rows open hold the boxes, and the
 * others what is written, a click away.
 */

import { Fragment, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { PrototypeText } from '../../prototype/data'
import { useT } from '../i18n/i18n'
import { cellOfOwn, cellOfText, lineIn, rowsOf, shownAtStart, toggleShown, versesOf, type SideCell } from './parallel'
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

/** The boxes where the team writes, a column after the texts in each row. */
export interface SideWriting {
  /** Its name over the column: «Su traducción». */
  label: string
  /** The verses said together with a verse (`joinedVerses`), in order: their row and their box. */
  unitOf(verse: number): number[]
  /** The boxes of a row open. */
  box(unit: number[]): ReactNode
  /** What is written of a row not open. */
  written(unit: number[]): string
  /** What a click on a row not open does, as said under the pointer: «Escribir el 4». */
  goLabel(unit: number[]): string
  go(unit: number[]): void
  /** Said after the switches (how a poem's lines are written, when the verses open have one). */
  hint?: ReactNode
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
  helped,
  onWord,
  under,
  after,
  writing,
  aside,
}: {
  /** The mini app, whose choice is kept apart from the others'. */
  app: string
  texts: SideText[]
  /** The most texts that fit side by side in this window; with one, a click puts another in its place. */
  max: number
  /** The text the person reads, always among those shown. */
  initial?: string
  /** One text alone, as the mini app draws it; nothing for one it does not draw alone (then a row per verse). */
  single?(id: string): ReactNode
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
  /** Words a note or a key word is about, by text. */
  helped?: Record<string, Set<number> | undefined>
  onWord(id: string, verse: number, place: number): void
  /** What goes under a verse's row: the helps of a word touched in one of the texts. */
  under(ids: string[], verse: number): ReactNode
  /** What follows the rows (the study's helps, all together). */
  after?: ReactNode
  /** The boxes where the team writes, at the end of each row (the editor). */
  writing?: SideWriting
  /**
   * A column beside the rows that is put on and off with a switch of its own, after the texts' (the editor's helps,
   * on a window narrower than 1280 px: on, it takes the room of a text).
   */
  aside?: { label: string; on: boolean; onChange(on: boolean): void }
}) {
  const t = useT()
  const order = texts.map((x) => x.id)
  const [chosen, setChosen] = useState<string[] | null>(null)
  const shownIds = shownAtStart(chosen ?? readKept(app), order, initial, max)
  const shown = texts.filter((x) => shownIds.includes(x.id))
  // With room for one, a text is not put beside but in place of the other: never full.
  const full = max > 1 && shownIds.length >= max
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
            title={
              !on && full
                ? t('marco.lado.lleno', { n: max })
                : lone
                  ? undefined
                  : on
                    ? t('marco.lado.quitar', { texto: x.label })
                    : t(max === 1 ? 'marco.lado.cambiar' : 'marco.lado.poner', { texto: x.label })
            }
            onClick={() => touch(x.id)}
          >
            {x.label}
          </button>
        )
      })}
      {aside && (
        <button
          type="button"
          className={aside.on ? 'side-switch is-aside is-on' : 'side-switch is-aside'}
          aria-pressed={aside.on}
          // Why one text only fits beside it is said here, where it is asked, not in a line always in sight.
          title={aside.on && max === 1 ? t('marco.lado.conAyudas') : t(aside.on ? 'marco.lado.quitar' : 'marco.lado.poner', { texto: aside.label })}
          onClick={() => aside.onChange(!aside.on)}
        >
          {aside.label}
        </button>
      )}
    </div>
  )

  // One text alone is drawn as the mini app draws it, when it has a way to (the team's own text has none: a row each).
  // Where the team writes, always rows: the box stays at the end of its verse's row.
  const alone = shown.length === 1 && !writing ? single?.(shown[0].id) : null
  return (
    <div className="side-by-side" data-n={shown.length}>
      {switches}
      {/* What the switches do is said by them when asked (their titles), not in a line always in sight: on a
          computer every line above the texts is one of the source text less on screen. */}
      {alone !== null && alone !== undefined ? (
        alone
      ) : (
        <>
          {writing?.hint}
          <Rows texts={shown} verses={verses} open={open} at={at} line={line} lit={lit} glossed={glossed} helped={helped} onWord={onWord} under={under} writing={writing} />
          {after}
        </>
      )}
    </div>
  )
}

const unitLabel = (unit: number[]) => (unit.length > 1 ? `${unit[0]}–${unit[unit.length - 1]}` : String(unit[0]))

function Rows({
  texts,
  verses: only,
  open,
  at,
  line,
  lit,
  glossed,
  helped,
  onWord,
  under,
  writing,
}: {
  texts: SideText[]
  verses?: number[]
  open: number[]
  at: number
  line: number | null
  lit(id: string): Set<number>
  glossed?: Record<string, Set<number> | undefined>
  /** Words a note or a key word is about, by text. */
  helped?: Record<string, Set<number> | undefined>
  onWord(id: string, verse: number, place: number): void
  under(ids: string[], verse: number): ReactNode
  writing?: SideWriting
}) {
  const t = useT()
  const current = useRef<HTMLDivElement>(null)
  const verses = only ?? versesOf(texts.map((x) => (x.text ? Object.keys(x.text.lines).map(Number) : [])))
  // A verse a row; where the team writes, the verses said together share one, as they share their box.
  const rows = writing ? rowsOf(verses, writing.unitOf) : verses.map((v) => [v])
  const ids = texts.map((x) => x.id)
  // The verse open is brought into sight within its pane, as one text alone does (ChapterLines), clear of the names
  // that stay over the columns. Where the team writes, the first row open: going from box to box in it moves nothing.
  const anchor = writing ? (open[0] ?? at) : at
  useEffect(() => {
    const row = current.current
    const pane = row?.closest<HTMLElement>('.pane')
    if (!row || !pane) return
    const head = pane.querySelector<HTMLElement>('.side-row.is-head')
    const covered = head ? (parseFloat(getComputedStyle(head).top) || 0) + head.offsetHeight : 0
    pane.scrollTop = row.offsetTop < pane.clientHeight / 3 ? 0 : row.offsetTop - covered - 8
  }, [anchor, ids.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  const cellOf = (x: SideText, verse: number): SideCell =>
    x.text ? cellOfText(x.text.lines, verse) : x.own ? cellOfOwn(verse, x.own.startOf, x.own.textOf) : { kind: 'missing' }

  // A text's cell in a row: its verse, or the verses said together one after another, each with its number.
  const cell = (x: SideText, unit: number[]) => {
    const v = unit[0]
    const kind = unit.some((u) => cellOf(x, u).kind === 'text') ? 'text' : cellOf(x, v).kind
    if (kind === 'missing')
      return (
        <span key={x.id} className="side-cell is-empty" role="cell" aria-label={t('marco.lado.falta')}>
          —
        </span>
      )
    if (kind === 'joined')
      return (
        <span key={x.id} className="side-cell is-empty" role="cell">
          {t('marco.lado.junto', { n: x.own!.startOf(v) })}
        </span>
      )
    if (x.own)
      return (
        <span key={x.id} className="side-cell is-own" role="cell">
          {x.own.textOf(v)}
        </span>
      )
    const text = x.text!
    const writingAt = unit.includes(at) && line !== null ? lineIn(unit, line, (u) => text.lines[u]?.length ?? 0) : null
    return (
      <div key={x.id} className={text.original ? 'side-cell is-original' : 'side-cell'} role="cell" dir={text.dir ?? 'ltr'} lang={text.lang}>
        {unit
          .filter((u) => text.lines[u])
          .map((u) => (
            <WordLines
              key={u}
              lines={text.lines[u]}
              verse={u}
              lit={lit(x.id)}
              onWord={(place) => onWord(x.id, u, place)}
              writing={writingAt?.verse === u ? writingAt.line : undefined}
              glossed={glossed?.[x.id]}
              helped={helped?.[x.id]}
              numbered={unit.length > 1}
              // Where the team writes, Tab goes from box to box: the words are a click away, their helps in their column.
              tabbable={!writing}
            />
          ))}
      </div>
    )
  }

  // The boxes of a row open; in another, what is written there, and a click goes to write it.
  const box = (unit: number[], here: boolean) => {
    if (!writing) return null
    if (here)
      return (
        <div className="side-cell side-box" role="cell">
          {writing.box(unit)}
        </div>
      )
    const written = writing.written(unit).trim()
    const go = writing.goLabel(unit)
    return (
      <div className="side-cell side-box" role="cell">
        <button
          type="button"
          tabIndex={-1}
          className={written ? 'side-write' : 'side-write is-empty'}
          title={go}
          aria-label={written ? `${go}: ${written}` : go}
          onClick={() => writing.go(unit)}
        >
          {written || (
            <>
              <span className="side-write-dash" aria-hidden="true">
                —
              </span>
              <span className="side-write-go">{go}</span>
            </>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className={writing ? 'side-rows has-box' : 'side-rows'} role="table" aria-label={t('marco.lado.textos')} style={{ '--side-n': texts.length } as CSSProperties}>
      <div className="side-row is-head" role="row">
        <span className="side-num" role="columnheader" aria-label={t('marco.lado.versiculo')} />
        {texts.map((x) => (
          <span key={x.id} className="side-head" role="columnheader" title={x.text?.title}>
            {x.label}
          </span>
        ))}
        {writing && (
          <span className="side-head" role="columnheader">
            {writing.label}
          </span>
        )}
      </div>
      {rows.map((unit) => {
        const here = unit.some((u) => open.includes(u))
        const below = unit.map((u) => [u, under(ids, u)] as const).filter(([, b]) => b)
        return (
          <div key={unit[0]} ref={unit.includes(anchor) ? current : undefined} className="side-verse" role="rowgroup">
            <div className={here ? 'side-row is-here' : 'side-row'} role="row">
              <span className="side-num" role="rowheader">
                {unitLabel(unit)}
              </span>
              {texts.map((x) => cell(x, unit))}
              {box(unit, here)}
            </div>
            {below.length > 0 && (
              <div className="side-row is-under" role="row">
                <div className="side-under" role="cell">
                  {below.map(([u, b]) => (
                    <Fragment key={u}>{b}</Fragment>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
