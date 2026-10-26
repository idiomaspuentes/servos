/**
 * The team's organization on Door43 (design, section 8), when whoever coordinates is in none yet, or not in the team's:
 * making one, its maker in it, with who can see what it keeps; or finding the team's among those Door43 shows. Door43
 * has no way to ask to join one: someone in it adds the person, so finding it says so and gives the person's Door43
 * user name to send them. The organizations only their members see do not show up: their name is asked of whoever
 * coordinates. Whoever owns it adds people from Servos too (`AddToOrgSheet`).
 */

import { useState } from 'react'
import { Sheet } from '../frame/Sheet'
import { onDesktop } from '../frame/desktop'
import { onPhone, shareTextOnPhone } from '../frame/phone'
import { BASE_LANGUAGES, baseText, useT } from '../i18n/i18n'
import {
  OrgError,
  TEAM,
  addToOrg,
  createTeamOrg,
  findOrgs,
  lookUpPerson,
  problemOf,
  userFromMessage,
  validName,
  type Door43Account,
  type Door43Person,
} from '../projects/door43'

export function CreateOrgSheet({
  account,
  proposed,
  teamOnly,
  onClose,
  onMade,
}: {
  account: Door43Account
  proposed: string
  /** The project is kept to its team: «Only its members» is proposed. */
  teamOnly: boolean
  onClose(): void
  onMade(name: string): void
}) {
  const t = useT()
  const [name, setName] = useState(proposed)
  const [privately, setPrivately] = useState(teamOnly)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const ok = validName(name)
  return (
    <Sheet title={t('org.crearTitulo')} onClose={onClose}>
      <form
        className="glossary-form"
        onSubmit={async (e) => {
          e.preventDefault()
          // Drawn apart in the page, but React still hands its events to the screen behind it, its form too.
          e.stopPropagation()
          if (!ok || busy) return
          setBusy(true)
          setProblem(null)
          try {
            onMade(await createTeamOrg(account, name, privately))
          } catch (err) {
            const p = err instanceof OrgError ? err.problem : problemOf(err)
            setProblem(t(p === 'taken' || p === 'notAllowed' ? `org.problema.${p}` : `door43.problema.${p}`, { nombre: name }))
            setBusy(false)
          }
        }}
      >
        <label className="field">
          <span className="field-label">{t('org.nombre')}</span>
          <input value={name} onChange={(e) => setName(e.target.value.trim())} autoCapitalize="none" spellCheck={false} />
          {name && !ok ? <span className="field-problem">{t('org.nombreMal')}</span> : <span className="quiet">{t('org.nombreAyuda')}</span>}
        </label>
        <fieldset className="field">
          <legend className="field-label">{t('org.quienVe')}</legend>
          <div className="choice-row" role="radiogroup" aria-label={t('org.quienVe')}>
            {[true, false].map((p) => (
              <button key={String(p)} type="button" role="radio" aria-checked={privately === p} className={privately === p ? 'choice is-on' : 'choice'} onClick={() => setPrivately(p)}>
                {t(p ? 'org.soloMiembros' : 'org.cualquiera')}
              </button>
            ))}
          </div>
          <span className="quiet">{t(privately ? 'org.soloMiembrosAyuda' : 'org.cualquieraAyuda')}</span>
        </fieldset>
        {problem && (
          <p className="notice" role="alert">
            {problem}
          </p>
        )}
        <button type="submit" className="button-primary" disabled={!ok || busy}>
          {busy ? t('org.creando') : t('org.crear')}
        </button>
      </form>
    </Sheet>
  )
}

export function FindOrgSheet({
  account,
  mine,
  onClose,
  onChoose,
}: {
  account: Door43Account
  /** The organizations the person is in already: one found among them is simply chosen. */
  mine: string[]
  onClose(): void
  onChoose(name: string): void
}) {
  const t = useT()
  const [asked, setAsked] = useState('')
  const [found, setFound] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [chosen, setChosen] = useState<string | null>(null)
  const [said, setSaid] = useState<string | null>(null)
  // The phone's share sheet, or the browser's; on a computer, copied to be pasted in a message.
  const canShare = onPhone() || (!onDesktop() && typeof navigator !== 'undefined' && 'share' in navigator)
  const message = (org: string) => t('org.mensaje', { usuario: account.username, org })
  const send = async (org: string) => {
    setSaid(null)
    try {
      if (onPhone()) await shareTextOnPhone(message(org))
      else if (canShare) await navigator.share({ text: message(org) })
      else {
        await navigator.clipboard.writeText(message(org))
        setSaid(t('org.copiado'))
      }
    } catch {
      /* the sheet was left without sending: nothing to say */
    }
  }

  const search = async () => {
    if (!asked.trim()) return
    setBusy(true)
    setProblem(null)
    setChosen(null)
    try {
      setFound(await findOrgs(account, asked))
    } catch (e) {
      setProblem(t(`door43.problema.${problemOf(e)}`))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={t('org.buscarTitulo')} onClose={onClose}>
      <div className="glossary-form">
        {chosen ? (
          <>
            <p>
              <strong>{chosen}</strong>
            </p>
            <p>{t('org.agregarle', { org: chosen })}</p>
            <p className="org-user">
              <span className="quiet">{t('org.suUsuario')}</span> <strong>{account.username}</strong>
            </p>
            <button type="button" className="button-primary" onClick={() => void send(chosen)}>
              {canShare ? t('org.compartirUsuario') : t('org.copiarUsuario')}
            </button>
            {said && (
              <p className="status" role="status">
                ✓ {said}
              </p>
            )}
            <p className="quiet">{t('org.despues')}</p>
            <button type="button" className="button-secondary" onClick={() => setChosen(null)}>
              {t('org.otraBusqueda')}
            </button>
          </>
        ) : (
          <>
            <form
              className="org-search"
              onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                void search()
              }}
            >
              <input
                type="search"
                className="destination-search"
                value={asked}
                placeholder={t('org.buscarNombre')}
                aria-label={t('org.buscarNombre')}
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
                autoFocus
                onChange={(e) => setAsked(e.target.value)}
              />
              <button type="submit" className="button-secondary" disabled={busy || !asked.trim()}>
                {busy ? t('org.buscando') : t('org.buscar')}
              </button>
            </form>
            {problem && (
              <p className="notice" role="alert">
                {problem}
              </p>
            )}
            {found && found.length === 0 && <p className="quiet">{t('org.ninguna', { texto: asked.trim() })}</p>}
            {found && found.length > 0 && (
              <div className="destination-orgs">
                {found.map((o) => (
                  <button key={o} type="button" className="row-button org-found" onClick={() => (mine.includes(o) ? onChoose(o) : setChosen(o))}>
                    <span className="row-button-label">{o}</span>
                    {mine.includes(o) && <span className="row-button-meta">{t('org.yaEsta')}</span>}
                  </button>
                ))}
              </div>
            )}
            {/* After what was found: those only their members see are never among it. */}
            <p className="quiet">{t('org.privadas')}</p>
          </>
        )}
      </div>
    </Sheet>
  )
}

/**
 * Adding someone to the team's organization, for whoever owns it (only owners may, on Door43): the user name the person
 * sent, or the whole message «Compartir mi usuario» sent; who that is on Door43, said before adding them; then into the
 * translators' team (`addToOrg`). Opened from «Trabajo del equipo».
 */
export function AddToOrgSheet({ account, org, onClose }: { account: Door43Account; org: string; onClose(): void }) {
  const t = useT()
  const [asked, setAsked] = useState('')
  const [busy, setBusy] = useState<'buscando' | 'agregando' | null>(null)
  const [person, setPerson] = useState<Door43Person | null>(null)
  const [missing, setMissing] = useState<string | null>(null)
  const [problem, setProblem] = useState<string | null>(null)
  const [added, setAdded] = useState<Door43Person | null>(null)
  // The message in whatever language the person's Servos speaks: the three the app brings, and this one.
  const templates = [...BASE_LANGUAGES.map((l) => baseText(l, 'org.mensaje') ?? ''), t('org.mensaje')].filter(Boolean)
  const nameOf = (p: Door43Person) => p.fullName ?? p.login
  const said = (e: unknown) => {
    const p = problemOf(e)
    setProblem(p === 'permission' ? t('org.agregarNoDeja', { org }) : t(`door43.problema.${p}`))
  }

  const search = async () => {
    const username = userFromMessage(asked, templates)
    if (!username) return
    setBusy('buscando')
    setProblem(null)
    setMissing(null)
    setPerson(null)
    try {
      const found = await lookUpPerson(account, org, username)
      if (found) setPerson(found)
      else setMissing(username)
    } catch (e) {
      said(e)
    } finally {
      setBusy(null)
    }
  }
  const add = async () => {
    if (!person) return
    setBusy('agregando')
    setProblem(null)
    try {
      await addToOrg(account, org, person.login)
      setAdded(person)
      setPerson(null)
      setAsked('')
    } catch (e) {
      said(e)
    } finally {
      setBusy(null)
    }
  }

  return (
    <Sheet title={t('org.agregarTitulo', { org })} onClose={onClose}>
      <div className="glossary-form">
        {added ? (
          <>
            <p className="review-done" role="status">
              ✓ {t('org.agregado', { nombre: nameOf(added), org })}
            </p>
            <p className="quiet">{t('org.agregadoDespues')}</p>
            <button type="button" className="button-secondary" onClick={() => setAdded(null)}>
              {t('org.agregarOtra')}
            </button>
          </>
        ) : (
          <>
            <p>{t('org.agregarQue')}</p>
            <form
              className="org-search"
              onSubmit={(e) => {
                e.preventDefault()
                // Drawn apart in the page, but React still hands its events to the screen behind it.
                e.stopPropagation()
                void search()
              }}
            >
              <input
                type="search"
                className="destination-search"
                value={asked}
                placeholder={t('org.usuarioDe')}
                aria-label={t('org.usuarioDe')}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
                autoFocus
                onChange={(e) => {
                  setAsked(e.target.value)
                  setPerson(null)
                  setMissing(null)
                }}
              />
              <button type="submit" className="button-secondary" disabled={busy !== null || !asked.trim()}>
                {busy === 'buscando' ? t('org.buscando') : t('org.buscar')}
              </button>
            </form>
            {missing && (
              <p className="notice" role="alert">
                {t('org.nadieAsi', { usuario: missing })}
              </p>
            )}
            {person && (
              <>
                <p className="org-user">
                  <strong>{nameOf(person)}</strong>
                  {person.fullName && <span className="quiet"> · {person.login}</span>}
                </p>
                {person.inOrg ? (
                  <p className="status" role="status">
                    {t('org.yaEstaPersona', { org })}
                  </p>
                ) : (
                  <>
                    <p className="quiet">{t('org.quedara', { equipo: TEAM, org })}</p>
                    <button type="button" className="button-primary" disabled={busy !== null} onClick={() => void add()}>
                      {busy === 'agregando' ? t('org.agregando') : t('org.agregarA', { nombre: nameOf(person) })}
                    </button>
                  </>
                )}
              </>
            )}
            {problem && (
              <p className="notice" role="alert">
                {problem}
              </p>
            )}
          </>
        )}
      </div>
    </Sheet>
  )
}
