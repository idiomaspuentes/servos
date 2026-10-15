/**
 * Translate the app (design, section 9), one phrase at a time, as the editor goes a verse at a time: the phrase in the
 * language chosen to fall back on, the box for the person's text, and «Next →», which goes on to the next phrase still
 * to translate, wherever it is. What is written applies at once, everywhere. The phrases are grouped by where they
 * appear (the frame, a screen, each mini app by its name); a sheet lists the parts with how far each has gone, to go
 * to one, with the language. A translation must keep the original's `{marks}` (where the app puts a name or a
 * number): a missing one is offered to touch rather than to type; a much longer one may not fit on a phone.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { LanguageSearch } from '../frame/LanguageSearch'
import { Sheet } from '../frame/Sheet'
import { BASE_LANGUAGES, allKeys, baseText, marksOf, useI18n, type BaseLanguage } from '../i18n/i18n'
import { miniApps } from '../miniapps/registry'
import { percent } from '../projects/progress'

const NAMES: Record<BaseLanguage, string> = { es: 'Español', pt: 'Português', en: 'English' }
const SCREEN_ORDER = ['marco', 'ayudas', 'inicio', 'agregar', 'nuevo', 'libroNuevo', 'libro', 'pasos', 'ajustes', 'catalogo', 'persona', 'paquete', 'idioma', 'interfaz']

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
  const [choosing, setChoosing] = useState(false)
  // «Next» passes over what is translated, unless the person wants to read those again.
  const [alsoDone, setAlsoDone] = useState(false)

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
  const all = useMemo(() => groups.flatMap((g) => g.keys), [groups])
  const translated = (key: string) => Boolean(target && translationOf(target, key))
  const total = all.length
  const done = all.filter(translated).length

  // The phrase open: at first the first still to translate, and it stays open while it is written in (were it not
  // fixed, the first letter would make it translated and move on to the next).
  const [key, setKey] = useState<string | null>(() => all.find((k) => !translated(k)) ?? all[0] ?? null)
  const at = key ? all.indexOf(key) : -1
  const group = groups.find((g) => key && g.keys.includes(key))
  const box = useRef<HTMLTextAreaElement>(null)
  // Gone on to another phrase, it is written in at once: on a phone the keyboard stays up from one to the next. Not
  // on opening the screen, where the keyboard would cover the phrase before it is read.
  const moved = useRef(false)
  useEffect(() => {
    if (moved.current) box.current?.focus()
  }, [key])

  /** The next phrase to go to after `from`: the next still to translate (or the very next), wherever it is. */
  const nextAfter = (from: number) => {
    for (let i = 1; i <= all.length; i++) {
      const k = all[(from + i) % all.length]
      if (alsoDone || !translated(k)) return k
    }
    return null
  }
  const next = key ? nextAfter(at) : null
  const previous = at > 0 ? all[at - 1] : null

  if (creating || !target) {
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
            <LanguageSearch
              label={t('interfaz.nombreIdioma')}
              value={{ code, name }}
              onChange={(l) => {
                setName(l.name)
                setCode(l.code)
              }}
            />
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
        </main>
      </div>
    )
  }

  const languageName = localLanguages.find((l) => l.code === target)?.name ?? target
  const original = key ? (baseText(fallback, key) ?? baseText('es', key) ?? key) : ''
  const mine = key ? (translationOf(target, key) ?? '') : ''
  const issues = key ? problems(original, mine, t) : []
  const missingMarks = mine.trim() ? marksOf(original).filter((m) => !marksOf(mine).includes(m)) : marksOf(original)
  const go = (k: string | null) => {
    if (!k) return
    moved.current = true
    setKey(k)
  }

  return (
    <div className="screen">
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onBack}>
          ‹ {t('marco.volver')}
        </button>
        <div className="header-title">
          <span className="header-app">{t('interfaz.titulo')}</span>
          <span className="header-person">{t('interfaz.alIdioma', { idioma: `${languageName} (${target})` })}</span>
        </div>
        <button type="button" className="button-quiet header-more" onClick={() => setChoosing(true)}>
          {t('interfaz.partes')}
        </button>
      </header>
      <main className="main">
        <p className="tool-progress translate-progress">
          <span className="progress-bar" aria-hidden="true">
            <span style={{ width: `${percent(done, total)}%` }} />
          </span>
          <span>{t('interfaz.progreso', { hechas: done, total, pct: percent(done, total) })}</span>
        </p>

        {key && group && (
          <section className="translate-card" aria-label={t('interfaz.frase')}>
            <button type="button" className="word-help-kind translate-where" onClick={() => setChoosing(true)}>
              {group.title} · {t('interfaz.fraseN', { n: group.keys.indexOf(key) + 1, total: group.keys.length })} ▾
            </button>
            <span className="field-label">{t('interfaz.original')}</span>
            <p className="translate-original-text">{original}</p>
            <label className="field">
              <span className="field-label">{t('interfaz.suTraduccion')}</span>
              <textarea
                ref={box}
                rows={2}
                className="translate-box"
                value={mine}
                onChange={(e) => setText(target, key, e.target.value)}
                onKeyDown={(e) => {
                  // Enter goes on, as «Next» does: a phrase of the app is one line.
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    go(next)
                  }
                }}
              />
            </label>
            {/* A mark the app fills in (a name, a number), offered to touch rather than to type. */}
            {missingMarks.length > 0 && (
              <div className="translate-marks">
                <span className="quiet">{t('interfaz.ponerMarca')}</span>
                {missingMarks.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setText(target, key, `${mine}${mine && !mine.endsWith(' ') ? ' ' : ''}${m}`)
                      box.current?.focus()
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
            {issues.map((issue) => (
              <p key={issue} className="field-problem">
                {issue}
              </p>
            ))}
            <div className="translate-steps">
              <button type="button" className="button-secondary" disabled={!previous} onClick={() => go(previous)}>
                ‹ {t('interfaz.anterior')}
              </button>
              <button type="button" className="button-primary" disabled={!next} onClick={() => go(next)}>
                {t('interfaz.siguiente')} →
              </button>
            </div>
            {!next && <p className="review-done">✓ {t('interfaz.todas')}</p>}
            <p className="quiet">{t('interfaz.seGuarda')}</p>
          </section>
        )}
        {/* Not a button that never works: said, until it does. */}
        <p className="quiet">{t('interfaz.exportarPronto')}</p>
      </main>

      {choosing && (
        <Sheet title={t('interfaz.partes')} onClose={() => setChoosing(false)}>
          <div className="review-groups">
            {groups.map((g) => {
              const gDone = g.keys.filter(translated).length
              return (
                <button
                  key={g.group}
                  type="button"
                  className={g === group ? 'review-group is-current' : 'review-group'}
                  onClick={() => {
                    setChoosing(false)
                    go(g.keys.find((k) => !translated(k)) ?? g.keys[0])
                  }}
                >
                  <span>{g.title}</span>
                  <span className="quiet">{t('libro.hechosDe', { hechos: gDone, total: g.keys.length, pct: percent(gDone, g.keys.length) })}</span>
                </button>
              )
            })}
          </div>
          <label className="check">
            <input type="checkbox" checked={alsoDone} onChange={(e) => setAlsoDone(e.target.checked)} />
            {t('interfaz.tambienHechas')}
          </label>
          <label className="field">
            <span className="field-label">{t('interfaz.idioma')}</span>
            <select
              value={target}
              onChange={(e) => {
                if (e.target.value === '__nuevo') {
                  setChoosing(false)
                  setCreating(true)
                } else setLanguage(e.target.value)
              }}
            >
              {localLanguages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name} ({l.code})
                </option>
              ))}
              <option value="__nuevo">{t('interfaz.nuevoIdioma')}…</option>
            </select>
          </label>
        </Sheet>
      )}
    </div>
  )
}
