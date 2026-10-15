/**
 * Translate the app (design, section 9). The texts are grouped by where they appear (the frame, a screen, each mini
 * app by its name), each with its original in the language chosen to fall back on, and a box for the person's text.
 * A translation must keep the original's `{marks}`; a much longer one may not fit on a phone. What is written applies
 * at once, everywhere.
 */

import { useMemo, useState } from 'react'
import { BASE_LANGUAGES, allKeys, baseText, marksOf, useI18n, type BaseLanguage } from '../i18n/i18n'
import { miniApps } from '../miniapps/registry'

const NAMES: Record<BaseLanguage, string> = { es: 'Español', pt: 'Português', en: 'English' }
const SCREEN_ORDER = ['marco', 'ayudas', 'catalogo', 'persona', 'paquete', 'idioma', 'interfaz']

function problems(original: string, text: string, t: ReturnType<typeof useI18n>['t']): string[] {
  if (!text.trim()) return []
  const a = marksOf(original)
  const b = marksOf(text)
  const out = [
    ...a.filter((m) => !b.includes(m)).map((m) => t('interfaz.faltaMarca', { marca: m })),
    ...b.filter((m) => !a.includes(m)).map((m) => t('interfaz.sobraMarca', { marca: m })),
  ]
  if (text.length > 40 && text.length > original.length * 1.6) out.push(t('interfaz.muyLarga'))
  return out
}

export function TranslateUi({ onBack }: { onBack(): void }) {
  const { t, localLanguages, language, fallback, addLanguage, setLanguage, setText, translationOf } = useI18n()
  const target = localLanguages.find((l) => l.code === language)?.code ?? localLanguages[0]?.code ?? null
  const [creating, setCreating] = useState(localLanguages.length === 0)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [fb, setFb] = useState<BaseLanguage>(fallback)
  const [onlyMissing, setOnlyMissing] = useState(false)

  const groups = useMemo(() => {
    const keys = allKeys()
    const byGroup = new Map<string, string[]>()
    for (const key of keys) {
      const group = key.split('.')[0]
      byGroup.set(group, [...(byGroup.get(group) ?? []), key])
    }
    // What is seen everywhere first, then each screen, then each mini app in the catalog's order.
    const appIds = miniApps().map((a) => a.id)
    const order = [...SCREEN_ORDER, ...appIds]
    const rank = (g: string) => (order.includes(g) ? order.indexOf(g) : order.length)
    return [...byGroup.entries()]
      .sort((a, b) => rank(a[0]) - rank(b[0]))
      .map(([group, list]) => ({
        group,
        title: appIds.includes(group) ? t(`${group}.nombre`) : t(`interfaz.grupo.${group}`),
        keys: list,
      }))
  }, [t])

  const total = groups.reduce((n, g) => n + g.keys.length, 0)
  const done = target ? groups.reduce((n, g) => n + g.keys.filter((k) => translationOf(target, k)).length, 0) : 0

  return (
    <div className="screen">
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onBack}>
          ‹ {t('marco.volver')}
        </button>
        <div className="header-title">
          <span className="header-app">{t('interfaz.titulo')}</span>
        </div>
        <span />
      </header>
      <main className="main">
        {creating || !target ? (
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault()
              if (!name.trim() || !code.trim()) return
              addLanguage(code.trim().toLowerCase(), name.trim(), fb)
              setCreating(false)
            }}
          >
            <h1>{t('interfaz.nuevoIdioma')}</h1>
            <label className="field">
              <span className="field-label">{t('interfaz.nombreIdioma')}</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kichwa" />
            </label>
            <label className="field">
              <span className="field-label">{t('interfaz.codigoIdioma')}</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="qu" />
            </label>
            <label className="field">
              <span className="field-label">{t('interfaz.respaldo')}</span>
              <select value={fb} onChange={(e) => setFb(e.target.value as BaseLanguage)}>
                {BASE_LANGUAGES.map((l) => (
                  <option key={l} value={l}>
                    {NAMES[l]}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="button-primary">
              {t('interfaz.crear')}
            </button>
          </form>
        ) : (
          <>
            <label className="field">
              <span className="field-label">{t('interfaz.idioma')}</span>
              <select
                value={target}
                onChange={(e) => (e.target.value === '__nuevo' ? setCreating(true) : setLanguage(e.target.value))}
              >
                {localLanguages.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.name} ({l.code})
                  </option>
                ))}
                <option value="__nuevo">{t('interfaz.nuevoIdioma')}…</option>
              </select>
            </label>
            <p className="quiet">{t('interfaz.progreso', { hechas: done, total })}</p>
            <label className="check">
              <input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />
              {t('interfaz.soloFaltan')}
            </label>

            {groups.map((g) => {
              const keys = g.keys.filter((k) => !onlyMissing || !translationOf(target, k))
              if (!keys.length) return null
              return (
                <details key={g.group} className="translate-group">
                  <summary>
                    {g.title} <span className="quiet">· {keys.length}</span>
                  </summary>
                  {keys.map((key) => {
                    const original = baseText(fallback, key) ?? baseText('es', key) ?? key
                    const mine = translationOf(target, key) ?? ''
                    const issues = problems(original, mine, t)
                    return (
                      <div key={key} className="translate-row">
                        <p className="translate-original">
                          <span className="field-label">{t('interfaz.original')}</span>
                          {original}
                        </p>
                        <label className="field">
                          <span className="field-label">{t('interfaz.suTraduccion')}</span>
                          <input value={mine} onChange={(e) => setText(target, key, e.target.value)} />
                        </label>
                        {issues.map((issue) => (
                          <p key={issue} className="field-problem">
                            {issue}
                          </p>
                        ))}
                      </div>
                    )
                  })}
                </details>
              )
            })}
            <button type="button" className="button-secondary" disabled title={t('interfaz.exportarAyuda')}>
              {t('interfaz.exportar')}
            </button>
            <p className="quiet">{t('interfaz.exportarAyuda')}</p>
          </>
        )}
      </main>
    </div>
  )
}
