/**
 * A book: its chapters and its steps, from studying to publishing. The chapters say how far the work has gone in each
 * and who did it, since a team may split a book by chapters, sections or verses, each on their own computer, and
 * gather it later on the one that keeps the master copy; touching a chapter opens the step's mini app there. The step
 * the book is in is open, with its mini apps and how far each has gone; the others are folded, and none is closed to
 * the person (philosophy, principle 5). One filled button continues where the person left off. A book whose texts and
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
}) {
  const t = useT()
  const name = bookName(book.code)
  const at = PHASES.indexOf(book.phase)
  const appsOf = (phase: Phase) => project.miniApps[phase].map((id) => miniApp(id)).filter((a): a is MiniApp => Boolean(a))
  const first = appsOf(book.phase).find((a) => !a.comingSoon)
  const [receiving, setReceiving] = useState(false)
  const [received, setReceived] = useState<{ file: WorkFile; result: Received } | null>(null)
  // Work received changes what the chapters show: drawn again after it.
  const [, setGathered] = useState(0)

  const versesOf = (c: PrototypeData) => c.verses.map((v) => v.verse)
  const doneIn = (app: MiniApp, c: PrototypeData) => versesOf(c).filter((v) => app.done!({ book: book.code, chapter: c.chapter, verse: v })).length
  const progress = (app: MiniApp): string | null => {
    if (!chapters.length || !app.done) return null
    const total = chapters.reduce((n, c) => n + c.verses.length, 0)
    const done = chapters.reduce((n, c) => n + doneIn(app, c), 0)
    return t('libro.avance', { hechos: done, total })
  }

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
            <ul className="chapter-list">
              {chapters.map((c) => {
                const work = workOf(book.code, c.chapter, versesOf(c))
                const done = first.done ? doneIn(first, c) : null
                return (
                  <li key={c.chapter}>
                    <button type="button" className="chapter-row" onClick={() => onOpen(first, c.chapter)}>
                      <span className="chapter-row-name">{t('libro.capitulo', { n: c.chapter })}</span>
                      {done !== null && (
                        <span className="chapter-row-bar" aria-hidden="true">
                          <span style={{ width: `${(100 * done) / c.verses.length}%` }} />
                        </span>
                      )}
                      {done !== null && <span className="chapter-row-count">{t('libro.avance', { hechos: done, total: c.verses.length })}</span>}
                      {work.people.length > 0 && (
                        <span className="chapter-row-people">{work.people.map(([who, n]) => t('libro.quien', { nombre: who, n })).join(' · ')}</span>
                      )}
                      {work.choices > 0 && <span className="chapter-row-choices">{t('libro.paraElegir', { n: work.choices })}</span>}
                    </button>
                  </li>
                )
              })}
            </ul>
            <button type="button" className="button-quiet" onClick={() => setReceiving(true)}>
              {t('libro.recibirTrabajo')}
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
                            {p && <span className="app-row-progress">{p}</span>}
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
