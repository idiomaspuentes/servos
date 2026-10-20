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
 */

import { useEffect, useState } from 'react'
import { Suggestion } from '../frame/Actions'
import { BrandMark } from '../frame/BrandMark'
import { answerSuggestion, cardInPhone, copiesHere, suggestionAnswered } from '../frame/copies'
import { useWider } from '../frame/Panes'
import { MenuRow, Sheet } from '../frame/Sheet'
import { useCopies } from './CopiesSheet'
import { useT } from '../i18n/i18n'
import { PHASES, titleOf, type Phase, type Project } from '../projects/model'
import { insideState, onInside } from '../projects/packsInside'

export interface Resume {
  projectId: string
  book: string
}

/** The book's five steps as a track: those done, the one it is in, those still ahead. Said in words beside it. */
function StepTrack({ phase }: { phase: Phase }) {
  const at = PHASES.indexOf(phase)
  return (
    <span className="step-track" aria-hidden="true">
      {PHASES.map((p, i) => (
        <span key={p} className={i < at ? 'is-done' : i === at ? 'is-now' : undefined} />
      ))}
    </span>
  )
}

export function Home({
  projects,
  person,
  resume,
  resumeAt,
  progressOf,
  onResume,
  onAddProject,
  onBook,
  onAddBook,
  onSettings,
  onPersonMenu,
  onCopies,
}: {
  projects: Project[]
  person: string
  resume: Resume | null
  /** The mini app last worked in, in the book to resume, and where: «Alinear la traducción · Jonás 1:6». */
  resumeAt?: string | null
  /** How far the step a book is in has gone, in percent, when it counts. */
  progressOf(project: Project, book: string): number | null
  onResume(r: Resume): void
  onAddProject(): void
  onBook(projectId: string, book: string): void
  onAddBook(projectId: string): void
  onSettings(projectId: string): void
  onPersonMenu(): void
  /** Opens the copy on a memory card. */
  onCopies(): void
}) {
  const t = useT()
  const wide = useWider()
  const [inside, setInside] = useState(insideState)
  useEffect(() => onInside(setInside), [])
  const copies = useCopies()
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
  const currentPct = project && current ? progressOf(project, current.code) : null
  const begun = Boolean(current && (current.phase !== PHASES[0] || (currentPct ?? 0) > 0))
  const sizeOf = (p: Project) => `${p.languageName} (${p.languageCode}) · ${p.books.length === 1 ? t('inicio.unLibro') : t('inicio.libros', { n: p.books.length })}`
  const others = project ? project.books.filter((b) => b !== current) : []

  const suggestion =
    copies.place && copies.failed ? (
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
    )

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
                    {resumed ? t('inicio.sigaDonde', { nombre: person }) : begun ? t('inicio.sigaCon', { nombre: person }) : t('inicio.empiece', { nombre: person })}
                  </span>
                  <span className="home-current-book">{titleOf(project, current.code)}</span>
                  {resumed && resumeAt && <span className="home-current-where">{resumeAt}</span>}
                  <StepTrack phase={current.phase} />
                  <span className="home-current-step">
                    {t('inicio.pasoDe', { n: PHASES.indexOf(current.phase) + 1, total: PHASES.length, paso: t(`pasos.${current.phase}`) })}
                  </span>
                  <button
                    type="button"
                    className="button-primary"
                    onClick={() => (resumed ? onResume({ projectId: project.id, book: current.code }) : onBook(project.id, current.code))}
                  >
                    {begun ? t('libro.continuar') : t('libro.empezar')} →
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
              {suggestion}
              {current && (
                <ul className="home-books">
                  {others.map((b) => {
                    const pct = progressOf(project, b.code)
                    return (
                      <li key={b.code}>
                        <button type="button" className="home-book" onClick={() => onBook(project.id, b.code)}>
                          <span className="home-book-name">{titleOf(project, b.code)}</span>
                          <span className="home-book-step">
                            {t(`pasos.${b.phase}Corto`)}
                            {pct !== null && ` · ${pct} %`}
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
