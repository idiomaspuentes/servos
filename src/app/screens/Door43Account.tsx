/**
 * A person's Door43 account on this phone, linked once to publish the team's work (design, section 8). The password is
 * exchanged for a token in one request and not kept; a token made on Door43 itself can be used instead. Door43's test
 * copy (QA) is offered beside the real one, and, building the app, a mock on this computer.
 */

import { useState } from 'react'
import { Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import { HOSTS, accountOf, forgetAccount, hostName, problemOf, signIn, signInWithToken, type Door43Account } from '../projects/door43'

export function Door43AccountSheet({ person, onClose, onLinked }: { person: string; onClose(): void; onLinked?(account: Door43Account): void }) {
  const t = useT()
  const [account, setAccount] = useState(() => accountOf(person))
  const [host, setHost] = useState(HOSTS.find((h) => h.id === (import.meta.env.DEV ? 'mock' : 'qa'))?.url ?? HOSTS[0].url)
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
        </form>
      )}
    </Sheet>
  )
}
