/**
 * A project's settings, on its card as in translationCore 4 (`ProjectSettings.jsx`): its name, its language (searched in
 * Door43's list, as when it was created) and the direction it is written in, and — Servos's own — which mini apps each
 * step uses. Whoever coordinates chooses; every phone in the project then sees the same, so the person translating
 * never has to choose. So is who can see the team's work outside the app (`PrivacyChoice`).
 */

import { useState } from 'react'
import { LanguageSearch } from '../frame/LanguageSearch'
import { useT } from '../i18n/i18n'
import { miniAppsFor } from '../miniapps/registry'
import { writtenRightToLeft } from '../projects/languages'
import { PHASES, privacyOf, type Phase, type Privacy, type Project } from '../projects/model'
import { PrivacyChoice } from './PrivacyChoice'
import { FONTS, HelpsChoice, VERSIFICATIONS } from './NewProject'
import { ShareSheet } from './ShareSheet'

export function ProjectSettings({ project, person, onBack, onSave }: { project: Project; person: string; onBack(): void; onSave(p: Project): void }) {
  const t = useT()
  const [name, setName] = useState(project.name)
  const [language, setLanguage] = useState({ code: project.languageCode, name: project.languageName })
  const [direction, setDirection] = useState(project.direction)
  const [font, setFont] = useState(project.font)
  const [versification, setVersification] = useState(project.versification)
  const [helps, setHelps] = useState(project.helpsLanguage)
  const [chosen, setChosen] = useState<Record<Phase, string[]>>(project.miniApps)
  const [missing, setMissing] = useState(false)
  const [privacy, setPrivacy] = useState<Privacy>(privacyOf(project))
  const [sharing, setSharing] = useState(false)
  const toggle = (phase: Phase, id: string) =>
    setChosen((c) => ({ ...c, [phase]: c[phase].includes(id) ? c[phase].filter((x) => x !== id) : [...c[phase], id] }))
  const save = () => {
    if (!name.trim() || !language.name.trim() || !language.code.trim()) {
      setMissing(true)
      return
    }
    onSave({ ...project, name: name.trim(), languageName: language.name.trim(), languageCode: language.code.trim().toLowerCase(), direction, font, versification, helpsLanguage: helps, miniApps: chosen, privacy })
  }

  return (
    <div className="screen">
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onBack}>
          ‹ {t('marco.inicio')}
        </button>
        <div className="header-title">
          <span className="header-app">{t('ajustes.titulo')}</span>
          <span className="header-person">{project.name}</span>
        </div>
        <span />
      </header>
      <main className="main">
        <h1>{t('ajustes.elProyecto')}</h1>
        <label className="field">
          <span className="field-label">{t('nuevo.nombre')}</span>
          <input value={name} onChange={(e) => (setName(e.target.value), setMissing(false))} />
        </label>
        <LanguageSearch
          label={t('nuevo.idioma')}
          value={language}
          onChange={(l) => {
            setLanguage(l)
            setMissing(false)
            // A language written from right to left sets the direction; it can still be changed below.
            if (l.code && l.code !== project.languageCode) setDirection(writtenRightToLeft(l.code) ? 'rtl' : 'ltr')
          }}
        />
        <fieldset className="field">
          <legend className="field-label">{t('nuevo.direccion')}</legend>
          <div className="choice-row">
            {(['ltr', 'rtl'] as const).map((d) => (
              <button key={d} type="button" className={direction === d ? 'choice is-on' : 'choice'} aria-pressed={direction === d} onClick={() => setDirection(d)}>
                {t(d === 'ltr' ? 'nuevo.izquierda' : 'nuevo.derecha')}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend className="field-label">{t('nuevo.ayudas')}</legend>
          <HelpsChoice value={helps} onChange={setHelps} />
        </fieldset>
        <label className="field">
          <span className="field-label">{t('nuevo.letra')}</span>
          <select value={font} onChange={(e) => setFont(e.target.value)}>
            {[...new Set([font, ...FONTS])].map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <details className="advanced">
          <summary>{t('nuevo.versificacion')}</summary>
          <label className="field">
            <span className="quiet">{t('nuevo.versificacionAyuda')}</span>
            <select value={versification} onChange={(e) => setVersification(e.target.value)}>
              {[...new Set([versification, ...VERSIFICATIONS])].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
        </details>

        <PrivacyChoice value={privacy} onChange={setPrivacy} ask />

        {project.books.length > 0 && (
          <section className="settings-share">
            <h1>{t('ajustes.compartir')}</h1>
            <p className="quiet">{t('ajustes.compartirAyuda')}</p>
            <button type="button" className="button-secondary" onClick={() => setSharing(true)}>
              {t('ajustes.compartirBoton')}
            </button>
          </section>
        )}

        {/* Chosen once by whoever coordinates, and long: folded, saying how many are in use (philosophy, principle 3). */}
        <details className="advanced settings-apps">
          <summary>
            {t('ajustes.miniApps')}
            <span className="quiet">· {t('ajustes.enUso', { n: PHASES.reduce((n, p) => n + chosen[p].length, 0) })}</span>
          </summary>
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
        </details>
        <div className="settings-save">
          {missing && (
            <p className="notice" role="alert">
              {t('ajustes.falta')}
            </p>
          )}
          <button type="button" className="button-primary" onClick={save}>
            {t('ajustes.guardar')}
          </button>
        </div>
      </main>
      {sharing && <ShareSheet project={project} books={project.books.map((b) => b.code)} person={person} onClose={() => setSharing(false)} />}
    </div>
  )
}
