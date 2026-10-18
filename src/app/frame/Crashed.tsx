/**
 * When a screen fails: not a blank page. The work is kept on the phone as it is written, so the person is told so and
 * goes back to home; what failed is there to copy, for whoever fixes it.
 */

import { Component, Fragment, useState, type ReactNode } from 'react'
import { currentDevice } from '../i18n/device'
import { lookup, useT } from '../i18n/i18n'
import en from '../i18n/en.json'
import es from '../i18n/es.json'
import pt from '../i18n/pt.json'
import { appLabel } from './version'

export class KeepGoing extends Component<{ children: ReactNode }, { error: Error | null; round: number }> {
  state = { error: null as Error | null, round: 0 }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error(error)
  }

  render() {
    if (this.state.error) return <Crashed error={this.state.error} onHome={() => this.setState((s) => ({ error: null, round: s.round + 1 }))} />
    // Drawn anew from home: the app starts at home when it is drawn again.
    return <Fragment key={this.state.round}>{this.props.children}</Fragment>
  }
}

/**
 * The last net, around everything: if even the screen above failed, a plain notice in the app's language and a way to
 * open it again, with nothing in it that could fail.
 */
export class LastResort extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    if (!this.state.failed) return this.props.children
    const lang = document.documentElement.lang
    const texts = (lang === 'pt' ? pt : lang === 'en' ? en : es) as Record<string, string>
    const say = (key: string) => lookup(key, [texts], currentDevice())
    return (
      <div className="screen">
        <main className="main crashed">
          <h1>{say('marco.fallo')}</h1>
          <p>{say('marco.falloAyuda')}</p>
          <p className="quiet">{appLabel()}</p>
          <button type="button" className="button-primary" onClick={() => location.reload()}>
            {say('marco.volverInicio')}
          </button>
        </main>
      </div>
    )
  }
}

function Crashed({ error, onHome }: { error: Error; onHome(): void }) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const detail = `${appLabel()}\n${String(error?.message ?? error)}\n${String(error?.stack ?? '').split('\n').slice(0, 6).join('\n')}`
  return (
    <div className="screen">
      <main className="main crashed">
        <h1>{t('marco.fallo')}</h1>
        <p>{t('marco.falloAyuda')}</p>
        <button type="button" className="button-primary" onClick={onHome}>
          {t('marco.volverInicio')}
        </button>
        <details className="crashed-detail">
          <summary>{t('marco.falloDetalle')}</summary>
          <pre>{detail}</pre>
          <button
            type="button"
            className="chip"
            onClick={() =>
              void navigator.clipboard
                ?.writeText(detail)
                .then(() => setCopied(true))
                .catch(() => {})
            }
          >
            {copied ? `✓ ${t('marco.copiado')}` : t('marco.copiar')}
          </button>
        </details>
      </main>
    </div>
  )
}
