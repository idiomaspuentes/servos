/**
 * «Acerca de Servos», from the person's menu: who makes Servos and under what license, who the texts and helps on this
 * device are by (`credits.ts`, read from the packs that brought them, never written here by hand), and what Servos
 * owes to others. CC BY-SA asks for the credit; saying where the way of working comes from is owed too.
 */

import { useEffect, useState } from 'react'
import { useT } from '../i18n/i18n'
import { Sheet } from '../frame/Sheet'
import { appLabel } from '../frame/version'
import { LEXICON_SUBJECTS } from '../../resources/companions'
import { creditsOnDevice, type Credit } from '../../resources/credits'
import { openResourceStores } from '../../resources/store'

/** «A, B y C», in the language of the app. */
const listed = (items: string[], lang: string) => new Intl.ListFormat(lang, { type: 'conjunction' }).format(items)

export function AboutSheet({ onClose }: { onClose(): void }) {
  const t = useT()
  const lang = document.documentElement.lang || 'es'
  // Undefined while the device is read; empty when nothing was received yet.
  const [credits, setCredits] = useState<Credit[] | undefined>()
  useEffect(() => {
    let live = true
    creditsOnDevice(openResourceStores(), (_, row) =>
      row.subject === LEXICON_SUBJECTS.greek ? t('acerca.lexicoGriego') : row.subject === LEXICON_SUBJECTS.hebrew ? t('acerca.lexicoHebreo') : undefined
    )
      .then((c) => live && setCredits(c))
      // A browser without IndexedDB: nothing received, as for a new phone.
      .catch(() => live && setCredits([]))
    return () => {
      live = false
    }
  }, [t])

  const lineOf = (c: Credit) => {
    const who = c.basedOn.length ? t('acerca.aPartirDe', { quien: c.by, otros: listed(c.basedOn, lang) }) : c.by
    return `${who} · ${c.license ?? t('acerca.sinLicencia')}`
  }

  return (
    <Sheet title={t('acerca.titulo')} onClose={onClose}>
      <div className="about">
        <p>{t('acerca.servos')}</p>
        <h3 className="menu-heading">{t('acerca.recursos')}</h3>
        {credits === undefined ? null : credits.length === 0 ? (
          <p className="quiet">{t('acerca.ninguno')}</p>
        ) : (
          <ul className="credits">
            {credits.map((c) => (
              <li key={c.keys.join(' ')}>
                <span className="credit-titles">{listed(c.titles, lang)}</span>
                <span className="quiet">{lineOf(c)}</span>
              </li>
            ))}
          </ul>
        )}
        <h3 className="menu-heading">{t('acerca.gracias')}</h3>
        <p>{t('acerca.graciasTexto')}</p>
        <p className="quiet menu-version">{appLabel()}</p>
      </div>
    </Sheet>
  )
}
