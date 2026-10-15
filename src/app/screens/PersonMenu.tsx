/** The person's menu (philosophy, layer «menú de la persona»): what is not of one mini app. */

import { useState } from 'react'
import { useT } from '../i18n/i18n'
import { MenuRow, Sheet } from '../frame/Sheet'

export function PersonMenu({
  person,
  people,
  onClose,
  onPerson,
  onAdd,
  onReceive,
  onLanguage,
  onTranslate,
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
}) {
  const t = useT()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  return (
    <Sheet title={t('persona.menu', { nombre: person })} onClose={onClose}>
      <MenuRow label={t('persona.recibir')} description={t('persona.recibirAyuda')} onClick={onReceive} />
      <MenuRow label={t('persona.idioma')} description={t('persona.idiomaAyuda')} onClick={onLanguage} />
      <MenuRow label={t('persona.traducir')} description={t('persona.traducirAyuda')} onClick={onTranslate} />
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
    </Sheet>
  )
}
