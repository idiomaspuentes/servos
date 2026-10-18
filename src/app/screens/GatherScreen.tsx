/**
 * Bringing together the versions of a book that several people wrote (design 6.10), on a phone, by touch. Section by
 * section: each one's version read through, tab by tab, and one kept for the whole section; or verse by verse, every
 * version of the verse at once, one kept or a mix made from them by touching their pieces. The keyboard comes only to
 * touch the mix up, and while it is up only the mix is seen. A stretch whose verses were joined two ways is chosen
 * whole, as before. What was kept can be taken back at once.
 */

import { useState, type KeyboardEvent, type ReactNode } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { RowButton } from '../frame/Actions'
import { useProjectFont } from '../frame/fonts'
import { WordLines } from '../frame/TouchWords'
import { TwoShapes } from '../frame/TwoVersions'
import { useT } from '../i18n/i18n'
import { joinPieces, matchingPiece, namesTogether, piecesOf, splitPiece, wordsIn, type Piece } from '../projects/mix'
import type { Project } from '../projects/model'
import { compareVersions, readingsOf, sectionsToGather, waitingIn, type GatherStep, type Reading } from '../projects/versions'
import { canUndoGather, chooseStructure, gather, gatherAll, joinedVerses, structureConflictsOf, undoGather, versionsAt, type Version } from '../projects/work'

type View =
  | { mode: 'seccion' }
  | { mode: 'versiculo'; at: number }
  | {
      mode: 'mezcla'
      verse: number
      pieces: Piece[]
      chosen: number | null
      history: Piece[][]
      tab: number
      typing: string | null
      /** The piece chosen shows its words, to cut it at one. */
      cutting?: boolean
    }

/** What was just kept, said once, with the way back to it while it can still be taken back. */
type Notice = { text: string; at: number; view: View }

/** A version with the words the one here lacks marked (the one here, unmarked). */
function Marked({ here, text }: { here: string; text: string }) {
  const runs = compareVersions(here, text).b.reduce<Array<{ text: string; changed: boolean }>>((out, p) => {
    const last = out[out.length - 1]
    if (last && last.changed === p.changed) last.text += p.text
    else out.push({ ...p })
    return out
  }, [])
  return <>{runs.map((r, i) => (r.changed ? <mark key={i}>{r.text}</mark> : r.text))}</>
}

/** A piece to touch, read inline as part of its verse; a finger or Enter takes it. */
function PieceButton({ className, pressed, onTake, children }: { className: string; pressed?: boolean; onTake(): void; children: ReactNode }) {
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onTake()
    }
  }
  return (
    <span role="button" tabIndex={0} aria-pressed={pressed} className={className} onClick={onTake} onKeyDown={onKeyDown}>
      {children}
    </span>
  )
}

export function GatherScreen({
  project,
  book,
  title,
  chapters,
  textAbbreviation,
  person,
  onBack,
}: {
  project: Project
  book: string
  /** The book's name as the team says it. */
  title: string
  chapters: PrototypeData[]
  /** The bridge text the person reads by (TPL by default). */
  textAbbreviation: string
  /** Who gathers: each decision goes into the book's journal with their name. */
  person: string
  onBack(): void
}) {
  const t = useT()
  useProjectFont(project.font)
  // What waits, as it was on opening: a section kept or skipped does not move the others.
  const [steps] = useState(() =>
    sectionsToGather(
      book,
      chapters.map((c) => ({ chapter: c.chapter, verses: c.verses.map((v) => v.verse), sections: c.sections }))
    )
  )
  const [at, setAt] = useState(0)
  const [view, setView] = useState<View>({ mode: 'seccion' })
  const [tab, setTab] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [source, setSource] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [, redraw] = useState(0)

  const names = (list: string[]) => namesTogether(list, t('juntar.y'))
  const isOpen = (s: GatherStep) =>
    s.kind === 'seccion' ? waitingIn(book, s.chapter, s.verses).length > 0 : structureConflictsOf(book, s.chapter).some((c) => c.from === s.verse)
  const openAfter = (i: number) => steps.findIndex((s, n) => n > i && isOpen(s))
  const openBefore = (i: number) => {
    for (let n = i - 1; n >= 0; n--) if (isOpen(steps[n])) return n
    return -1
  }
  // The step shown: the one asked for, or the next that still waits.
  const current = steps[at] && isOpen(steps[at]) ? at : openAfter(at) >= 0 ? openAfter(at) : openBefore(at)
  const step = current >= 0 ? steps[current] : null
  const data = step ? chapters.find((c) => c.chapter === step.chapter) : undefined
  const bridge = data && (data.texts.find((x) => x.abbreviation === textAbbreviation) ?? data.texts.find((x) => !x.original))

  const go = (n: number) => {
    setAt(n)
    setView({ mode: 'seccion' })
    setTab(0)
    setPicked(null)
    setSource(false)
  }
  const goOn = (from: number) => {
    const next = openAfter(from)
    go(next >= 0 ? next : openBefore(from) >= 0 ? openBefore(from) : steps.length)
  }
  const kept = (text: string, back: View) => setNotice({ text, at: current, view: back })
  const takeBack = () => {
    if (!notice || !undoGather(book)) return setNotice(null)
    setAt(notice.at)
    setView(notice.view)
    setNotice(null)
    redraw((n) => n + 1)
  }
  const placeOf = (chapter: number, verses: number[]) => (verses.length > 1 ? `${chapter}:${verses[0]}–${verses[verses.length - 1]}` : `${chapter}:${verses[0]}`)
  const verseLabel = (chapter: number, v: number) => {
    const joined = joinedVerses(book, chapter, v)
    return joined.length > 1 ? `${v}–${joined[joined.length - 1]}` : `${v}`
  }
  const whoOf = (v: Version, long: boolean) =>
    v.here
      ? v.by.length
        ? t(long ? 'juntar.laQueEstaAhora' : 'juntar.pestanaAhora', { nombre: names(v.by) })
        : t(long ? 'juntar.laQueEstaAhoraSola' : 'juntar.soloAhora')
      : names(v.by)

  const header = (back: string, onHeaderBack: () => void, heading: string, sub: string) => (
    <header className="header">
      <button type="button" className="button-quiet header-back" onClick={onHeaderBack}>
        ‹ {back}
      </button>
      <div className="header-title">
        <span className="header-app">{heading}</span>
        <span className="header-person">{sub}</span>
      </div>
      <span />
    </header>
  )
  const sourceFold = (chapter: number, verses: number[]) => (
    <>
      <RowButton kind="fold" label={t('versiones.loQueDice', { texto: bridge?.abbreviation ?? textAbbreviation })} expanded={source} onClick={() => setSource((s) => !s)} />
      {source && bridge && (
        <div className="versions-source" dir={bridge.dir}>
          {verses.map((v) => (
            <WordLines key={`${chapter}.${v}`} lines={bridge.lines[v] ?? []} verse={v} lit={new Set()} onWord={() => {}} />
          ))}
        </div>
      )}
    </>
  )
  const said = notice && (
    <div className="gather-notice" role="status">
      <span className="gather-notice-text">
        <span className="gather-done" aria-hidden="true">
          ✓
        </span>{' '}
        {notice.text}
      </span>
      {canUndoGather(book) && (
        <button type="button" className="chip" onClick={takeBack}>
          {t('juntar.deshacer')}
        </button>
      )}
    </div>
  )
  const foot = (label: string, prev: (() => void) | null, next: (() => void) | null, prevLabel: string, nextLabel: string) => (
    <nav className="position gather-foot" aria-label={label}>
      <button type="button" className="pager-arrow" aria-label={prevLabel} title={prevLabel} disabled={!prev} onClick={() => prev?.()}>
        ‹
      </button>
      <span className="gather-foot-label">{label}</span>
      <button type="button" className="pager-arrow" aria-label={nextLabel} title={nextLabel} disabled={!next} onClick={() => next?.()}>
        ›
      </button>
    </nav>
  )

  // Nothing left to gather.
  if (!step) {
    return (
      <div className="screen gather">
        {header(title, onBack, t('juntar.titulo'), title)}
        <main className="main">
          {said}
          <p className="review-done">✓ {t('juntar.terminado', { libro: title })}</p>
          <button type="button" className="button-primary" onClick={onBack}>
            {t('versiones.volverAl', { libro: title })}
          </button>
        </main>
      </div>
    )
  }

  const sectionFoot = () =>
    foot(
      t('juntar.seccionNDe', { n: current + 1, total: steps.length }),
      openBefore(current) >= 0 ? () => go(openBefore(current)) : null,
      openAfter(current) >= 0 ? () => go(openAfter(current)) : null,
      t('juntar.seccionAnterior'),
      t('juntar.seccionSiguiente')
    )

  // A stretch joined one way here and another there: chosen whole, as before.
  if (step.kind === 'estructura') {
    const stretch = structureConflictsOf(book, step.chapter).find((c) => c.from === step.verse)!
    return (
      <div className="screen gather">
        {header(title, onBack, t('juntar.titulo'), `${title} ${placeOf(step.chapter, [stretch.from, stretch.to])}`)}
        <main className="main">
          {said}
          {sourceFold(step.chapter, Array.from({ length: stretch.to - stretch.from + 1 }, (_, i) => stretch.from + i))}
          <TwoShapes
            key={`${step.chapter}.${stretch.from}`}
            book={book}
            conflict={stretch}
            inScreen
            onChoose={(keepReceived) => {
              chooseStructure(book, step.chapter, stretch.from, keepReceived, person)
              setNotice(null)
              goOn(current)
            }}
          />
        </main>
        {sectionFoot()}
      </div>
    )
  }

  const chapter = step.chapter
  const lugar = placeOf(chapter, step.verses)
  const waiting = waitingIn(book, chapter, step.verses)

  // A mix of the versions of one verse, made by touch; with the keyboard, only the mix.
  if (view.mode === 'mezcla') {
    const versions = versionsAt(book, chapter, view.verse)
    const back: View = { mode: 'versiculo', at: Math.max(0, waiting.indexOf(view.verse)) }
    const set = (next: Partial<Extract<View, { mode: 'mezcla' }>>) => setView({ ...view, ...next })
    const change = (pieces: Piece[]) => set({ pieces, chosen: null, history: [...view.history, view.pieces] })
    // What was typed is cut into pieces again, and the keyboard goes: the versions are seen once more.
    const doneTyping = () =>
      view.typing === null ? null : set({ pieces: piecesOf(view.typing), chosen: null, history: [...view.history, view.pieces], typing: null })
    const heading = (onHeaderBack: () => void) => header(`${chapter}:${view.verse}`, onHeaderBack, t('juntar.mezclaTitulo'), `${title} ${chapter}:${view.verse}`)
    if (view.typing !== null) {
      return (
        <div className="screen gather gather-typing">
          {heading(doneTyping)}
          <main className="main">
            <p className="quiet gather-hint">{t('juntar.paraVer')}</p>
            <label className="gather-typing-field">
              <span className="gather-label">{t('juntar.suMezcla')}</span>
              <textarea
                // Taken at once, the cursor at the end, where a touch-up usually goes (not before the first letter).
                ref={(el) => {
                  if (el && document.activeElement !== el) {
                    el.focus()
                    el.setSelectionRange(el.value.length, el.value.length)
                  }
                }}
                value={view.typing}
                onChange={(e) => set({ typing: e.target.value })}
              />
            </label>
          </main>
          <div className="position gather-foot gather-typing-bar">
            <span />
            <span />
            <button type="button" className="position-done" onClick={doneTyping}>
              {t('juntar.listo')}
            </button>
          </div>
        </div>
      )
    }
    const shown = versions[Math.min(view.tab, versions.length - 1)]
    const shownPieces = piecesOf(shown.text)
    const used = new Set(view.pieces.map((p) => p.text))
    const match = view.chosen === null ? -1 : matchingPiece(view.pieces[view.chosen].text, shownPieces)
    const chosenWords = view.chosen === null ? [] : wordsIn(view.pieces[view.chosen])
    const cut = (at: number) =>
      set({ pieces: splitPiece(view.pieces, view.chosen!, at), chosen: null, history: [...view.history, view.pieces], cutting: false })
    const take = (piece: Piece) => {
      if (view.chosen === null) change([...view.pieces, { text: piece.text }])
      else change(view.pieces.map((p, i) => (i === view.chosen ? { text: piece.text, ...(p.lineEnd ? { lineEnd: true } : {}) } : p)))
    }
    return (
      <div className="screen gather">
        {heading(() => setView(back))}
        <main className="main">
          <span className="gather-label">{t('juntar.suMezcla')}</span>
          <div className="mix-box mix-flow" aria-label={t('juntar.suMezcla')}>
            {view.pieces.map((p, i) => (
              <span key={i}>
                {i === view.chosen && view.cutting ? (
                  // Cutting: each word a place to cut before (the first one cannot be: nothing would come before it).
                  <span className="mix-piece is-mine is-chosen is-cutting">
                    {chosenWords.map((w, j) => (
                      <span key={j}>
                        {j > 0 && ' '}
                        {j === 0 ? (
                          <span className="mix-word is-first">{w}</span>
                        ) : (
                          <PieceButton className="mix-word" onTake={() => cut(j)}>
                            {w}
                          </PieceButton>
                        )}
                      </span>
                    ))}
                  </span>
                ) : (
                  <PieceButton
                    className={i === view.chosen ? 'mix-piece is-mine is-chosen' : 'mix-piece is-mine'}
                    pressed={i === view.chosen}
                    onTake={() => set({ chosen: view.chosen === i ? null : i, cutting: false })}
                  >
                    {p.text}
                  </PieceButton>
                )}
                {p.lineEnd ? <br /> : ' '}
              </span>
            ))}
          </div>
          <div className="chip-row">
            {view.chosen !== null && (
              <button type="button" className="chip" onClick={() => change(view.pieces.filter((_, i) => i !== view.chosen))}>
                {t('juntar.quitar')}
              </button>
            )}
            {view.chosen !== null && chosenWords.length > 1 && (
              <button type="button" className="chip" aria-pressed={Boolean(view.cutting)} onClick={() => set({ cutting: !view.cutting })}>
                {t('juntar.partir')}
              </button>
            )}
            <button
              type="button"
              className="chip"
              disabled={!view.history.length}
              onClick={() => set({ pieces: view.history[view.history.length - 1], chosen: null, history: view.history.slice(0, -1) })}
            >
              {t('juntar.deshacer')}
            </button>
            <button type="button" className="chip" onClick={() => set({ typing: joinPieces(view.pieces), chosen: null })}>
              {t('juntar.retocar')}
            </button>
          </div>
          <p className="quiet gather-hint">{t(view.cutting ? 'juntar.ayudaPartir' : view.chosen === null ? 'juntar.ayudaElegir' : 'juntar.ayudaReemplazar')}</p>
          <section className="gather-card">
            <div className="panes-tabs" role="tablist" aria-label={t('juntar.deQuien')}>
              {versions.map((v, i) => (
                <button key={v.key} type="button" role="tab" className="panes-tab" aria-selected={i === view.tab} onClick={() => set({ tab: i })}>
                  {whoOf(v, false)}
                </button>
              ))}
            </div>
            <div className="mix-flow gather-pieces">
              {shownPieces.map((p, i) => (
                <span key={i}>
                  <PieceButton className={i === match ? 'mix-piece is-source is-match' : used.has(p.text) ? 'mix-piece is-source is-used' : 'mix-piece is-source'} onTake={() => take(p)}>
                    {p.text}
                  </PieceButton>
                  {p.lineEnd ? <br /> : ' '}
                </span>
              ))}
            </div>
          </section>
          <button
            type="button"
            className="button-primary"
            disabled={!view.pieces.length}
            onClick={() => {
              gather(book, chapter, view.verse, { text: joinPieces(view.pieces) }, person)
              kept(t('juntar.quedoMezcla', { lugar: `${chapter}:${view.verse}` }), back)
              const left = waitingIn(book, chapter, step.verses)
              if (left.length) setView({ mode: 'versiculo', at: Math.min(back.at, left.length - 1) })
              else goOn(current)
            }}
          >
            {t('juntar.quedarseMezcla')}
          </button>
        </main>
      </div>
    )
  }

  // Verse by verse: every version of one verse at once.
  if (view.mode === 'versiculo' && waiting.length) {
    const i = Math.min(view.at, waiting.length - 1)
    const verse = waiting[i]
    const versions = versionsAt(book, chapter, verse)
    const here = versions.find((v) => v.here) ?? versions[0]
    const chosen = versions.find((v) => v.key === picked) ?? null
    const moveTo = (n: number) => {
      setView({ mode: 'versiculo', at: n })
      setPicked(null)
      setSource(false)
    }
    const startMix = (from: Version) =>
      setView({
        mode: 'mezcla',
        verse,
        pieces: piecesOf(from.text),
        chosen: null,
        history: [],
        // The other versions to take from: the first that is not the one the mix starts from.
        tab: Math.max(0, versions.findIndex((v) => v.key !== from.key)),
        typing: null,
      })
    return (
      <div className="screen gather">
        {header(t('juntar.seccion'), () => setView({ mode: 'seccion' }), t('juntar.titulo'), t('juntar.versiculoPorVersiculo'))}
        <main className="main">
          {said}
          <h2 className="versions-place">
            {title} {chapter}:{verseLabel(chapter, verse)}
          </h2>
          {sourceFold(chapter, joinedVerses(book, chapter, verse))}
          <section className="versions" aria-label={t('juntar.titulo')}>
            <p className="versions-ask">{t('juntar.cuantas', { n: versions.length })}</p>
            {versions.map((v) => (
              <button key={v.key} type="button" className={picked === v.key ? 'version is-on' : 'version'} aria-pressed={picked === v.key} onClick={() => setPicked(v.key)}>
                <span className="version-who">
                  <span className="version-dot" aria-hidden="true" />
                  {whoOf(v, true)}
                </span>
                <span className="version-text">{v.here ? v.text : <Marked here={here.text} text={v.text} />}</span>
              </button>
            ))}
            <button
              type="button"
              className="button-primary"
              disabled={!chosen}
              onClick={() => {
                if (!chosen) return
                gather(book, chapter, verse, { key: chosen.key }, person)
                const where = `${chapter}:${verseLabel(chapter, verse)}`
                kept(chosen.here ? t('juntar.quedoAhora', { lugar: where }) : t('juntar.quedo', { lugar: where, nombre: names(chosen.by) }), { mode: 'versiculo', at: i })
                setPicked(null)
                const left = waitingIn(book, chapter, step.verses)
                if (left.length) moveTo(Math.min(i, left.length - 1))
                else goOn(current)
              }}
            >
              {chosen ? (chosen.here ? t('juntar.quedarseAhora') : t('juntar.quedarse', { nombre: names(chosen.by) })) : t('juntar.toqueUna')}
            </button>
            <button type="button" className="button-secondary" onClick={() => startMix(chosen ?? here)}>
              {chosen && !chosen.here ? t('juntar.mezclaDesde', { nombre: names(chosen.by) }) : t('juntar.mezcla')}
            </button>
          </section>
        </main>
        {foot(
          t('juntar.versiculoNDe', { lugar: `${chapter}:${verseLabel(chapter, verse)}`, n: i + 1, total: waiting.length }),
          i > 0 ? () => moveTo(i - 1) : null,
          i < waiting.length - 1 ? () => moveTo(i + 1) : null,
          t('juntar.versiculoAnterior'),
          t('juntar.versiculoSiguiente')
        )}
      </div>
    )
  }

  // A section: each one's version read through, one kept for all of it.
  const readings = readingsOf(book, chapter, step.verses)
  const reading = readings[Math.min(tab, readings.length - 1)]
  const tabOf = (r: Reading) => (r.here ? (r.names.length ? t('juntar.pestanaAhora', { nombre: names(r.names) }) : t('juntar.soloAhora')) : names(r.names))
  const keep = (r: Reading) => {
    const open = new Set(waiting)
    gatherAll(
      book,
      r.verses.filter((v) => open.has(v.verse)).map((v) => ({ chapter, verse: v.verse, choice: { key: v.key } })),
      person
    )
    kept(r.here ? t('juntar.quedoAhora', { lugar }) : t('juntar.quedo', { lugar, nombre: names(r.names) }), { mode: 'seccion' })
    goOn(current)
  }
  return (
    <div className="screen gather">
      {header(title, onBack, t('juntar.titulo'), `${title} ${lugar}`)}
      <main className="main">
        {said}
        <p className="quiet gather-hint">
          {t('juntar.intro', { n: readings.length })}
          {readings
            .filter((r) => r.names.length > 1)
            .map((r) => ` ${t('juntar.iguales', { nombres: names(r.names) })}`)
            .join('')}
        </p>
        {sourceFold(chapter, reading.verses.map((v) => v.verse))}
        <section className="gather-card">
          <div className="panes-tabs" role="tablist" aria-label={t('juntar.deQuien')}>
            {readings.map((r, i) => (
              <button key={i} type="button" role="tab" className="panes-tab" aria-selected={r === reading} onClick={() => setTab(i)}>
                {tabOf(r)}
              </button>
            ))}
          </div>
          <div className="gather-reading">
            <p className="gather-caption">
              {reading.here
                ? t('juntar.ahora')
                : reading.names.length > 1
                  ? t('juntar.asiLaEscribieron', { nombres: names(reading.names) })
                  : t('juntar.asiLaEscribio', { nombre: names(reading.names) })}
            </p>
            {reading.verses.map((v) => (
              <p key={v.verse} className="gather-verse">
                <span className="verse-number">{verseLabel(chapter, v.verse)}</span> {v.text}
              </p>
            ))}
          </div>
        </section>
        <button type="button" className="button-primary" onClick={() => keep(reading)}>
          {reading.here ? t('juntar.dejarSeccion', { lugar }) : t('juntar.quedarseSeccion', { nombre: names(reading.names), lugar })}
        </button>
        <button type="button" className="button-secondary" onClick={() => setView({ mode: 'versiculo', at: 0 })}>
          {t('juntar.porVersiculo')}
        </button>
      </main>
      {sectionFoot()}
    </div>
  )
}
