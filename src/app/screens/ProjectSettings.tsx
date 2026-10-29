/**
 * A project's settings, on its card as in translationCore 4 (`ProjectSettings.jsx`): its name, its language (searched in
 * Door43's list, as when it was created) and the direction it is written in, and — Servos's own — which mini apps each
 * step uses. Whoever coordinates chooses; every phone in the project then sees the same, so the person translating
 * never has to choose. So is who can see the team's work outside the app (`PrivacyChoice`); and, for a project kept to
 * its team, this device can forget the team's password (`projects/teamKeys.ts`), to be asked for it again.
 *
 * At the end, the project can be archived, once the person says yes: it leaves home with all its work kept, and from
 * the archive (the person's menu) it comes back or, said yes to again, is deleted for good (`ArchivedSheet`).
 */

import { useEffect, useRef, useState } from 'react'
import { MenuRow } from '../frame/Sheet'
import { LanguageSearch } from '../frame/LanguageSearch'
import { useT } from '../i18n/i18n'
import { miniAppsFor } from '../miniapps/registry'
import { writtenRightToLeft } from '../projects/languages'
import { PHASES, privacyOf, type Phase, type Privacy, type Project } from '../projects/model'
import { PrivacyChoice } from './PrivacyChoice'
import { FONTS, HelpsChoice, VERSIFICATIONS } from './NewProject'
import { ShareSheet } from './ShareSheet'
import { forgetTeamKeys, teamKey } from '../projects/teamKeys'

export function ProjectSettings({
  project,
  person,
  onBack,
  onSave,
  onArchive,
}: {
  project: Project
  person: string
  onBack(): void
  onSave(p: Project): void
  /** Archives the project (asked first here). */
  onArchive(): void
}) {
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
  // Whether this device keeps the team's password of the project, and whether it was just forgotten.
  const [keyHere, setKeyHere] = useState(false)
  const [forgotten, setForgotten] = useState(false)
  const [archiving, setArchiving] = useState(false)
  // The question comes into sight, above the save button kept at the foot.
  const question = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (archiving) question.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [archiving])
  useEffect(() => {
    void teamKey(project.id).then((k) => setKeyHere(k !== null))
  }, [project.id, sharing])
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
        {keyHere && (
          <MenuRow
            label={t('ajustes.olvidarContrasena')}
            description={t('ajustes.olvidarContrasenaAyuda')}
            onClick={async () => {
              await forgetTeamKeys(project.id)
              setKeyHere(false)
              setForgotten(true)
            }}
          />
        )}
        {forgotten && (
          <p className="status" role="status">
            {t('ajustes.contrasenaOlvidada')}
          </p>
        )}

        {project.books.length > 0 && (
          <section className="settings-share">
            <h1>{t('ajustes.compartir')}</h1>
            <p className="quiet">{t('ajustes.compartirAyuda')}</p>
            <button type="button" className="button-secondary" onClick={() => setSharing(true)}>
              {t('ajustes.compartirBoton')}
            </button>
          </section>
        )}

        {/* Archiving takes a yes (philosophy, principle 9): nothing is lost, but the project leaves home. */}
        <MenuRow label={t('ajustes.archivar')} description={t('ajustes.archivarAyuda')} onClick={() => setArchiving(true)} />
        {archiving && (
          <div ref={question} className="copies-confirm" role="alertdialog" aria-label={t('ajustes.archivarPregunta', { nombre: project.name })}>
            <p>{t('ajustes.archivarPregunta', { nombre: project.name })}</p>
            <p className="quiet">{t('ajustes.archivarQue')}</p>
            <div className="copies-confirm-buttons">
              <button type="button" className="button-secondary" onClick={onArchive}>
                {t('ajustes.archivarSi')}
              </button>
              <button type="button" className="button-secondary" onClick={() => setArchiving(false)}>
                {t('ajustes.archivarNo')}
              </button>
            </div>
          </div>
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
