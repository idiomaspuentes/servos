/**
 * A person's Door43 account on this phone, linked once to publish the team's work (design, section 8). The password is
 * exchanged for a token in one request and not kept; a token made on Door43 itself can be used instead. It links to the
 * real Door43 without asking; Door43's test copy (QA) is offered only to whoever opened the app with `?server=qa`,
 * and, building the app, a mock on this computer.
 */

import { useState } from 'react'
import { Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import { Door43CopySection } from './Door43CopySection'
import { forgetDoor43Prints } from '../frame/door43Copy'
import { HOSTS, accountOf, defaultHost, forgetAccount, hostName, problemOf, signIn, signInWithToken, signUpUrl, type Door43Account } from '../projects/door43'

export function Door43AccountSheet({
  person,
  onClose,
  onLinked,
  host: given,
}: {
  person: string
  onClose(): void
  onLinked?(account: Door43Account): void
  /** The Door43 to link to at first (linking again: the one it was). */
  host?: string
}) {
  const t = useT()
  const [account, setAccount] = useState(() => accountOf(person))
  const [host, setHost] = useState(given ?? defaultHost())
  const [withToken, setWithToken] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  const link = async () => {
    setBusy(true)
    setProblem(null)
    try {
      const linked = withToken ? await signInWithToken(person, host, token) : await signIn(person, host, username, password)
      setPassword('')
      // Linked again: the copy on Door43 starts over, and what kept it failing is forgotten.
      forgetDoor43Prints(person)
      setAccount(linked)
      onLinked?.(linked)
    } catch (e) {
      setProblem(t(`door43.problema.${problemOf(e)}`))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title={t('door43.titulo')} onClose={onClose} dirty={!account && (password !== '' || token !== '')}>
      {account ? (
        <div className="glossary-form">
          <p className="status">{t('door43.vinculada', { usuario: account.username, donde: t(`door43.host.${hostName(account.host)}`) })}</p>
          <Door43CopySection person={person} />
          <button
            type="button"
            className="button-secondary button-danger"
            onClick={() => {
              forgetAccount(person)
              setAccount(null)
            }}
          >
            {t('door43.desvincular')}
          </button>
        </div>
      ) : (
        <form
          className="glossary-form"
          onSubmit={(e) => {
            e.preventDefault()
            void link()
          }}
        >
          {/* Many who link have never heard of Door43: what it is, said once, before anything is asked. */}
          <p>{t('door43.queEs')}</p>
          {/* Only one Door43 for most people: nothing to choose, nothing said. */}
          {HOSTS.length > 1 && (
            <fieldset className="field">
              <legend className="field-label">{t('door43.donde')}</legend>
              <div className="choice-row door43-hosts">
                {HOSTS.map((h) => (
                  <button key={h.id} type="button" className={host === h.url ? 'choice is-on' : 'choice'} aria-pressed={host === h.url} onClick={() => setHost(h.url)}>
                    {t(`door43.host.${h.id}`)}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
          {withToken ? (
            <label className="field">
              <span className="field-label">{t('door43.llave')}</span>
              <input value={token} onChange={(e) => setToken(e.target.value)} autoComplete="off" spellCheck={false} />
              <span className="quiet">{t('door43.llaveAyuda')}</span>
            </label>
          ) : (
            <>
              <label className="field">
                <span className="field-label">{t('door43.usuario')}</span>
                <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} />
              </label>
              <label className="field">
                <span className="field-label">{t('door43.contrasena')}</span>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <span className="quiet">{t('door43.contrasenaAyuda')}</span>
              </label>
            </>
          )}
          {problem && (
            <p className="notice" role="alert">
              {problem}
            </p>
          )}
          <button type="submit" className="button-primary" disabled={busy || (withToken ? !token.trim() : !username.trim() || !password)}>
            {busy ? t('door43.vinculando') : t('door43.vincular')}
          </button>
          <button type="button" className="button-secondary" onClick={() => setWithToken((w) => !w)}>
            {t(withToken ? 'door43.conContrasena' : 'door43.conLlave')}
          </button>
          {/* No account yet: it is made on Door43 itself, in the browser (nothing of it inside the app), and linked here after. */}
          <div className="door43-new">
            <p className="field-label">{t('door43.sinCuenta')}</p>
            <a className="button-secondary" href={signUpUrl(host)} target="_blank" rel="noreferrer">
              {t('door43.crearCuenta')} ›
            </a>
            <p className="quiet">{t('door43.crearCuentaAyuda')}</p>
          </div>
        </form>
      )}
    </Sheet>
  )
}
