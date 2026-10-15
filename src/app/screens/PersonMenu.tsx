/** The person's menu (philosophy, layer «menú de la persona»): what is not of one mini app. */

import { useT } from '../i18n/i18n'
import { MenuRow, Sheet } from '../frame/Sheet'

export const PEOPLE = ['Ana', 'Bea', 'Carlos']

export function PersonMenu({
  person,
  onClose,
  onPerson,
  onReceive,
  onLanguage,
  onTranslate,
}: {
  person: string
  onClose(): void
  onPerson(name: string): void
  onReceive(): void
  onLanguage(): void
  onTranslate(): void
}) {
  const t = useT()
  return (
    <Sheet title={t('persona.menu', { nombre: person })} onClose={onClose}>
      <MenuRow label={t('persona.recibir')} description={t('persona.recibirAyuda')} onClick={onReceive} />
      <MenuRow label={t('persona.idioma')} description={t('persona.idiomaAyuda')} onClick={onLanguage} />
      <MenuRow label={t('persona.traducir')} description={t('persona.traducirAyuda')} onClick={onTranslate} />
      <h3 className="menu-heading">{t('persona.cambiar')}</h3>
      <p className="quiet">{t('persona.cambiarAyuda')}</p>
      <div className="people">
        {PEOPLE.map((name) => (
          <button key={name} type="button" className={name === person ? 'person is-current' : 'person'} aria-current={name === person} onClick={() => onPerson(name)}>
            {name}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
