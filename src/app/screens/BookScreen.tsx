/**
 * A book: its steps, from studying to publishing. The step the book is in is open, with its mini apps and how far each
 * has gone; the others are folded, and none is closed to the person (philosophy, principle 5). One filled button
 * continues with the step's first mini app. A book whose texts and helps are not on the phone says so, and how to get
 * them (principle 8).
 */

import type { PrototypeData } from '../../prototype/data'
import { useT } from '../i18n/i18n'
import type { MiniApp } from '../miniapps/contract'
import { miniApp } from '../miniapps/registry'
import { notesCheckedCount } from '../miniapps/revisorNotas/revisorNotas'
import { PHASES, bookName, type BookEntry, type Phase, type Project } from '../projects/model'

function draftCount(book: string, chapter: number, verses: number[]): number {
  try {
    return verses.filter((v) => (localStorage.getItem(`servos.prototipo.borrador.${book}.${chapter}.${v}`) ?? '').trim()).length
  } catch {
    return 0
  }
}

export function BookScreen({
  project,
  book,
  data,
  onBack,
  onOpen,
  onPhase,
  onReceive,
}: {
  project: Project
  book: BookEntry
  /** The book's texts and helps on this phone, or null. */
  data: PrototypeData | null
  onBack(): void
  onOpen(app: MiniApp): void
  onPhase(phase: Phase): void
  onReceive(): void
}) {
  const t = useT()
  const name = bookName(book.code)
  const at = PHASES.indexOf(book.phase)
  const appsOf = (phase: Phase) => project.miniApps[phase].map((id) => miniApp(id)).filter((a): a is MiniApp => Boolean(a))
  const first = appsOf(book.phase).find((a) => !a.comingSoon)
  const verses = data?.verses.map((v) => v.verse) ?? []

  const progress = (app: MiniApp): string | null => {
    if (!data) return null
    const done =
      app.id === 'editor' ? draftCount(book.code, data.chapter, verses) : app.id === 'revisorNotas' ? notesCheckedCount(book.code, data.chapter, verses) : null
    return done === null ? null : t('libro.avance', { hechos: done, total: verses.length })
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
        {!data ? (
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
                          <button type="button" className="app-row" disabled={app.comingSoon || !data} onClick={() => onOpen(app)}>
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
    </div>
  )
}
