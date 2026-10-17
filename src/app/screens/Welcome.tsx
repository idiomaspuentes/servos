/**
 * The first time the app opens on a phone: what it is, in one line; the language of its buttons; and who is going to
 * work on it, since every change carries that name (philosophy, principle 8). One thing to do, «Start». Whoever only
 * wants to look around can go in as one of the example's people. Others who use the phone are added later, from the
 * person's menu.
 */

import { useState } from 'react'
import { BrandMark } from '../frame/BrandMark'
import { BASE_LANGUAGES, useI18n } from '../i18n/i18n'
import { EXAMPLE_PEOPLE } from '../projects/people'
import { LANGUAGE_NAMES } from './Language'

export function Welcome({ onStart }: { onStart(name: string, example: boolean): void }) {
  const { t, language, setLanguage } = useI18n()
  const [name, setName] = useState('')

  return (
    <div className="screen welcome">
      <main className="main">
        <div className="welcome-brand">
          <BrandMark />
          <h1 className="welcome-title">Servos</h1>
          <p className="welcome-what">{t('bienvenida.que')}</p>
        </div>

        <fieldset className="field">
          <legend className="field-label">{t('persona.idioma')}</legend>
          {/* Few to choose from, one at a time: pills on a track, as the theme in the person's menu */}
          <div className="choice-row is-three" role="radiogroup">
            {BASE_LANGUAGES.map((code) => (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={code === language}
                className={code === language ? 'choice is-on' : 'choice'}
                onClick={() => setLanguage(code, code)}
              >
                {LANGUAGE_NAMES[code]}
              </button>
            ))}
          </div>
        </fieldset>

        <form
          className="welcome-name"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) onStart(name, false)
          }}
        >
          <label className="field">
            <span className="field-label">{t('bienvenida.nombre')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" enterKeyHint="go" />
            <span className="quiet">{t('bienvenida.nombreAyuda')}</span>
          </label>
          <button type="submit" className="button-primary" disabled={!name.trim()}>
            {t('bienvenida.empezar')} →
          </button>
        </form>

        <section className="welcome-example">
          <p className="quiet">{t('bienvenida.ejemploAyuda')}</p>
          <button type="button" className="button-secondary" onClick={() => onStart(EXAMPLE_PEOPLE[0], true)}>
            {t('bienvenida.ejemplo', { nombre: EXAMPLE_PEOPLE[0] })}
          </button>
        </section>
      </main>
    </div>
  )
}
