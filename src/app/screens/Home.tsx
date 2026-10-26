/**
 * Home, made of what only Servos has: a book's five steps and the person working on a shared phone. The project is
 * the title, since most teams have one. The book worked on last is the one moss field, with the person's name («Ana,
 * pick up where you left off»), the mini app and the place, the book's five steps as a track with the step written
 * under it, and the one filled button, «Continue →». The project's other books are one-line rows with their step as
 * words, and adding a book is the last row of the same list. At the foot, two chips: the project's settings and
 * another project. Three shapes, no more: the field, the list and the chips.
 *
 * With two or more projects, on a phone the title opens the list of them in a sheet; from 1280 px they are a column of
 * names at the left, and the project open is in the middle (philosophy, principle 13).
 *
 * On a phone with a memory card and no copy of the work on it yet, the copy is offered once (`frame/copies.ts`); and
 * when a copy could not be made, it is said there.
 *
 * What the person asked to send to Door43 and still waits for internet is said under the moss field, in one quiet line,
 * every time home opens: asked and then out of sight, it was easy to believe it had gone (philosophy, principle 8). With
 * internet, its chip opens the sheet that shows what goes and asks before it does.
 */

import { useEffect, useState } from 'react'
import { useOnline } from '../frame/online'
import type { Errand } from '../projects/outbox'
import { namesTogether } from '../projects/mix'
import { Suggestion } from '../frame/Actions'
import { BrandMark } from '../frame/BrandMark'
import { answerSuggestion, cardInPhone, copiesHere, suggestionAnswered } from '../frame/copies'
import { useWider } from '../frame/Panes'
import { MenuRow, Sheet } from '../frame/Sheet'
import { useCopies } from './CopiesSheet'
import { useDoor43Copy } from './Door43CopySection'
import { failingLong } from '../frame/door43Copy'
import { useT } from '../i18n/i18n'
import { titleOf, type Phase, type Project } from '../projects/model'
import { insideState, onInside } from '../projects/packsInside'

export interface Resume {
  projectId: string
  book: string
}

export function Home({
  projects,
  person,
  resume,
  resumeAt,
  finished,
  workOn,
  onResume,
  onAddProject,
  onBook,
  onAddBook,
  onSettings,
  onPersonMenu,
  onCopies,
  onDoor43,
  waiting = [],
  onSendWaiting,
}: {
  projects: Project[]
  person: string
  resume: Resume | null
  /** The mini app last worked in, in the book to resume, and where: «Alinear la traducción · Jonás 1:6». */
  resumeAt?: string | null
  /** The work the person left as finished, all done, and the mini app offered next: «Abel, terminó el Estudio». */
  finished?: { done: string; next: string } | null
  /**
   * What the person works on in a book: the step of the mini app they last opened there (the first step, before any),
   * how far it has gone in percent when it counts, and whether they began.
   */
  workOn(project: Project, book: string): { step: Phase; pct: number | null; begun: boolean }
  onResume(r: Resume): void
  onAddProject(): void
  onBook(projectId: string, book: string): void
  onAddBook(projectId: string): void
  onSettings(projectId: string): void
  onPersonMenu(): void
  /** Opens the copy on a memory card. */
  onCopies(): void
  /** Opens the person's Door43 account (`relink`: forgets the key that no longer works, to link it again). */
  onDoor43?(relink: boolean): void
  /** What the person asked to send to Door43 that still waits for internet. */
  waiting?: Errand[]
  /** Opens the sheet that shows what waits and sends it when the person says so. */
  onSendWaiting?(): void
}) {
  const t = useT()
  const wide = useWider()
  const [inside, setInside] = useState(insideState)
  useEffect(() => onInside(setInside), [])
  const copies = useCopies()
  const door43Copy = useDoor43Copy(person)
  // A card in the phone and no copy yet: offered once, on home (philosophy, principles 9 and 12).
  const [card, setCard] = useState(false)
  const [answered, setAnswered] = useState(suggestionAnswered)
  useEffect(() => {
    if (!copiesHere() || copies.place || answered) return
    let on = true
    void cardInPhone().then((present) => on && setCard(present))
    return () => {
      on = false
    }
  }, [copies.place, answered])
  // The project shown: the one of the book worked on last, until another is chosen.
  const [chosen, setChosen] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)
  const project = projects.find((p) => p.id === chosen) ?? projects.find((p) => p.id === resume?.projectId) ?? projects[0]
  // The moss field's book: the one worked on last, if it is in this project; or else its first book.
  const resumed = project && resume?.projectId === project.id ? project.books.find((b) => b.code === resume.book) : undefined
  const current = resumed ?? project?.books[0]
  const work = project && current ? workOn(project, current.code) : null
  const begun = Boolean(work && (work.begun || (work.pct ?? 0) > 0))
  const sizeOf = (p: Project) => `${p.languageName} (${p.languageCode}) · ${p.books.length === 1 ? t('inicio.unLibro') : t('inicio.libros', { n: p.books.length })}`
  const others = project ? project.books.filter((b) => b !== current) : []
  const online = useOnline()
  const waits = project ? waiting.filter((e) => e.projectId === project.id) : []
  const waitLine = waits.length > 0 && (
    <div className="status waiting-here" role="status">
      <span>
        {(online ? (que: string) => t('espera.pendiente', { que }) : (que: string) => t('espera.esperaInternet', { que }))(
          namesTogether(
            [...new Set(waits.map((e) => e.kind))].map((k) => t(`espera.que.${k}`)),
            t('juntar.y')
          )
        )}
      </span>
      {online && onSendWaiting && (
        <button type="button" className="chip" onClick={onSendWaiting}>
          {t('inicio.esperaVer')}
        </button>
      )}
    </div>
  )

  // The copy on Door43 failing for days (never sooner: principle 6), and what to do about it.
  const relink = door43Copy.problem === 'signin' || door43Copy.problem === 'scope'
  const door43Notice = onDoor43 && failingLong(door43Copy) && (
    <section className="suggestion" role="status">
      <p>{t('copiaDoor43.avisoInicio', { porque: door43Copy.problem === 'pin' ? t('copiaDoor43.avisoPin') : relink ? t('copiaDoor43.avisoVincular') : t(`door43.problema.${door43Copy.problem ?? 'other'}`) })}</p>
      <div className="chip-row">
        <button type="button" className="chip chip-action" onClick={() => onDoor43(relink)}>
          {relink ? t('equipo.vincularOtraVez') : t('copiaDoor43.ver')}
        </button>
      </div>
    </section>
  )

  const suggestion =
    door43Notice ||
    (copies.place && copies.failed ? (
      // Said only when it fails (principle 6), once, under what continues the work.
      <section className="suggestion" role="status">
        <p>{t('copias.avisoInicio')}</p>
        <div className="chip-row">
          <button type="button" className="chip chip-action" onClick={onCopies}>
            {t('copias.ver')}
          </button>
        </div>
      </section>
    ) : (
      !copies.place &&
      card &&
      !answered && (
        <Suggestion
          text={t('copias.sugerencia')}
          action={t('copias.sugerenciaAccion')}
          mark=""
          onAction={onCopies}
          onDismiss={() => {
            answerSuggestion()
            setAnswered(true)
          }}
        />
      )
    ))

  return (
    <div className="screen">
      <header className="header">
        <span className="header-brand">
          <BrandMark />
          Servos
        </span>
        <button type="button" className="header-person-chip" onClick={onPersonMenu}>
          {person} ▾
        </button>
      </header>
      <main className="main home">
        {/* The first start of the app for phones or computers: the texts and helps it brings are being opened. */}
        {inside.opening && (
          <p className="status" role="status">
            {t('inicio.dentroAbriendo', { pct: Math.floor(100 * inside.part) })}
          </p>
        )}
        {!project ? (
          // The first time, the one thing to do: the team's project. With no project there is nothing to copy yet.
          <section className="book-resume is-field" aria-label={t('inicio.paraEmpezar')}>
            <span className="book-resume-kicker">{t('inicio.paraEmpezar')}</span>
            <span className="book-resume-what">{t('inicio.primerProyecto')}</span>
            <span className="quiet book-resume-project">{t('inicio.agregarProyectoAyuda')}</span>
            <button type="button" className="button-primary" onClick={onAddProject}>
              {t('inicio.agregarProyecto')} →
            </button>
          </section>
        ) : (
          <>
            {wide && (
              // From 1280 px the projects are a column of names, the one open marked (principle 13).
              <nav className="home-projects" aria-label={t('inicio.proyectos')}>
                <h2 className="home-projects-title">{t('inicio.proyectos')}</h2>
                {projects.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="home-project"
                    aria-current={p.id === project.id ? 'page' : undefined}
                    onClick={() => setChosen(p.id)}
                  >
                    {p.name}
                  </button>
                ))}
                <button type="button" className="chip home-chip" onClick={onAddProject}>
                  <span className="home-plus" aria-hidden="true">
                    +
                  </span>
                  {t('inicio.otroProyecto')}
                </button>
              </nav>
            )}
            <div className="home-open">
              <div className="home-title">
                {projects.length > 1 && !wide ? (
                  <h1>
                    <button type="button" className="home-title-pick" aria-haspopup="dialog" onClick={() => setPicking(true)}>
                      {project.name}
                      <span aria-hidden="true"> ▾</span>
                    </button>
                  </h1>
                ) : (
                  <h1>{project.name}</h1>
                )}
                <p className="quiet">{sizeOf(project)}</p>
              </div>
              {current ? (
                <section className="book-resume is-field home-current" aria-label={titleOf(project, current.code)}>
                  <span className="book-resume-kicker">
                    {resumed && finished
                      ? t('inicio.termino', { nombre: person, trabajo: finished.done })
                      : resumed
                        ? t('inicio.sigaDonde', { nombre: person })
                        : begun
                          ? t('inicio.sigaCon', { nombre: person })
                          : t('inicio.empiece', { nombre: person })}
                  </span>
                  {/* «Continue» may go straight back into a mini app; the book's name always opens the book */}
                  <button type="button" className="home-current-book home-current-open" onClick={() => onBook(project.id, current.code)}>
                    {titleOf(project, current.code)}
                    <span className="home-current-chevron" aria-hidden="true">
                      {' '}
                      ›
                    </span>
                  </button>
                  {resumed && resumeAt && <span className="home-current-where">{resumeAt}</span>}
                  {/* How far the person's own work in the book has gone: no stage the whole book is said to be in. */}
                  {work && work.pct !== null && (
                    <span className="tool-progress home-current-step">
                      <span className="progress-bar" aria-hidden="true" data-full={work.pct >= 100 || undefined}>
                        <span style={{ width: `${work.pct}%` }} />
                      </span>
                      <span>{t('inicio.avancePaso', { paso: t(`pasos.${work.step}`), pct: work.pct })}</span>
                    </span>
                  )}
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => (resumed ? onResume({ projectId: project.id, book: current.code }) : onBook(project.id, current.code))}
                  >
                    {resumed && finished ? t('inicio.empezarCon', { app: finished.next }) : begun ? t('libro.continuar') : t('libro.empezar')} →
                  </button>
                </section>
              ) : (
                // A project with no book yet: adding one is the one thing to do.
                <section className="book-resume is-field home-current" aria-label={t('inicio.paraEmpezar')}>
                  <span className="book-resume-kicker">{t('inicio.paraEmpezar')}</span>
                  <span className="home-current-book">{t('inicio.primerLibro')}</span>
                  <button type="button" className="button-primary" onClick={() => onAddBook(project.id)}>
                    {t('inicio.agregarLibro')} →
                  </button>
                </section>
              )}
              {waitLine}
              {suggestion}
              {current && (
                <ul className="home-books">
                  {others.map((b) => {
                    const w = workOn(project, b.code)
                    return (
                      <li key={b.code}>
                        <button type="button" className="home-book" onClick={() => onBook(project.id, b.code)}>
                          <span className="home-book-name">{titleOf(project, b.code)}</span>
                          <span className="home-book-step">
                            {t(`pasos.${w.step}Corto`)}
                            {w.pct !== null && ` · ${w.pct} %`}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                  <li>
                    <button type="button" className="home-book is-add" onClick={() => onAddBook(project.id)}>
                      <span className="home-plus" aria-hidden="true">
                        +
                      </span>
                      {t('inicio.agregarLibro')}
                    </button>
                  </li>
                </ul>
              )}
              <div className="chip-row home-chips">
                <button type="button" className="chip home-chip" onClick={() => onSettings(project.id)}>
                  {t('inicio.ajustes')}
                </button>
                {!wide && (
                  <button type="button" className="chip home-chip" onClick={onAddProject}>
                    <span className="home-plus" aria-hidden="true">
                      +
                    </span>
                    {t('inicio.otroProyecto')}
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </main>
      {picking && (
        <Sheet title={t('inicio.proyectos')} onClose={() => setPicking(false)}>
          {projects.map((p) => (
            <MenuRow
              key={p.id}
              label={p.id === project?.id ? `${p.name} ✓` : p.name}
              description={sizeOf(p)}
              onClick={() => {
                setChosen(p.id)
                setPicking(false)
              }}
            />
          ))}
        </Sheet>
      )}
    </div>
  )
}
