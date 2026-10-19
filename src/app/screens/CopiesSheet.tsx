/**
 * «Copia en la tarjeta» (`frame/copies.ts`; philosophy, principle 9): setting up a copy of the work on a memory card,
 * and what can be done with it after. How each project is kept follows who can see its work (`Privacy`): a project
 * kept to its team goes sealed with the team's password, the same as for «Share» and «Receive»; the rest, open. So
 * nothing is chosen here but the folder; a project kept to its team whose password this phone does not know yet asks
 * for it here, and is not copied until it is given.
 */

import { useEffect, useState } from 'react'
import { MenuRow, Sheet } from '../frame/Sheet'
import { copiesState, copyNow, eraseCopies, onCopies, setUpCopies, stopCopies, type CopiesState } from '../frame/copies'
import { useT } from '../i18n/i18n'
import { loadProjects, privacyOf } from '../projects/model'
import { chooseTeamPassword } from '../projects/teamKeys'

/** The shortest team password, as when it is chosen to share. */
const SHORTEST = 8

export function useCopies(): CopiesState {
  const [state, setState] = useState(copiesState)
  useEffect(() => onCopies(() => setState(copiesState())), [])
  return state
}

/** When a copy was made, as the person would say it: the hour today, else the day and the hour. */
export function whenCopied(at: string, lang: string): string {
  const d = new Date(at)
  const today = new Date().toDateString() === d.toDateString()
  const hour = d.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' })
  return today ? hour : `${d.toLocaleDateString(lang, { day: 'numeric', month: 'short' })} ${hour}`
}

/** The team's password of a project kept to its team, chosen or typed here once, so its copies can be sealed. */
function TeamPassword({ id, name, person }: { id: string; name: string; person: string }) {
  const t = useT()
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [working, setWorking] = useState(false)
  const short = password.length > 0 && password.length < SHORTEST
  const differ = again.length > 0 && again !== password
  return (
    <form
      className="copies-confirm"
      onSubmit={async (e) => {
        e.preventDefault()
        if (password.length < SHORTEST || again !== password) return
        setWorking(true)
        await chooseTeamPassword(id, password)
        setPassword('')
        setAgain('')
        await copyNow(person)
        setWorking(false)
      }}
    >
      <p>{t('copias.faltaContrasena', { proyecto: name })}</p>
      <label className="field">
        <span className="field-label">{t('compartir.contrasenaEquipo')}</span>
        <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {short && <span className="field-problem">{t('copias.corta', { n: SHORTEST })}</span>}
      </label>
      <label className="field">
        <span className="field-label">{t('copias.otraVez')}</span>
        <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
        {differ && <span className="field-problem">{t('copias.noIguales')}</span>}
      </label>
      <p className="quiet">{t('compartir.contrasenaAyuda')}</p>
      <button type="submit" className="button-secondary" disabled={password.length < SHORTEST || again !== password || working}>
        {working ? t('copias.copiando') : t('copias.guardarContrasena')}
      </button>
    </form>
  )
}

export function CopiesSheet({ person, onClose }: { person: string; onClose(): void }) {
  const t = useT()
  const state = useCopies()
  const [working, setWorking] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [erasing, setErasing] = useState(false)
  const lang = document.documentElement.lang || 'es'
  // How the projects of this phone will be kept: said once, plainly, by who can see each.
  const projects = loadProjects()
  const team = projects.some((p) => privacyOf(p) === 'equipo')
  const open = projects.some((p) => privacyOf(p) !== 'equipo')
  const how = team && open ? t('copias.comoAmbos') : team ? t('copias.comoEquipo') : t('copias.comoAbierto')

  if (state.place) {
    const { place } = state
    return (
      <Sheet title={t('copias.titulo')} onClose={onClose}>
        <div className="copies">
          <p>{t('copias.donde', { lugar: place.label })}</p>
          <p className="quiet">
            {state.failed === 'missing'
              ? t('copias.faltaTarjeta')
              : state.failed
                ? t('copias.noSePudo')
                : state.at
                  ? t('copias.ultima', { cuando: whenCopied(state.at, lang) })
                  : t('copias.todaviaNo')}
          </p>
          <button
            type="button"
            className="button-primary"
            disabled={working}
            onClick={async () => {
              setWorking(true)
              setSaid(null)
              await copyNow(person, true)
              setWorking(false)
            }}
          >
            {working ? t('copias.copiando') : t('copias.ahora')}
          </button>
          <p className="quiet">{how}</p>
          {(state.waiting ?? []).map((w) => (
            <TeamPassword key={w.id} id={w.id} name={w.name} person={person} />
          ))}
          <MenuRow label={t('copias.borrar')} description={t('copias.borrarAyuda')} onClick={() => setErasing(true)} />
          {erasing && (
            <div className="copies-confirm" role="alertdialog" aria-label={t('copias.borrarPregunta')}>
              <p>{t('copias.borrarPregunta')}</p>
              <div className="copies-confirm-buttons">
                <button
                  type="button"
                  className="button-secondary button-danger"
                  onClick={async () => {
                    setErasing(false)
                    const n = await eraseCopies()
                    setSaid(n === null ? t('copias.noSePudoBorrar') : t('copias.borradas', { n }))
                  }}
                >
                  {t('copias.borrarSi')}
                </button>
                <button type="button" className="button-secondary" onClick={() => setErasing(false)}>
                  {t('copias.noBorrar')}
                </button>
              </div>
            </div>
          )}
          <MenuRow label={t('copias.dejar')} description={t('copias.dejarAyuda')} onClick={() => void stopCopies()} />
          {said && (
            <p className="status" role="status">
              {said}
            </p>
          )}
          {team && <p className="quiet">{t('copias.noProtegeTelefono')}</p>}
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet title={t('copias.titulo')} onClose={onClose}>
      <div className="copies">
        <p>{t('copias.para')}</p>
        <p className="quiet">{how}</p>
        <button
          type="button"
          className="button-primary"
          disabled={working}
          onClick={async () => {
            setWorking(true)
            setSaid(null)
            const done = await setUpCopies(person)
            setWorking(false)
            if (done === 'failed') setSaid(t('copias.noSePudo'))
          }}
        >
          {working ? t('copias.copiando') : t('copias.elegirCarpeta')}
        </button>
        <p className="quiet">{t('copias.carpetaAyuda')}</p>
        {said && (
          <p className="notice" role="alert">
            {said}
          </p>
        )}
        {team && <p className="quiet">{t('copias.noProtegeTelefono')}</p>}
      </div>
    </Sheet>
  )
}
