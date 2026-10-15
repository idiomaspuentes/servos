/**
 * Home, as translationCore 4's (`src/views/Home.jsx`): «Continue» where the person left off, «+ Add a project», and a
 * card per project with its books. A project's settings and sharing live on its card, not inside the work screens.
 */

import { useT } from '../i18n/i18n'
import { bookName, type Project } from '../projects/model'

export interface Resume {
  projectId: string
  book: string
}

export function Home({
  projects,
  person,
  resume,
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
        <span className="header-brand">Servos</span>
        <button type="button" className="header-person-chip" onClick={onPersonMenu}>
          {person} ▾
        </button>
      </header>
      <main className="main">
        {resumeProject && resumeBook && (
          <button type="button" className="button-primary resume" onClick={() => onResume(resume!)}>
            <span>{t('inicio.seguir', { libro: bookName(resumeBook.code), paso: t(`pasos.${resumeBook.phase}`) })}</span>
            <span className="resume-project">{resumeProject.name}</span>
          </button>
        )}
        <button type="button" className="button-secondary" onClick={onAddProject}>
          {t('inicio.agregarProyecto')}
        </button>

        <h1>{t('inicio.tusProyectos')}</h1>
        {projects.length === 0 && <p className="quiet">{t('inicio.sinProyectos')}</p>}
        {projects.map((p) => (
          <article key={p.id} className="project-card">
            <h2>{p.name}</h2>
            <p className="quiet">
              {p.languageName} ({p.languageCode}) · {p.books.length === 1 ? t('inicio.unLibro') : t('inicio.libros', { n: p.books.length })}
            </p>
            <div className="book-tiles">
              {p.books.map((b) => (
                <button key={b.code} type="button" className="book-tile" onClick={() => onBook(p.id, b.code)}>
                  <span className="book-tile-name">{bookName(b.code)}</span>
                  <span className="book-tile-phase">{t(`pasos.${b.phase}`)}</span>
                </button>
              ))}
            </div>
            <div className="card-actions">
              <button type="button" className="button-quiet" onClick={() => onAddBook(p.id)}>
                {t('inicio.agregarLibro')}
              </button>
              <button type="button" className="button-quiet" onClick={() => onSettings(p.id)}>
                {t('inicio.ajustes')}
              </button>
              <button type="button" className="button-quiet" disabled title={t('inicio.compartirAyuda')}>
                {t('inicio.compartir')}
              </button>
            </div>
          </article>
        ))}
      </main>
    </div>
  )
}
