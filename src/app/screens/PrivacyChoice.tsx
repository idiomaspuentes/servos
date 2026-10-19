/**
 * Who can see the team's work outside the app (`Privacy`; philosophy, principle 9), asked when a project is made and
 * changed in its settings. Each choice says what it does, in plain words, and only that: who can see the work. Some
 * teams need the work kept to themselves, most do not; nothing here should make the second afraid.
 *
 * Keeping it closer is one touch; opening it up asks first, saying what stops being kept to the team.
 */

import { useState } from 'react'
import { useT } from '../i18n/i18n'
import type { Privacy } from '../projects/model'

export function PrivacyChoice({ value, onChange, ask = false }: { value: Privacy; onChange(p: Privacy): void; ask?: boolean }) {
  const t = useT()
  const [asking, setAsking] = useState(false)
  const choose = (next: Privacy) => {
    if (next === value) return
    if (ask && next === 'abierto') return setAsking(true)
    onChange(next)
  }
  return (
    <fieldset className="option-cards">
      <legend className="field-label">{t('privacidad.pregunta')}</legend>
      {(['equipo', 'abierto'] as const).map((p) => (
        <label key={p} className={`option-card${value === p ? ' is-chosen' : ''}`}>
          <input type="radio" name="privacidad" checked={value === p} onChange={() => choose(p)} />
          <span>
            <strong>{t(`privacidad.${p}`)}</strong>
            <span className="quiet">{t(`privacidad.${p}Que`)}</span>
          </span>
        </label>
      ))}
      {asking && (
        <div className="copies-confirm" role="alertdialog" aria-label={t('privacidad.abrirPregunta')}>
          <p>{t('privacidad.abrirPregunta')}</p>
          <p className="quiet">{t('privacidad.abrirQue')}</p>
          <div className="copies-confirm-buttons">
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setAsking(false)
                onChange('abierto')
              }}
            >
              {t('privacidad.abrirSi')}
            </button>
            <button type="button" className="button-secondary" onClick={() => setAsking(false)}>
              {t('privacidad.abrirNo')}
            </button>
          </div>
        </div>
      )}
    </fieldset>
  )
}
