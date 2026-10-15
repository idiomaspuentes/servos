/**
 * A book: its chapters and its steps, from studying to publishing. The chapters say how far the work has gone in each
 * and who did it, since a team may split a book by chapters, sections or verses, each on their own computer, and
 * gather it later on the one that keeps the master copy. Each chapter's bar is the progress of the mini app the person
 * last worked in (or the step's first), named above the list; touching a chapter shows how far every mini app has gone
 * in it, each opening there. The step the book is in is open, with its mini apps and each one's progress in the whole
 * book; the others are folded, and none is closed to the person (philosophy, principle 5). One filled button
 * continues where the person left off: in the mini app last worked in. A book whose texts and
 * helps are not on the phone says so, and how to get them (principle 8).
 */

import { useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import type { MiniApp } from '../miniapps/contract'
import { miniApp } from '../miniapps/registry'
import { PHASES, bookName, type BookEntry, type Phase, type Project } from '../projects/model'
import { receiveWork, workOf, type Received, type WorkFile } from '../projects/work'
import { exampleWork } from './exampleWork'

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
}: {
  project: Project
  /** The mini app the person last opened from this book. */
  lastApp?: string | null
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
}) {
  const t = useT()
  const name = bookName(book.code)
  const at = PHASES.indexOf(book.phase)
  const appsOf = (phase: Phase) => project.miniApps[phase].map((id) => miniApp(id)).filter((a): a is MiniApp => Boolean(a))
  // What «Continue» opens and the chapters' bars count: the mini app last worked in, if the project still uses it, or
  // else the first of the step the book is in.
  const allApps = PHASES.flatMap((p) => appsOf(p)).filter((a) => !a.comingSoon)
  const first = allApps.find((a) => a.id === lastApp) ?? appsOf(book.phase).find((a) => !a.comingSoon)
  const [openChapter, setOpenChapter] = useState<number | null>(null)
  const [receiving, setReceiving] = useState(false)
  const [received, setReceived] = useState<{ file: WorkFile; result: Received } | null>(null)
  // Work received changes what the chapters show: drawn again after it.
  const [, setGathered] = useState(0)

  const versesOf = (c: PrototypeData) => c.verses.map((v) => v.verse)
  const doneIn = (app: MiniApp, c: PrototypeData) => versesOf(c).filter((v) => app.done!({ book: book.code, chapter: c.chapter, verse: v })).length
  const progress = (app: MiniApp): { done: number; total: number } | null => {
    if (!chapters.length || !app.done) return null
    const total = chapters.reduce((n, c) => n + c.verses.length, 0)
    const done = chapters.reduce((n, c) => n + doneIn(app, c), 0)
    return { done, total }
  }
  // Whole percents, rounded down: 99 % until every verse is done, never 100 % with one left.
  const pct = (done: number, total: number) => (total ? Math.floor((100 * done) / total) : 0)
  const bar = (done: number, total: number) => (
    <span className="chapter-row-bar" aria-hidden="true">
      <span style={{ width: `${total ? (100 * done) / total : 0}%` }} />
    </span>
  )

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
        <span />
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
          first && (
            <button type="button" className="button-primary" onClick={() => onOpen(first)}>
              {t('libro.seguir', { app: t(`${first.id}.nombre`) })}
            </button>
          )
        )}

        {chapters.length > 0 && first && (
          <section className="chapters" aria-labelledby="capitulos">
            <h2 id="capitulos">{t('libro.capitulos')}</h2>
            {first.done && <p className="quiet chapters-of">{t('libro.avanceEn', { app: t(`${first.id}.nombre`) })}</p>}
            <ul className="chapter-list">
              {chapters.map((c) => {
                const work = workOf(book.code, c.chapter, versesOf(c))
                const done = first.done ? doneIn(first, c) : null
                const open = openChapter === c.chapter
                return (
                  <li key={c.chapter} className={open ? 'is-open' : undefined}>
                    <button type="button" className="chapter-row" aria-expanded={open} onClick={() => setOpenChapter(open ? null : c.chapter)}>
                      <span className="chapter-row-name">{t('libro.capitulo', { n: c.chapter })}</span>
                      {done !== null && bar(done, c.verses.length)}
                      {done !== null && <span className="chapter-row-count">{t('libro.avance', { hechos: done, total: c.verses.length, pct: pct(done, c.verses.length) })}</span>}
                      {work.people.length > 0 && (
                        <span className="chapter-row-people">{work.people.map(([who, n]) => t('libro.quien', { nombre: who, n })).join(' · ')}</span>
                      )}
                      {work.choices > 0 && <span className="chapter-row-choices">{t('libro.paraElegir', { n: work.choices })}</span>}
                    </button>
                    {/* Touched, the chapter shows how far each mini app has gone in it, each opening there. */}
                    {open && (
                      <ul className="chapter-apps">
                        {allApps.map((app) => {
                          const n = app.done ? doneIn(app, c) : null
                          return (
                            <li key={app.id}>
                              <button type="button" className={app === first ? 'chapter-app is-current' : 'chapter-app'} onClick={() => onOpen(app, c.chapter)}>
                                <span className="chapter-app-name">{t(`${app.id}.nombre`)}</span>
                                {n !== null && bar(n, c.verses.length)}
                                {n !== null && <span className="chapter-row-count">{t('libro.hechosDe', { hechos: n, total: c.verses.length, pct: pct(n, c.verses.length) })}</span>}
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
            <button type="button" className="button-quiet" onClick={() => setReceiving(true)}>
              {t('libro.recibirTrabajo')}
            </button>
            <button type="button" className="button-quiet" onClick={onGlossary}>
              {t('libro.glosario')}
            </button>
          </section>
        )}

        <ol className="steps">
          {PHASES.map((phase, i) => {
            const state = i < at ? 'hecho' : i === at ? 'enCurso' : 'pendiente'
            const apps = appsOf(phase)
            return (
              <li key={phase} className={`step is-${state}`}>
                <details open={i === at}>
                  <summary>
                    <span className="step-name">{t(`pasos.${phase}`)}</span>
                    <span className="step-state">{t(`pasos.${state}`)}</span>
                  </summary>
                  <p className="quiet">{t(`pasos.${phase}Ayuda`)}</p>
                  {apps.length === 0 && <p className="quiet">{t('libro.ningunaApp')}</p>}
                  <ul className="step-apps">
                    {apps.map((app) => {
                      const p = progress(app)
                      return (
                        <li key={app.id}>
                          <button type="button" className="app-row" disabled={app.comingSoon || !chapters.length} onClick={() => onOpen(app)}>
                            <span className="app-row-name">
                              {t(`${app.id}.nombre`)}
                              {app.comingSoon && <span className="badge">{t('catalogo.pronto')}</span>}
                            </span>
                            <span className="quiet">{t(`${app.id}.descripcion`)}</span>
                            {/* Its progress in the whole book, seen before opening it. */}
                            {p && (
                              <span className="app-row-progress">
                                {bar(p.done, p.total)}
                                <span>{t('libro.avance', { hechos: p.done, total: p.total, pct: pct(p.done, p.total) })}</span>
                              </span>
                            )}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                  {i === at && i < PHASES.length - 1 && (
                    <button type="button" className="button-quiet" onClick={() => onPhase(PHASES[i + 1])}>
                      {t('libro.pasarA', { paso: t(`pasos.${PHASES[i + 1]}`) })} ›
                    </button>
                  )}
                  {i < at && (
                    <button type="button" className="button-quiet" onClick={() => onPhase(phase)}>
                      ‹ {t('libro.volverA', { paso: t(`pasos.${phase}`) })}
                    </button>
                  )}
                </details>
              </li>
            )
          })}
        </ol>
      </main>

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
