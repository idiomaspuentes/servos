/**
 * «Copia en la tarjeta» (`frame/copies.ts`; philosophy, principle 9): setting up a copy of the work on a memory card,
 * and what can be done with it after. Before anything is written, how it is kept is chosen, each choice saying in
 * plain words what it means: some teams translate where the Bible is banned, and a card anyone can read could cost
 * them their freedom or their life. With a password is the one recommended; what it does not protect is said too.
 */

import { useEffect, useState } from 'react'
import { MenuRow, Sheet } from '../frame/Sheet'
import { copiesState, copyNow, eraseCopies, onCopies, setUpCopies, stopCopies, type CopiesState } from '../frame/copies'
import { useT } from '../i18n/i18n'

/** The shortest password taken: long enough that guessing it takes years, short enough to remember. */
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

export function CopiesSheet({ person, onClose }: { person: string; onClose(): void }) {
  const t = useT()
  const state = useCopies()
  const [locked, setLocked] = useState(true)
  const [password, setPassword] = useState('')
  const [again, setAgain] = useState('')
  const [working, setWorking] = useState(false)
  const [said, setSaid] = useState<string | null>(null)
  const [erasing, setErasing] = useState(false)
  const lang = document.documentElement.lang || 'es'

  if (state.place) {
    const { place } = state
    return (
      <Sheet title={t('copias.titulo')} onClose={onClose}>
        <div className="copies">
          <p>
            {t('copias.donde', { lugar: place.label })} · {t(place.locked ? 'copias.conContrasena' : 'copias.sinContrasena')}
          </p>
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
          {!place.locked && <p className="notice">{t('copias.sinContrasenaAviso')}</p>}
          <MenuRow
            label={t('copias.borrar')}
            description={t('copias.borrarAyuda')}
            onClick={() => setErasing(true)}
          />
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
          {place.locked && <p className="quiet">{t('copias.noProtegeTelefono')}</p>}
        </div>
      </Sheet>
    )
  }

  const short = locked && password.length > 0 && password.length < SHORTEST
  const differ = locked && again.length > 0 && again !== password
  const ready = !locked || (password.length >= SHORTEST && again === password)
  return (
    <Sheet title={t('copias.titulo')} onClose={onClose} dirty={password !== ''}>
      <div className="copies">
        <p>{t('copias.para')}</p>
        <fieldset className="copies-choice">
          <legend className="field-label">{t('copias.como')}</legend>
          <label className={`copies-option${locked ? ' is-chosen' : ''}`}>
            <input type="radio" name="copia-como" checked={locked} onChange={() => setLocked(true)} />
            <span>
              <strong>{t('copias.conContrasenaRecomendada')}</strong>
              <span className="quiet">{t('copias.conContrasenaQue')}</span>
            </span>
          </label>
          <label className={`copies-option${!locked ? ' is-chosen' : ''}`}>
            <input type="radio" name="copia-como" checked={!locked} onChange={() => setLocked(false)} />
            <span>
              <strong>{t('copias.sinContrasena')}</strong>
              <span className="quiet">{t('copias.sinContrasenaQue')}</span>
            </span>
          </label>
        </fieldset>
        {locked && (
          <>
            <label className="field">
              <span className="field-label">{t('copias.contrasena')}</span>
              <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              {short && <span className="field-problem">{t('copias.corta', { n: SHORTEST })}</span>}
            </label>
            <label className="field">
              <span className="field-label">{t('copias.otraVez')}</span>
              <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} />
              {differ && <span className="field-problem">{t('copias.noIguales')}</span>}
            </label>
            <p className="notice">{t('copias.anotela')}</p>
          </>
        )}
        <button
          type="button"
          className="button-primary"
          disabled={!ready || working}
          onClick={async () => {
            setWorking(true)
            setSaid(null)
            const done = await setUpCopies(locked ? password : null, person)
            setWorking(false)
            if (done === 'done') {
              setPassword('')
              setAgain('')
            } else if (done === 'failed') setSaid(t('copias.noSePudo'))
          }}
        >
          {working ? t('copias.copiando') : t('copias.elegirCarpeta')}
        </button>
        {said && (
          <p className="notice" role="alert">
            {said}
          </p>
        )}
        {locked && <p className="quiet">{t('copias.noProtegeTelefono')}</p>}
      </div>
    </Sheet>
  )
}
