/** The person's menu (philosophy, layer «menú de la persona»): what is not of one mini app. */

import { useState } from 'react'
import { useT } from '../i18n/i18n'
import { MenuRow, Sheet } from '../frame/Sheet'
import { setTheme, themeOf, type Theme } from '../frame/theme'
import { appLabel } from '../frame/version'
import { accountOf, hostName } from '../projects/door43'

export function PersonMenu({
  person,
  people,
  onClose,
  onPerson,
  onAdd,
  onReceive,
  onLanguage,
  onTranslate,
  onDoor43,
}: {
  person: string
  /** Who uses this phone. */
  people: string[]
  onClose(): void
  onPerson(name: string): void
  /** Someone else who uses this phone, added and made the one working. */
  onAdd(name: string): void
  onReceive(): void
  onLanguage(): void
  onTranslate(): void
  /** Links (or shows) the person's Door43 account. */
  onDoor43(): void
}) {
  const t = useT()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [theme, setThemeState] = useState<Theme>(themeOf)
  return (
    <Sheet title={t('persona.menu', { nombre: person })} onClose={onClose} dirty={adding && name.trim() !== ''}>
      <MenuRow label={t('persona.recibir')} description={t('persona.recibirAyuda')} onClick={onReceive} />
      <MenuRow label={t('persona.idioma')} description={t('persona.idiomaAyuda')} onClick={onLanguage} />
      {/* Light, dark or sun, on this phone: four at once, two by two, chosen in place (principle 12, pills on a track);
          the line under them says what sun is for. */}
      <div className="menu-choice">
        <span className="menu-row-label" id="apariencia">
          {t('persona.apariencia')}
        </span>
        <div className="choice-row is-four" role="radiogroup" aria-labelledby="apariencia" aria-describedby="apariencia-ayuda">
          {(['sistema', 'claro', 'oscuro', 'sol'] as const).map((x) => (
            <button
              key={x}
              type="button"
              role="radio"
              aria-checked={theme === x}
              className={theme === x ? 'choice is-on' : 'choice'}
              onClick={() => {
                setTheme(x)
                setThemeState(x)
              }}
            >
              {t(`persona.tema.${x}`)}
            </button>
          ))}
        </div>
        <span className="menu-row-description" id="apariencia-ayuda">
          {t('persona.aparienciaAyuda')}
        </span>
      </div>
      <MenuRow label={t('persona.traducir')} description={t('persona.traducirAyuda')} onClick={onTranslate} />
      <MenuRow
        label={t('persona.door43')}
        description={(() => {
          const a = accountOf(person)
          return a ? t('door43.vinculada', { usuario: a.username, donde: t(`door43.host.${hostName(a.host)}`) }) : t('persona.door43Ayuda')
        })()}
        onClick={onDoor43}
      />
      <h3 className="menu-heading">{t('persona.cambiar')}</h3>
      <p className="quiet">{t('persona.cambiarAyuda')}</p>
      <div className="people">
        {people.map((n) => (
          <button key={n} type="button" className={n === person ? 'person is-current' : 'person'} aria-current={n === person} onClick={() => onPerson(n)}>
            {n}
          </button>
        ))}
      </div>
      {adding ? (
        <form
          className="person-add"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) onAdd(name)
          }}
        >
          <label className="field">
            <span className="field-label">{t('persona.nombreNuevo')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus enterKeyHint="done" />
          </label>
          <button type="submit" className="button-primary" disabled={!name.trim()}>
            {t('persona.agregarYTrabajar')}
          </button>
        </form>
      ) : (
        <button type="button" className="button-secondary" onClick={() => setAdding(true)}>
          + {t('persona.agregar')}
        </button>
      )}
      {/* Which Servos this is, for whoever reports something. */}
      <p className="quiet menu-version">{appLabel()}</p>
    </Sheet>
  )
}
