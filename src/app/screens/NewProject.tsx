/**
 * «+ Add a project» and «New Bible», as translationCore 4 does them (`src/views/modals/AddProject.jsx`,
 * `NewBible.jsx`): first the three ways to start, then one short form — name, language (searched in Door43's list of
 * languages, its code coming with it), direction, the bridge texts and helps to work with (those the language packs
 * left on this device), the font, and the versification out of the way. Everything can be changed later.
 */

import { useState } from 'react'
import { EXAMPLE_LANGUAGE } from '../../prototype/data'
import { LanguageSearch } from '../frame/LanguageSearch'
import { MenuRow, Sheet } from '../frame/Sheet'
import { useI18n, useT } from '../i18n/i18n'
import { languageLabel, writtenRightToLeft } from '../projects/languages'
import { helpsLanguagesHere } from '../projects/library'
import { DEFAULT_MINI_APPS, EXAMPLE_PROJECT_ID, slug, type Project } from '../projects/model'

export function AddProjectSheet({ onClose, onBible, onReceive }: { onClose(): void; onBible(): void; onReceive(): void }) {
  const t = useT()
  return (
    <Sheet title={t('agregar.titulo')} onClose={onClose}>
      <MenuRow label={t('agregar.biblia')} description={t('agregar.bibliaAyuda')} onClick={onBible} />
      <MenuRow label={t('agregar.obs')} description={t('agregar.obsAyuda')} onClick={() => {}} disabled />
      <MenuRow label={t('agregar.recibir')} description={t('agregar.recibirAyuda')} onClick={onReceive} />
    </Sheet>
  )
}

export const FONTS = ['Charis SIL', 'Andika', 'Gentium Plus', 'Noto Sans']
export const VERSIFICATIONS = ['eng', 'org', 'lxx', 'vul', 'rsc']

/** A language's name in the languages the app speaks now. */
export function useLanguageLabel(): (code: string) => string {
  const { language, fallback } = useI18n()
  return (code) => languageLabel(code, [language, fallback])
}

/**
 * The bridge texts and helps a project works with: the languages whose packs are on this device, each with its books
 * and what it has. A project's own language that is not here is kept, and said so.
 */
export function HelpsChoice({ value, onChange, recommend = false }: { value: string; onChange(code: string): void; recommend?: boolean }) {
  const t = useT()
  const label = useLanguageLabel()
  const here = helpsLanguagesHere()
  const away = value && !here.some((h) => h.code === value) ? value : null
  return (
    <>
      {!here.length && <p className="notice">{t('nuevo.ningunPaquete')}</p>}
      {here.map((h, i) => (
        <button key={h.code} type="button" className={value === h.code ? 'option is-on' : 'option'} aria-pressed={value === h.code} onClick={() => onChange(h.code)}>
          <span className="option-title">
            {label(h.code)} ({h.code}) {recommend && i === 0 && here.length > 1 && <span className="badge">{t('nuevo.recomendado')}</span>}
          </span>
          <span className="quiet">
            {[
              t('nuevo.enEsteTelefono'),
              h.books.length === 1 ? t('nuevo.unLibro') : t('nuevo.nLibros', { n: h.books.length }),
              h.parts.map((p) => t(`nuevo.parte.${p}`)).join(', '),
            ].join(' · ')}
          </span>
        </button>
      ))}
      {away && (
        <button type="button" className={value === away ? 'option is-on' : 'option'} aria-pressed={value === away} onClick={() => onChange(away)}>
          <span className="option-title">
            {label(away)} ({away})
          </span>
          <span className="quiet">{t('nuevo.noEstaAqui')}</span>
        </button>
      )}
    </>
  )
}

export function NewProject({ existing, onCancel, onCreate }: { existing: Project[]; onCancel(): void; onCreate(p: Project): void }) {
  const t = useT()
  const label = useLanguageLabel()
  const [name, setName] = useState('')
  // Whether the person wrote the name: until then it follows the language chosen.
  const [named, setNamed] = useState(false)
  const [languageName, setLanguageName] = useState('')
  const [code, setCode] = useState('')
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr')
  // The language with most books on this device; without packs, the one the example is in.
  const [helps, setHelps] = useState(() => helpsLanguagesHere()[0]?.code ?? EXAMPLE_LANGUAGE)
  const [font, setFont] = useState(FONTS[0])
  const [versification, setVersification] = useState('eng')
  const [missing, setMissing] = useState(false)

  return (
    <div className="screen">
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onCancel}>
          ‹ {t('nuevo.cancelar')}
        </button>
        <div className="header-title">
          <span className="header-app">{t('nuevo.titulo')}</span>
        </div>
        <span />
      </header>
      <main className="main">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            if (!name.trim() || !languageName.trim() || !code.trim()) {
              setMissing(true)
              return
            }
            let id = slug(name)
            // Not the example's id either: its books and its work are kept under it.
            while (existing.some((p) => p.id === id) || id === EXAMPLE_PROJECT_ID) id += '-2'
            onCreate({
              id,
              kind: 'bible',
              name: name.trim(),
              languageName: languageName.trim(),
              languageCode: code.trim().toLowerCase(),
              direction,
              helpsLanguage: helps,
              font,
              versification,
              books: [],
              miniApps: DEFAULT_MINI_APPS,
            })
          }}
        >
          {/* The language first: the name is proposed from it, and the direction follows it. */}
          <LanguageSearch
            label={t('nuevo.idioma')}
            value={{ code, name: languageName }}
            onChange={(l) => {
              setLanguageName(l.name)
              setCode(l.code)
              setMissing(false)
              if (!named && l.name) setName(t('nuevo.nombrePropuesto', { idioma: l.name }))
              // A language written from right to left sets the direction; it can still be changed below.
              if (l.code) setDirection(writtenRightToLeft(l.code) ? 'rtl' : 'ltr')
            }}
          />
          <label className="field">
            <span className="field-label">{t('nuevo.nombre')}</span>
            <input
              id="np-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNamed(true)
                setMissing(false)
              }}
              placeholder={t('nuevo.nombreEjemplo')}
            />
          </label>

          {/* What almost always stays as it comes, folded, saying what it is (philosophy, principle 3). */}
          <details className="advanced">
            <summary>
              {t('nuevo.masOpciones')}
              <span className="quiet">
                {[t(direction === 'ltr' ? 'nuevo.izquierda' : 'nuevo.derecha'), label(helps), font].join(' · ')}
              </span>
            </summary>
            <div className="stack">
              <p className="quiet">{t('nuevo.ayuda')}</p>
              <fieldset className="field">
                <legend className="field-label">{t('nuevo.direccion')}</legend>
                <div className="choice-row">
                  <button type="button" className={direction === 'ltr' ? 'choice is-on' : 'choice'} aria-pressed={direction === 'ltr'} onClick={() => setDirection('ltr')}>
                    {t('nuevo.izquierda')}
                  </button>
                  <button type="button" className={direction === 'rtl' ? 'choice is-on' : 'choice'} aria-pressed={direction === 'rtl'} onClick={() => setDirection('rtl')}>
                    {t('nuevo.derecha')}
                  </button>
                </div>
              </fieldset>

              <fieldset className="field">
                <legend className="field-label">{t('nuevo.ayudas')}</legend>
                <p className="quiet">{t('nuevo.ayudasNota')}</p>
                <HelpsChoice value={helps} onChange={setHelps} recommend />
              </fieldset>

              <label className="field">
                <span className="field-label">{t('nuevo.letra')}</span>
                <select id="np-font" value={font} onChange={(e) => setFont(e.target.value)}>
                  {FONTS.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="field-label">{t('nuevo.versificacion')}</span>
                <span className="quiet">{t('nuevo.versificacionAyuda')}</span>
                <select id="np-vrs" value={versification} onChange={(e) => setVersification(e.target.value)}>
                  {VERSIFICATIONS.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </div>
          </details>

          {missing && (
            <p className="notice" role="alert">
              {t('nuevo.falta')}
            </p>
          )}
          <button type="submit" className="button-primary">
            {t('nuevo.crear')}
          </button>
        </form>
      </main>
    </div>
  )
}
