/**
 * «Copia de su trabajo», in the person's Door43 account sheet (`frame/door43Copy.ts`; philosophy, principle 9): each
 * project's copy switched on or off, Wi-Fi only or mobile data too, and when the last copy went. For a project kept to
 * its team the switch says, beside it and before it is touched, how the copy goes and what a watched network can see:
 * switching it on is the one, knowing consent. Nothing here says the network is safe; the app cannot know it.
 */

import { useEffect, useState } from 'react'
import { Switch } from '../frame/Actions'
import { onDesktop } from '../frame/desktop'
import { copyOn, copyToDoor43Now, copyWaitsFor, door43CopyState, onDoor43Copy, setCopyData, setCopyOn, type Door43CopyState } from '../frame/door43Copy'
import { useT } from '../i18n/i18n'
import { loadProjects, privacyOf, type Project } from '../projects/model'
import { TeamPassword } from './CopiesSheet'

export function useDoor43Copy(person: string): Door43CopyState {
  const [state, setState] = useState(() => door43CopyState(person))
  useEffect(() => {
    setState(door43CopyState(person))
    return onDoor43Copy(() => setState(door43CopyState(person)))
  }, [person])
  return state
}

/** When a copy went, as the person would say it: «hoy, 10:42», «ayer, 18:05», «24 oct., 9:30». */
export function whenItWent(at: string, t: ReturnType<typeof useT>, lang: string, now = new Date()): string {
  const d = new Date(at)
  const hora = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === now.toDateString()) return t('copiaDoor43.hoy', { hora })
  if (d.toDateString() === yesterday.toDateString()) return t('copiaDoor43.ayer', { hora })
  return `${d.toLocaleDateString(lang, { day: 'numeric', month: 'short' })}, ${hora}`
}

export function Door43CopySection({ person }: { person: string }) {
  const t = useT()
  const state = useDoor43Copy(person)
  const [projects] = useState<Project[]>(() => loadProjects())
  // What each project's copy waits for (its place on Door43, the team's password here), looked up again after a change.
  const [waits, setWaits] = useState<Record<string, 'lugar' | 'contrasena' | null>>({})
  const [round, setRound] = useState(0)
  useEffect(() => {
    let gone = false
    void Promise.all(projects.map(async (p) => [p.id, await copyWaitsFor(p)] as const)).then((all) => !gone && setWaits(Object.fromEntries(all)))
    return () => {
      gone = true
    }
  }, [projects, round])
  if (!projects.length) return null
  const lang = document.documentElement.lang || 'es'
  const single = projects.length === 1
  const anyOn = projects.some((p) => copyOn(person, p))
  // How the copy goes is said once when it goes the same way for every project, and by each project when not.
  const team = (p: Project) => privacyOf(p) === 'equipo'
  const allSame = projects.every((p) => team(p) === team(projects[0]))
  const how = (p: Project) => <p className="quiet">{t(team(p) ? 'copiaDoor43.sellada' : 'copiaDoor43.privada')}</p>
  const today = state.tried && new Date(state.tried).toDateString() === new Date().toDateString()

  return (
    <section className="door43-copy" aria-label={t('copiaDoor43.titulo')}>
      <h3 className="menu-heading">{t('copiaDoor43.titulo')}</h3>
      <p className="quiet">{t('copiaDoor43.para')}</p>
      {!single && <p className="door43-copy-ask">{t('copiaDoor43.guardar')}</p>}
      {projects.map((p) => {
        const on = copyOn(person, p)
        return (
          <div key={p.id} className="door43-copy-project">
            <Switch label={single ? t('copiaDoor43.guardar') : p.name} on={on} onChange={(v) => setCopyOn(person, p.id, v)} />
            {!allSame && how(p)}
            {on && waits[p.id] === 'lugar' && <p className="quiet">{t('copiaDoor43.faltaLugar')}</p>}
            {on && waits[p.id] === 'contrasena' && (
              <TeamPassword
                id={p.id}
                name={p.name}
                person={person}
                then={async () => {
                  setRound((n) => n + 1)
                  await copyToDoor43Now(person)
                }}
              />
            )}
          </div>
        )
      })}
      {allSame && how(projects[0])}
      {anyOn && !onDesktop() && (
        <div className="choice-row" role="radiogroup" aria-label={t('copiaDoor43.red')}>
          {[false, true].map((data) => (
            <button key={String(data)} type="button" role="radio" aria-checked={state.data === data} className={state.data === data ? 'choice is-on' : 'choice'} onClick={() => setCopyData(person, data)}>
              {t(data ? 'copiaDoor43.conDatos' : 'copiaDoor43.soloWifi')}
            </button>
          ))}
        </div>
      )}
      {anyOn &&
        (state.problem === 'pin' && today ? (
          <p className="notice" role="status">
            {t('copiaDoor43.noEraDoor43')}
          </p>
        ) : state.problem ? (
          <p className="notice" role="status">
            {t('copiaDoor43.noSePudo', { porque: t(`door43.problema.${state.problem}`) })}
          </p>
        ) : (
          <p className="quiet" role="status">
            {state.at ? t('copiaDoor43.ultima', { cuando: whenItWent(state.at, t, lang) }) : t('copiaDoor43.todaviaNo')}
          </p>
        ))}
    </section>
  )
}
