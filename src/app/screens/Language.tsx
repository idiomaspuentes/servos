/** The app's language: the three it brings, those translated on this phone, and the long-phrases test. */

import { useRef, useState } from 'react'
import { BASE_LANGUAGES, PSEUDO_LANGUAGE, baseText, useI18n } from '../i18n/i18n'
import { readInterfacePackage } from '../i18n/interfacePackage'
import { MenuRow, Sheet } from '../frame/Sheet'

/** Each language in its own words. */
export const LANGUAGE_NAMES: Record<string, string> = { es: 'Español', pt: 'Português', en: 'English' }

export function Language({ onClose }: { onClose(): void }) {
  const { t, language, localLanguages, setLanguage, receivePackage } = useI18n()
  const [receiving, setReceiving] = useState(false)
  const [pasted, setPasted] = useState('')
  const [said, setSaid] = useState<string | null>(null)
  const picker = useRef<HTMLInputElement>(null)
  // A translation of the app made on another phone: gathered, and the app shown in it.
  const receive = (text: string) => {
    const p = readInterfacePackage(text)
    if (!p) return setSaid(t('idioma.noEs'))
    const got = receivePackage(p)
    if (!got) return setSaid(t('idioma.esBase', { idioma: p.name }))
    const { added, kept, broken } = got
    setSaid(
      t(kept ? 'idioma.recibida' : 'idioma.recibidaSola', { idioma: p.name, nuevas: added, propias: kept }) +
        (broken ? ` ${t('idioma.rotas', { n: broken })}` : '')
    )
    setReceiving(false)
    setPasted('')
  }
  const choose = (code: string) => {
    setLanguage(code)
    onClose()
  }
  return (
    <Sheet title={t('idioma.titulo')} onClose={onClose} dirty={receiving && pasted.trim() !== ''}>
      <h3 className="menu-heading">{t('idioma.base')}</h3>
      {BASE_LANGUAGES.map((code) => (
        <MenuRow key={code} label={`${LANGUAGE_NAMES[code]}${code === language ? ' ✓' : ''}`} onClick={() => choose(code)} />
      ))}
      {localLanguages.length > 0 && <h3 className="menu-heading">{t('idioma.locales')}</h3>}
      {localLanguages.map((l) => (
        <MenuRow key={l.code} label={`${l.name}${l.code === language ? ' ✓' : ''}`} description={l.code} onClick={() => choose(l.code)} />
      ))}
      {receiving ? (
        <div className="glossary-paste">
          <button type="button" className="button-secondary" onClick={() => picker.current?.click()}>
            {t('idioma.abrirArchivo')}
          </button>
          <input
            ref={picker}
            type="file"
            accept=".json,application/json,text/plain"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) receive(await file.text())
              e.target.value = ''
            }}
          />
          <textarea rows={3} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={t('idioma.pegar')} />
          <button type="button" className="button-primary" disabled={!pasted.trim()} onClick={() => receive(pasted)}>
            {t('idioma.recibirla')}
          </button>
        </div>
      ) : (
        <MenuRow label={t('idioma.recibir')} description={t('idioma.recibirAyuda')} onClick={() => setReceiving(true)} />
      )}
      {said && (
        <p className="status" role="status">
          {said}
        </p>
      )}
      <h3 className="menu-heading">{t('idioma.prueba')}</h3>
      <MenuRow label={`${t('idioma.prueba')}${language === PSEUDO_LANGUAGE ? ' ✓' : ''}`} description={t('idioma.pruebaAyuda')} onClick={() => choose(PSEUDO_LANGUAGE)} />
    </Sheet>
  )
}

/**
 * While the long-phrases test is on, a way out always in sight. Every text of the app is stretched then, the menu that
 * turns it off too, and nothing said it was a test: this one is said plainly, in the language to fall back on.
 */
export function TestModeBar() {
  const { language, fallback, setLanguage } = useI18n()
  if (language !== PSEUDO_LANGUAGE) return null
  const say = (key: string) => baseText(fallback, key) ?? baseText('es', key) ?? key
  return (
    <div className="test-mode-bar" role="status">
      <span>{say('idioma.pruebaPuesta')}</span>
      <button type="button" onClick={() => setLanguage(fallback)}>
        {say('idioma.quitarPrueba')}
      </button>
    </div>
  )
}
