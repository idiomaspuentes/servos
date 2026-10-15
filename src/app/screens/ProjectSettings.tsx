/**
 * A project's settings, on its card as in translationCore 4 (`ProjectSettings.jsx`): the language, and — Servos's
 * own — which mini apps each step uses. Whoever coordinates chooses; every phone in the project then sees the same,
 * so the person translating never has to choose.
 */

import { useState } from 'react'
import { useT } from '../i18n/i18n'
import { miniAppsFor } from '../miniapps/registry'
import { PHASES, type Phase, type Project } from '../projects/model'

export function ProjectSettings({ project, onBack, onSave }: { project: Project; onBack(): void; onSave(p: Project): void }) {
  const t = useT()
  const [chosen, setChosen] = useState<Record<Phase, string[]>>(project.miniApps)
  const toggle = (phase: Phase, id: string) =>
    setChosen((c) => ({ ...c, [phase]: c[phase].includes(id) ? c[phase].filter((x) => x !== id) : [...c[phase], id] }))

  return (
    <div className="screen">
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onBack}>
          ‹ {t('marco.volver')}
        </button>
        <div className="header-title">
          <span className="header-app">{t('ajustes.titulo')}</span>
          <span className="header-person">{project.name}</span>
        </div>
        <span />
      </header>
      <main className="main">
        <p className="quiet">
          {t('ajustes.idioma', {
            idioma: project.languageName,
            codigo: project.languageCode,
            direccion: t(project.direction === 'ltr' ? 'nuevo.izquierda' : 'nuevo.derecha'),
          })}
        </p>
        <h1>{t('ajustes.miniApps')}</h1>
        <p className="quiet">{t('ajustes.miniAppsAyuda')}</p>
        {PHASES.map((phase) => (
          <fieldset key={phase} className="settings-phase">
            <legend>{t(`pasos.${phase}`)}</legend>
            {miniAppsFor(phase).map((app) => (
              <label key={app.id} className="check check-two-lines">
                <input type="checkbox" checked={chosen[phase].includes(app.id)} onChange={() => toggle(phase, app.id)} />
                <span>
                  <span className="app-row-name">
                    {t(`${app.id}.nombre`)}
                    {app.comingSoon && <span className="badge">{t('catalogo.pronto')}</span>}
                  </span>
                  <span className="quiet">{t(`${app.id}.descripcion`)}</span>
                </span>
              </label>
            ))}
          </fieldset>
        ))}
        <button type="button" className="button-primary" onClick={() => onSave({ ...project, miniApps: chosen })}>
          {t('ajustes.guardar')}
        </button>
      </main>
    </div>
  )
}
