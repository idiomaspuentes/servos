/**
 * «Proyectos archivados», from the person's menu: the projects taken out of home, each with what can be done with it
 * (philosophy, principle 12: chips beside the thing). «Sacar del archivo» brings it back to home as it was. «Eliminar
 * para siempre», outlined in red, asks first and says what goes and what stays (principle 9, nothing lost by surprise):
 * everything of it on this device goes (`projects/forget.ts`); what was uploaded to Door43 and the copy already on the
 * memory card stay. So deleting a project takes four steps, two of them a yes: archive, say yes, open the archive,
 * delete and say yes again (asked by the teams trying the app, October 2026).
 */

import { useState } from 'react'
import { Sheet } from '../frame/Sheet'
import { useI18n } from '../i18n/i18n'
import { archivedProjects, type Project } from '../projects/model'

export function ArchivedSheet({
  projects,
  onClose,
  onRestore,
  onDelete,
}: {
  projects: Project[]
  onClose(): void
  onRestore(id: string): void
  /** Deletes the project for good (asked first here). */
  onDelete(id: string): Promise<void>
}) {
  const { t, language } = useI18n()
  const [asking, setAsking] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleted, setDeleted] = useState<string | null>(null)
  const archived = archivedProjects(projects)
  const when = (at: string) => new Date(at).toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <Sheet title={t('archivo.titulo')} onClose={onClose}>
      {deleted && (
        <p className="status" role="status">
          {t('archivo.eliminado', { nombre: deleted })}
        </p>
      )}
      {archived.length === 0 ? (
        <p className="quiet">{t('archivo.vacio')}</p>
      ) : (
        <ul className="archived-list">
          {archived.map((p) => (
            <li key={p.id} className="archived-item">
              <span className="archived-name">{p.name}</span>
              <span className="quiet">
                {`${p.languageName} (${p.languageCode}) · `}
                {p.books.length === 1 ? t('inicio.unLibro') : t('inicio.libros', { n: p.books.length })}
                {' · '}
                {t('archivo.desde', { fecha: when(p.archived!) })}
              </span>
              {asking === p.id ? (
                <div className="copies-confirm" role="alertdialog" aria-label={t('archivo.eliminarPregunta', { nombre: p.name })}>
                  <p>{t('archivo.eliminarPregunta', { nombre: p.name })}</p>
                  <p className="quiet">{t('archivo.eliminarQue')}</p>
                  <div className="copies-confirm-buttons">
                    <button
                      type="button"
                      className="button-secondary button-danger"
                      disabled={deleting}
                      onClick={async () => {
                        setDeleting(true)
                        await onDelete(p.id)
                        setDeleting(false)
                        setAsking(null)
                        setDeleted(p.name)
                      }}
                    >
                      {t('archivo.eliminarSi')}
                    </button>
                    <button type="button" className="button-secondary" disabled={deleting} onClick={() => setAsking(null)}>
                      {t('archivo.eliminarNo')}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="chip-row">
                  <button type="button" className="chip" onClick={() => onRestore(p.id)}>
                    ↩ {t('archivo.sacar')}
                  </button>
                  <button
                    type="button"
                    className="chip button-danger"
                    onClick={() => {
                      setDeleted(null)
                      setAsking(p.id)
                    }}
                  >
                    {t('archivo.eliminar')}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
