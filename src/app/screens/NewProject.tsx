/**
 * «+ Add a project» and «New Bible», as translationCore 4 does them (`src/views/modals/AddProject.jsx`,
 * `NewBible.jsx`): first the three ways to start, then one short form — name, language (searched in Door43's list of
 * languages, its code coming with it), direction, the
 * bridge texts and helps to work with (the language packs on this phone), the font, and the versification out of the
 * way. Everything can be changed later.
 */

import { useState } from 'react'
import { LanguageSearch } from '../frame/LanguageSearch'
import { MenuRow, Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import { writtenRightToLeft } from '../projects/languages'
import { DEFAULT_MINI_APPS, slug, type Project } from '../projects/model'

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

const FONTS = ['Charis SIL', 'Andika', 'Gentium Plus', 'Noto Sans']
const VERSIFICATIONS = ['eng', 'org', 'lxx', 'vul', 'rsc']

/** The language packs on this phone (the prototype has one). */
const PACKS = [{ code: 'es-419', name: 'Español latinoamericano', what: 'TPL, TPS, notas, preguntas, palabras, academia' }]

export function NewProject({ existing, onCancel, onCreate }: { existing: Project[]; onCancel(): void; onCreate(p: Project): void }) {
  const t = useT()
  const [name, setName] = useState('')
  const [languageName, setLanguageName] = useState('')
  const [code, setCode] = useState('')
  const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr')
  const [helps, setHelps] = useState(PACKS[0].code)
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
            while (existing.some((p) => p.id === id)) id += '-2'
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
          <p className="quiet">{t('nuevo.ayuda')}</p>
          <label className="field">
            <span className="field-label">{t('nuevo.nombre')}</span>
            <input id="np-name" value={name} onChange={(e) => (setName(e.target.value), setMissing(false))} placeholder={t('nuevo.nombreEjemplo')} />
          </label>
          <LanguageSearch
            label={t('nuevo.idioma')}
            value={{ code, name: languageName }}
            onChange={(l) => {
              setLanguageName(l.name)
              setCode(l.code)
              setMissing(false)
              // A language written from right to left sets the direction; it can still be changed below.
              if (l.code) setDirection(writtenRightToLeft(l.code) ? 'rtl' : 'ltr')
            }}
          />

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
            {PACKS.map((p) => (
              <button key={p.code} type="button" className={helps === p.code ? 'option is-on' : 'option'} aria-pressed={helps === p.code} onClick={() => setHelps(p.code)}>
                <span className="option-title">
                  {p.name} ({p.code}) <span className="badge">{t('nuevo.recomendado')}</span>
                </span>
                <span className="quiet">
                  {t('nuevo.enEsteTelefono')} · {p.what}
                </span>
              </button>
            ))}
          </fieldset>

          <label className="field">
            <span className="field-label">{t('nuevo.letra')}</span>
            <select id="np-font" value={font} onChange={(e) => setFont(e.target.value)}>
              {FONTS.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>

          <details className="advanced">
            <summary>{t('nuevo.versificacion')}</summary>
            <label className="field">
              <span className="quiet">{t('nuevo.versificacionAyuda')}</span>
              <select id="np-vrs" value={versification} onChange={(e) => setVersification(e.target.value)}>
                {VERSIFICATIONS.map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
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
