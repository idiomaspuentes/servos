/** The app's language: the three it brings, those translated on this phone, and the long-phrases test. */

import { BASE_LANGUAGES, PSEUDO_LANGUAGE, baseText, useI18n } from '../i18n/i18n'
import { MenuRow, Sheet } from '../frame/Sheet'

/** Each language in its own words. */
export const LANGUAGE_NAMES: Record<string, string> = { es: 'Español', pt: 'Português', en: 'English' }

export function Language({ onClose }: { onClose(): void }) {
  const { t, language, localLanguages, setLanguage } = useI18n()
  const choose = (code: string) => {
    setLanguage(code)
    onClose()
  }
  return (
    <Sheet title={t('idioma.titulo')} onClose={onClose}>
      <h3 className="menu-heading">{t('idioma.base')}</h3>
      {BASE_LANGUAGES.map((code) => (
        <MenuRow key={code} label={`${LANGUAGE_NAMES[code]}${code === language ? ' ✓' : ''}`} onClick={() => choose(code)} />
      ))}
      {localLanguages.length > 0 && <h3 className="menu-heading">{t('idioma.locales')}</h3>}
      {localLanguages.map((l) => (
        <MenuRow key={l.code} label={`${l.name}${l.code === language ? ' ✓' : ''}`} description={l.code} onClick={() => choose(l.code)} />
      ))}
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
