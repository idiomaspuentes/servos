/**
 * Home, as translationCore 4's (`src/views/Home.jsx`): where the person left off, said exactly (the mini app and the
 * verse) with the one filled button, «Continue →», which opens that mini app there; then a card per project with its
 * books, each with the step it is in and how far that step has gone. Each action has the shape of what it adds or
 * changes: adding a book is one more tile among the books, dashed; the project's settings, a small bordered button
 * by its name, as on tC4's project cards; adding a project, one more card after them all, dashed, saying what it
 * can be. Dashed is kept for adding, so two things that mean something different do not look alike.
 */

import { BrandMark } from '../frame/BrandMark'
import { useT } from '../i18n/i18n'
import { titleOf, type Project } from '../projects/model'

export interface Resume {
  projectId: string
  book: string
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
}) {
  const t = useT()
  const resumeProject = resume && projects.find((p) => p.id === resume.projectId)
  const resumeBook = resumeProject?.books.find((b) => b.code === resume!.book)
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
      <main className="main">
        {resumeProject && resumeBook && (
          <section className="book-resume is-field" aria-label={t('libro.sigaDonde')}>
            <span className="book-resume-kicker">{t('libro.sigaDonde')}</span>
            <span className="book-resume-what">{resumeAt ?? `${titleOf(resumeProject, resumeBook.code)} · ${t(`pasos.${resumeBook.phase}`)}`}</span>
            <span className="quiet book-resume-project">{resumeProject.name}</span>
            <button type="button" className="button-primary" onClick={() => onResume(resume!)}>
              {t('libro.continuar')} →
            </button>
          </section>
        )}
        {/* On a wide window the projects are a column of their own, beside the field (principle 13); on a phone this box
            is not drawn and they follow it, as before (wide.css). */}
        <div className="home-projects">
          {projects.length === 0 ? (
            // The first time, the one thing to do: the team's project.
            <section className="book-resume is-field" aria-label={t('inicio.paraEmpezar')}>
              <span className="book-resume-kicker">{t('inicio.paraEmpezar')}</span>
              <span className="book-resume-what">{t('inicio.primerProyecto')}</span>
              <span className="quiet book-resume-project">{t('inicio.agregarProyectoAyuda')}</span>
              <button type="button" className="button-primary" onClick={onAddProject}>
                {t('inicio.agregarProyecto')} →
              </button>
            </section>
          ) : (
            <h1>{t('inicio.tusProyectos')}</h1>
          )}
          {projects.map((p) => (
            <article key={p.id} className="project-card">
              <div className="project-card-head">
                <div>
                  <h2>{p.name}</h2>
                  <p className="quiet">
                    {p.languageName} ({p.languageCode}) · {p.books.length === 1 ? t('inicio.unLibro') : t('inicio.libros', { n: p.books.length })}
                  </p>
                </div>
                <button type="button" className="project-settings" onClick={() => onSettings(p.id)}>
                  {t('inicio.ajustes')}
                </button>
              </div>
              <div className="book-tiles">
                {p.books.map((b) => {
                  const pct = progressOf(p, b.code)
                  return (
                    <button key={b.code} type="button" className="book-tile" onClick={() => onBook(p.id, b.code)}>
                      <span className="book-tile-name">{titleOf(p, b.code)}</span>
                      <span className="book-tile-phase">
                        {t(`pasos.${b.phase}Corto`)}
                        {pct !== null && ` · ${pct} %`}
                      </span>
                      {pct !== null && (
                        <span className="progress-bar" aria-hidden="true" data-full={pct >= 100 || undefined}>
                          <span style={{ width: `${pct}%` }} />
                        </span>
                      )}
                    </button>
                  )
                })}
                <button type="button" className="book-tile add-tile" onClick={() => onAddBook(p.id)}>
                  <span className="add-tile-plus" aria-hidden="true">
                    +
                  </span>
                  <span>{t('inicio.agregarLibro')}</span>
                </button>
              </div>
            </article>
          ))}
          {projects.length > 0 && (
            <button type="button" className="add-card" onClick={onAddProject}>
              <span className="add-tile-plus" aria-hidden="true">
                +
              </span>
              <span className="add-card-title">{t('inicio.agregarProyecto')}</span>
              <span className="quiet">{t('inicio.agregarProyectoAyuda')}</span>
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
