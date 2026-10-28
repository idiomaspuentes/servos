/**
 * «Acerca de Servos», from the person's menu: who makes Servos and under what license, who the texts and helps on this
 * device are by (`credits.ts`, read from the packs that brought them, never written here by hand), and what Servos
 * owes to others. CC BY-SA asks for the credit; saying where the way of working comes from is owed too.
 *
 * Whoever opened Servos once with `?packs=` (to try the Worker's staging copy) also finds here which server the texts
 * and helps come from, to switch back; nobody else sees it (`packsServer.ts`, as the Door43 host picker).
 */

import { useEffect, useState } from 'react'
import { useT } from '../i18n/i18n'
import { Sheet } from '../frame/Sheet'
import { appLabel } from '../frame/version'
import { LEXICON_SUBJECTS } from '../../resources/companions'
import { creditsOnDevice, type Credit } from '../../resources/credits'
import { openResourceStores } from '../../resources/store'
import { checkForUpdates } from '../../resources/online/onlineResources'
import { PACKS_SERVERS, packsServerChoice, setPacksServer, type PacksServerId } from '../../resources/online/packsServer'

const SERVER_NAMES: Record<PacksServerId, string> = { produccion: 'enLinea.servidorPrincipal', staging: 'enLinea.servidorPrueba' }

/**
 * Chooses the server for the next times. The `?packs=` the app was opened with goes from the address, or it would
 * choose again over the person's choice; then the lists are asked of the server chosen.
 */
function choosePacksServer(id: PacksServerId) {
  setPacksServer(id)
  try {
    const url = new URL(location.href)
    if (url.searchParams.has('packs')) {
      url.searchParams.delete('packs')
      history.replaceState(history.state, '', url)
    }
  } catch {
    /* an address that cannot be rewritten: the choice is still kept */
  }
  void checkForUpdates({ force: true })
}

/** «A, B y C», in the language of the app. */
const listed = (items: string[], lang: string) => new Intl.ListFormat(lang, { type: 'conjunction' }).format(items)

export function AboutSheet({ onClose }: { onClose(): void }) {
  const t = useT()
  const lang = document.documentElement.lang || 'es'
  // Undefined while the device is read; empty when nothing was received yet.
  const [credits, setCredits] = useState<Credit[] | undefined>()
  // Shown only to whoever chose a server once (with `?packs=`).
  const [server, setServer] = useState(() => packsServerChoice())
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
        {server && (
          <>
            <h3 className="menu-heading" id="servidor-textos">
              {t('enLinea.servidor')}
            </h3>
            <div className="choice-row" role="radiogroup" aria-labelledby="servidor-textos">
              {(Object.keys(PACKS_SERVERS) as PacksServerId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={server === id}
                  className={server === id ? 'choice is-on' : 'choice'}
                  onClick={() => {
                    if (server === id) return
                    choosePacksServer(id)
                    setServer(id)
                  }}
                >
                  {t(SERVER_NAMES[id])}
                </button>
              ))}
            </div>
          </>
        )}
        <h3 className="menu-heading">{t('acerca.gracias')}</h3>
        <p>{t('acerca.graciasTexto')}</p>
        <p className="quiet menu-version">{appLabel()}</p>
      </div>
    </Sheet>
  )
}
