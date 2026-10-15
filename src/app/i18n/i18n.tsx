/**
 * Interface text (design, section 9). The app brings Spanish, Portuguese and English; a person can translate it into
 * any language on the device, and that translation overrides them at once, without restarting.
 *
 * - Every text has a key, `{group}.{name}`; the group is the frame (`marco`), a screen, or a mini app's id, so the
 *   translation editor can show "the texts of Estudio".
 * - A mini app brings its own texts (`registerTexts`) in the three base languages.
 * - Lookup: the person's translation for the chosen language → the base text in that language → the base language
 *   the person chose to fall back on → Spanish → the key itself.
 * - `{name}` marks a value the app fills in; a translation must keep the same marks (`marksOf`).
 * - `qps` is a test language: Spanish made 40 % longer, to see what breaks with longer phrases.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import en from './en.json'
import es from './es.json'
import pt from './pt.json'

export type BaseLanguage = 'es' | 'pt' | 'en'
export const BASE_LANGUAGES: BaseLanguage[] = ['es', 'pt', 'en']
export const PSEUDO_LANGUAGE = 'qps'

export type Texts = Record<string, string>

const base: Record<BaseLanguage, Texts> = { es: { ...es }, pt: { ...pt }, en: { ...en } }

/** A mini app (or any part of the app) adds its texts, keyed `{group}.{name}`, in the three base languages. */
export function registerTexts(group: string, texts: Record<BaseLanguage, Texts>) {
  for (const lang of BASE_LANGUAGES) {
    for (const [name, text] of Object.entries(texts[lang])) base[lang][`${group}.${name}`] = text
  }
}

/** Every key the app knows, from the Spanish texts (the source). */
export function allKeys(): string[] {
  return Object.keys(base.es).sort()
}

export function baseText(lang: BaseLanguage, key: string): string | undefined {
  return base[lang][key]
}

/** The `{name}` marks of a text, sorted, to check that a translation keeps them. */
export function marksOf(text: string): string[] {
  return [...new Set(text.match(/\{[a-zA-Z0-9_]+\}/g) ?? [])].sort()
}

function fill(text: string, values?: Record<string, string | number>): string {
  if (!values) return text
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (whole, name: string) => (name in values ? String(values[name]) : whole))
}

/** Longer, accented, and still readable: «Volver» becomes «[Vóólvéér ~~]». */
function pseudo(text: string): string {
  const parts = text.split(/(\{[a-zA-Z0-9_]+\})/)
  const stretched = parts
    .map((part) =>
      part.startsWith('{')
        ? part
        : part.replace(/[aeiouAEIOU]/g, (v) => ({ a: 'áá', e: 'éé', i: 'íí', o: 'óó', u: 'úú', A: 'ÁÁ', E: 'ÉÉ', I: 'ÍÍ', O: 'ÓÓ', U: 'ÚÚ' })[v]!)
    )
    .join('')
  return `[${stretched} ~~]`
}

const STORAGE_KEY = 'servos.interfaz'

type Stored = {
  language: string
  fallback: BaseLanguage
  /** language → key → the person's text. */
  translations: Record<string, Texts>
  /** language → its name, as the person wrote it. */
  names: Record<string, string>
}

function load(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as Stored
  } catch {
    /* private window or blocked storage: start with the defaults */
  }
  return { language: 'es', fallback: 'es', translations: {}, names: {} }
}

function save(stored: Stored) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))
  } catch {
    /* the change still applies until the app is closed */
  }
}

export type T = (key: string, values?: Record<string, string | number>) => string

interface I18n {
  t: T
  language: string
  fallback: BaseLanguage
  /** Languages with a translation on the device, besides the base ones. */
  localLanguages: Array<{ code: string; name: string }>
  setLanguage(code: string, fallback?: BaseLanguage): void
  /** Sets (or clears, with an empty text) the person's text for a key in a language. */
  setText(language: string, key: string, text: string): void
  addLanguage(code: string, name: string, fallback: BaseLanguage): void
  translationOf(language: string, key: string): string | undefined
}

const Context = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [stored, setStored] = useState<Stored>(load)
  // Screen readers and hyphenation follow the interface language.
  useEffect(() => {
    document.documentElement.lang = stored.language === PSEUDO_LANGUAGE ? 'es' : stored.language
  }, [stored.language])

  const update = useCallback((change: (s: Stored) => Stored) => {
    setStored((s) => {
      const next = change(s)
      save(next)
      return next
    })
  }, [])

  const value = useMemo<I18n>(() => {
    const { language, fallback, translations, names } = stored
    const t: T = (key, values) => {
      if (language === PSEUDO_LANGUAGE) return pseudo(fill(base.es[key] ?? key, undefined)).replace(/\{([a-zA-Z0-9_]+)\}/g, (w) => fill(w, values))
      const text =
        translations[language]?.[key] ??
        base[language as BaseLanguage]?.[key] ??
        base[fallback][key] ??
        base.es[key] ??
        key
      return fill(text, values)
    }
    return {
      t,
      language,
      fallback,
      localLanguages: Object.keys(translations)
        .filter((code) => !BASE_LANGUAGES.includes(code as BaseLanguage))
        .map((code) => ({ code, name: names[code] ?? code })),
      setLanguage: (code, fb) => update((s) => ({ ...s, language: code, fallback: fb ?? s.fallback })),
      setText: (lang, key, text) =>
        update((s) => {
          const current = { ...(s.translations[lang] ?? {}) }
          if (text.trim()) current[key] = text
          else delete current[key]
          return { ...s, translations: { ...s.translations, [lang]: current } }
        }),
      addLanguage: (code, name, fb) =>
        update((s) => ({
          ...s,
          language: code,
          fallback: fb,
          names: { ...s.names, [code]: name },
          translations: { ...s.translations, [code]: s.translations[code] ?? {} },
        })),
      translationOf: (lang, key) => translations[lang]?.[key],
    }
  }, [stored, update])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useI18n(): I18n {
  const value = useContext(Context)
  if (!value) throw new Error('useI18n fuera de I18nProvider')
  return value
}

export function useT(): T {
  return useI18n().t
}
