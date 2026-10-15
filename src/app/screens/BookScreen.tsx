/**
 * A book, as translationCore 4 lays out where to go on (its home's «Continue →» and its screen for choosing a review
 * tool): first, where the person left off and one filled button to go on there; then the book's steps, from studying
 * to publishing, as tabs always in sight, each with how far it has gone; under the step chosen, a card for each of its
 * mini apps, with what it does, its progress in the whole book, the next verse to do and, folded, its progress chapter
 * by chapter (and, for the translation, who wrote each chapter, since a team may split a book and gather it on one
 * computer). What is used now and then (receiving work from another computer, the project's glossary) is in «More».
 * Moving the book on to the next step is said plainly, at the foot of the step it is in; no step is closed to the
 * person (philosophy, principle 5). A book whose texts and helps are not on the phone says so, and how to get them
 * (principle 8).
 */

import { useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { MenuRow, Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import { BOOK_INTRO, CHAPTER_INTRO, type MiniApp } from '../miniapps/contract'
import { miniApp } from '../miniapps/registry'
import { PHASES, bookName, type BookEntry, type Phase, type Project } from '../projects/model'
import { receiveWork, workOf, type Received, type WorkFile } from '../projects/work'
import { exampleWork } from './exampleWork'

type Place = { chapter: number; verse: number }

export function BookScreen({
  project,
  book,
  chapters,
  onBack,
  onOpen,
  onPhase,
  onReceive,
  onGlossary,
  lastApp,
  placeFor,
}: {
  project: Project
  book: BookEntry
  /** The book's chapters whose texts and helps are on this phone, in order. */
  chapters: PrototypeData[]
  onBack(): void
  /** Opens a mini app where the person left off, or at a chapter. */
  onOpen(app: MiniApp, chapter?: number): void
  onPhase(phase: Phase): void
  onReceive(): void
  /** The project's glossary, shared by all its books. */
  onGlossary(): void
  /** The mini app the person last opened from this book. */
  lastApp?: string | null
  /** Where the person left a mini app in this book, if they opened it. */
  placeFor(app: string): Place | null
}) {
  const t = useT()
  const name = bookName(book.code)
  const at = PHASES.indexOf(book.phase)
  const appsOf = (phase: Phase) => project.miniApps[phase].map((id) => miniApp(id)).filter((a): a is MiniApp => Boolean(a))
  const allApps = PHASES.flatMap((p) => appsOf(p)).filter((a) => !a.comingSoon)
  // Where «Continue» goes: the mini app last worked in, if the project still uses it, or else the first of the step
  // the book is in.
  const current = allApps.find((a) => a.id === lastApp) ?? appsOf(book.phase).find((a) => !a.comingSoon)
  // The step shown: the one of the mini app last worked in, so its card is in sight.
  const [shown, setShown] = useState<Phase>(current?.phase ?? book.phase)
  const [byChapter, setByChapter] = useState<string | null>(null)
  const [more, setMore] = useState(false)
  const [receiving, setReceiving] = useState(false)
  const [received, setReceived] = useState<{ file: WorkFile; result: Received } | null>(null)
  // Work received changes what the cards show: drawn again after it.
  const [, setGathered] = useState(0)

  const versesOf = (c: PrototypeData) => c.verses.map((v) => v.verse)
  const isDone = (app: MiniApp, chapter: number, verse: number) => app.done!({ book: book.code, chapter, verse })
  const doneIn = (app: MiniApp, c: PrototypeData) => versesOf(c).filter((v) => isDone(app, c.chapter, v)).length
  const totalVerses = chapters.reduce((n, c) => n + c.verses.length, 0)
  const doneOf = (app: MiniApp) => chapters.reduce((n, c) => n + doneIn(app, c), 0)
  // Whole percents, rounded down: 99 % until every verse is done, never 100 % with one left.
  const pct = (done: number, total: number) => (total ? Math.floor((100 * done) / total) : 0)
  const bar = (done: number, total: number) => (
    <span className="progress-bar" aria-hidden="true">
      <span style={{ width: `${total ? (100 * done) / total : 0}%` }} />
    </span>
  )
  const placeName = (p: Place) =>
    p.verse === BOOK_INTRO
      ? t('libro.introLibro', { libro: name })
      : p.verse === CHAPTER_INTRO
        ? t('libro.introCapitulo', { libro: name, capitulo: p.chapter })
        : `${name} ${p.chapter}:${p.verse}`
  /** The first verse of the book a mini app has still to do. */
  const nextOf = (app: MiniApp): Place | null => {
    for (const c of chapters) for (const v of versesOf(c)) if (!isDone(app, c.chapter, v)) return { chapter: c.chapter, verse: v }
    return null
  }
  /** How far a step has gone: the verses done in all its mini apps that count, of all they have to do. */
  const stepPct = (phase: Phase) => {
    const counted = appsOf(phase).filter((a) => !a.comingSoon && a.done)
    if (!counted.length || !totalVerses) return null
    return pct(
      counted.reduce((n, a) => n + doneOf(a), 0),
      counted.length * totalVerses
    )
  }

  const resumeAt = current ? placeFor(current.id) : null
  const shownAt = PHASES.indexOf(shown)
  const shownApps = appsOf(shown)

  return (
    <div className="screen">
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onBack}>
          ‹ {t('marco.volver')}
        </button>
        <div className="header-title">
          <span className="header-app">{name}</span>
          <span className="header-person">{project.name}</span>
        </div>
        <button type="button" className="button-quiet header-more" onClick={() => setMore(true)}>
          {t('libro.mas')}
        </button>
      </header>
      <main className="main">
        {!chapters.length ? (
          <>
            <p className="notice">{t('libro.faltaPaquete', { libro: name })}</p>
            <button type="button" className="button-primary" onClick={onReceive}>
              {t('libro.recibirPaquete')}
            </button>
          </>
        ) : (
          current && (
            // Where the person left off, and the one filled button of the screen to go on there.
            <section className="book-resume" aria-label={t(resumeAt ? 'libro.sigaDonde' : 'libro.empieceAqui')}>
              <span className="book-resume-kicker">{t(resumeAt ? 'libro.sigaDonde' : 'libro.empieceAqui')}</span>
              <span className="book-resume-what">
                {t(`${current.id}.nombre`)}
                {resumeAt && ` · ${placeName(resumeAt)}`}
              </span>
              <button type="button" className="button-primary" onClick={() => onOpen(current)}>
                {t(resumeAt ? 'libro.continuar' : 'libro.empezar')} →
              </button>
            </section>
          )
        )}

        {/* The steps, always in sight as tabs, each with how far it has gone; the one the book is in, marked. */}
        <div className="book-steps" role="tablist" aria-label={t('libro.pasos')}>
          {PHASES.map((phase, i) => {
            const p = stepPct(phase)
            return (
              <button
                key={phase}
                type="button"
                role="tab"
                aria-selected={phase === shown}
                className={i === at ? 'book-step is-current' : 'book-step'}
                onClick={() => {
                  setShown(phase)
                  setByChapter(null)
                }}
              >
                <span>{t(`pasos.${phase}`)}</span>
                <span className="book-step-state">{i < at ? '✓' : p !== null && p > 0 ? `${p} %` : ''}</span>
              </button>
            )
          })}
        </div>
        <p className="quiet book-step-about">
          {t(`pasos.${shown}Ayuda`)}
          {shownAt === at && ` · ${t('pasos.enCurso')}`}
        </p>

        {shownApps.length === 0 && <p className="quiet">{t('libro.ningunaApp')}</p>}
        <ul className="tool-cards">
          {shownApps.map((app) => {
            const done = app.done ? doneOf(app) : null
            const next = app.done ? nextOf(app) : null
            const place = placeFor(app.id)
            const go = app.comingSoon ? null : done !== null && !next ? 'libro.ver' : place ? 'libro.continuar' : 'libro.empezar'
            const open = byChapter === app.id
            return (
              <li key={app.id} className={app === current ? 'tool-card is-current' : 'tool-card'}>
                <button type="button" className="tool-card-main" disabled={app.comingSoon || !chapters.length} onClick={() => onOpen(app)}>
                  <span className="tool-card-head">
                    <span className="tool-card-name">
                      {t(`${app.id}.nombre`)}
                      {app.comingSoon && <span className="badge">{t('catalogo.pronto')}</span>}
                    </span>
                    {go && <span className="tool-card-go">{t(go)} →</span>}
                  </span>
                  <span className="quiet">{t(`${app.id}.descripcion`)}</span>
                  {done !== null && totalVerses > 0 && (
                    <span className="tool-progress">
                      {bar(done, totalVerses)}
                      <span>{t('libro.avance', { hechos: done, total: totalVerses, pct: pct(done, totalVerses) })}</span>
                    </span>
                  )}
                </button>
                {done !== null && chapters.length > 0 && (
                  <div className="tool-card-foot">
                    <span className="quiet">{next ? t('libro.siguiente', { lugar: placeName(next) }) : t('libro.todoHecho')}</span>
                    <button type="button" className="button-quiet" aria-expanded={open} onClick={() => setByChapter(open ? null : app.id)}>
                      {t('libro.porCapitulo')} {open ? '▴' : '▾'}
                    </button>
                  </div>
                )}
                {open && (
                  <ul className="tool-chapters">
                    {chapters.map((c) => {
                      const n = doneIn(app, c)
                      // Who wrote each chapter, for the translation: a team may split a book and gather it here.
                      const work = app.phase === 'traduccion' ? workOf(book.code, c.chapter, versesOf(c)) : null
                      return (
                        <li key={c.chapter}>
                          <button type="button" className="tool-chapter" onClick={() => onOpen(app, c.chapter)}>
                            <span className="tool-chapter-name">{t('libro.capitulo', { n: c.chapter })}</span>
                            {bar(n, c.verses.length)}
                            <span className="tool-chapter-count">{t('libro.hechosDe', { hechos: n, total: c.verses.length, pct: pct(n, c.verses.length) })}</span>
                            {work && work.people.length > 0 && (
                              <span className="tool-chapter-people">{work.people.map(([who, k]) => t('libro.quien', { nombre: who, n: k })).join(' · ')}</span>
                            )}
                            {work && work.choices > 0 && <span className="tool-chapter-choices">{t('libro.paraElegir', { n: work.choices })}</span>}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>

        {/* Moving the book on, said plainly, at the foot of the step it is in; or back, or ahead, from another. */}
        {shownAt === at && at < PHASES.length - 1 && (
          <button type="button" className="button-quiet book-pass" onClick={() => onPhase(PHASES[at + 1])}>
            {t('libro.terminadoPasar', { paso: t(`pasos.${shown}`), siguiente: t(`pasos.${PHASES[at + 1]}`) })} ›
          </button>
        )}
        {shownAt !== at && (
          <button type="button" className="button-quiet book-pass" onClick={() => onPhase(shown)}>
            {shownAt < at ? `‹ ${t('libro.volverA', { paso: t(`pasos.${shown}`) })}` : `${t('libro.pasarA', { paso: t(`pasos.${shown}`) })} ›`}
          </button>
        )}
      </main>

      {more && (
        <Sheet title={t('libro.mas')} onClose={() => setMore(false)}>
          <MenuRow
            label={t('libro.recibirTrabajo')}
            description={t('libro.recibirTrabajoAyuda')}
            disabled={!chapters.length}
            onClick={() => {
              setMore(false)
              setReceiving(true)
            }}
          />
          <MenuRow
            label={t('libro.glosario')}
            description={t('libro.glosarioAyuda')}
            onClick={() => {
              setMore(false)
              onGlossary()
            }}
          />
        </Sheet>
      )}

      {receiving && (
        <Sheet
          title={t('libro.recibirTrabajo')}
          onClose={() => {
            setReceiving(false)
            setReceived(null)
          }}
        >
          {received ? (
            <>
              <p>{t('libro.recibido', { nombre: received.file.from, que: received.file.label, n: received.result.taken })}</p>
              {received.result.same > 0 && <p className="quiet">{t('libro.recibidoIgual', { n: received.result.same })}</p>}
              {received.result.choices > 0 && <p className="notice">{t('libro.recibidoElegir', { n: received.result.choices, nombre: received.file.from })}</p>}
              <button type="button" className="button-primary" onClick={() => setReceived(null)}>
                {t('libro.recibirOtro')}
              </button>
            </>
          ) : (
            <>
              <p className="quiet">{t('libro.recibirAyuda')}</p>
              {exampleWork(chapters).map((file) => (
                <button
                  key={file.label}
                  type="button"
                  className="menu-row"
                  onClick={() => {
                    setReceived({ file, result: receiveWork(file) })
                    setGathered((n) => n + 1)
                  }}
                >
                  <span className="menu-row-label">{t('libro.trabajoDe', { nombre: file.from, que: file.label })}</span>
                  <span className="menu-row-description">{t('libro.versiculosN', { n: file.verses.length })}</span>
                </button>
              ))}
              <p className="quiet">{t('libro.ejemploAviso')}</p>
            </>
          )}
        </Sheet>
      )}
    </div>
  )
}
