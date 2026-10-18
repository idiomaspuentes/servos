/**
 * Choosing a language by searching it, not by knowing its code: a few letters of any of its names (in its own
 * language, in English, the others it is known by) or its code, and a few large rows to touch. The one chosen is
 * shown with «Change». A language not in Door43's list can still be written by hand.
 */

import { useEffect, useState } from 'react'
import { useT } from '../i18n/i18n'
import { loadLanguages, searchLanguages, type LanguageOption } from '../projects/languages'

export interface ChosenLanguage {
  code: string
  name: string
}

export function LanguageSearch({ value, onChange, label }: { value: ChosenLanguage; onChange(language: ChosenLanguage): void; label: string }) {
  const t = useT()
  const [list, setList] = useState<LanguageOption[] | null>(null)
  const [query, setQuery] = useState('')
  const [changing, setChanging] = useState(!value.code)
  const [byHand, setByHand] = useState(false)
  useEffect(() => {
    let live = true
    void loadLanguages().then((l) => live && setList(l))
    return () => {
      live = false
    }
  }, [])
  const found = list ? searchLanguages(list, query) : []

  if (!changing && value.code) {
    return (
      <div className="field">
        <span className="field-label">{label}</span>
        <div className="language-chosen">
          <span>
            <strong>{value.name}</strong> <span className="quiet">· {value.code}</span>
          </span>
          <button
            type="button"
            className="chip"
            onClick={() => {
              setChanging(true)
              setQuery('')
            }}
          >
            ✎ {t('idiomas.cambiar')}
          </button>
        </div>
      </div>
    )
  }

  if (byHand) {
    return (
      <div className="field-row">
        <label className="field">
          <span className="field-label">{label}</span>
          <input value={value.name} onChange={(e) => onChange({ ...value, name: e.target.value })} placeholder="Kichwa" />
        </label>
        <label className="field field-code">
          <span className="field-label">{t('idiomas.codigo')}</span>
          <input value={value.code} onChange={(e) => onChange({ ...value, code: e.target.value.trim().toLowerCase() })} placeholder="qu" autoCapitalize="none" />
        </label>
      </div>
    )
  }

  return (
    <div className="field language-search">
      <label className="field">
        <span className="field-label">{label}</span>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('idiomas.buscarAyuda')} autoCapitalize="none" />
      </label>
      {!list && <p className="quiet">{t('idiomas.leyendo')}</p>}
      {found.length > 0 && (
        <ul className="language-results">
          {found.map((l) => (
            <li key={l.code}>
              <button
                type="button"
                className="language-result"
                onClick={() => {
                  onChange({ code: l.code, name: l.name })
                  setChanging(false)
                }}
              >
                <span className="language-result-name">
                  {l.name} <span className="badge">{l.code}</span>
                </span>
                {l.aliases.length > 0 && <span className="quiet language-result-also">{l.aliases.slice(0, 3).join(' · ')}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {list && query.trim().length > 1 && found.length === 0 && <p className="quiet">{t('idiomas.ninguno')}</p>}
      <button type="button" className="button-secondary language-by-hand" onClick={() => setByHand(true)}>
        {t('idiomas.aMano')}
      </button>
    </div>
  )
}
