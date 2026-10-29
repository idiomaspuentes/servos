/**
 * The team's organization on Door43 (design, section 8), when whoever coordinates is in none yet, or not in the team's:
 * making one, its maker in it, with who can see what it keeps; or finding the team's among those Door43 shows. Door43
 * has no way to ask to join one: someone in it adds the person, so finding it says so and gives the person's Door43
 * user name to send them. The organizations only their members see do not show up: their name is asked of whoever
 * coordinates.
 */

import { useState } from 'react'
import { Sheet } from '../frame/Sheet'
import { onDesktop } from '../frame/desktop'
import { onPhone, shareTextOnPhone } from '../frame/phone'
import { useT } from '../i18n/i18n'
import { OrgError, createTeamOrg, findOrgs, problemOf, validName, type Door43Account } from '../projects/door43'

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
