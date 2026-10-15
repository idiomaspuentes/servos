/**
 * Home: who is working, the project, and the mini apps, each with what it does and, honestly, what it is missing on
 * this phone (philosophy, principle 8). Nothing blocks the way to another mini app (principle 5).
 */

import type { PrototypeData } from '../../prototype/data'
import { useT } from '../i18n/i18n'
import type { MiniApp, ResourceNeed } from '../miniapps/contract'
import { miniApps } from '../miniapps/registry'

const NEED_LABEL: Record<ResourceNeed, string> = {
  text: 'TPL / TPS',
  notes: 'TN',
  questions: 'TQ',
  words: 'TW',
  academy: 'TA',
}

export function Catalog({
  data,
  person,
  available,
  onOpen,
  onPersonMenu,
}: {
  data: PrototypeData
  person: string
  /** What the phone has. */
  available: ResourceNeed[]
  onOpen(app: MiniApp): void
  onPersonMenu(): void
}) {
  const t = useT()
  return (
    <div className="screen">
      <header className="header">
        <span className="header-brand">Servos</span>
        <button type="button" className="header-person-chip" onClick={onPersonMenu}>
          {person} ▾
        </button>
      </header>
      <main className="main">
        <p className="quiet">{t('catalogo.proyecto', { libro: data.book.name, idioma: 'kichwa' })}</p>
        <h1>{t('catalogo.titulo')}</h1>
        <ul className="catalog">
          {miniApps().map((app) => {
            const missing = app.needs.filter((n) => !available.includes(n))
            return (
              <li key={app.id}>
                <button type="button" className="catalog-card" onClick={() => onOpen(app)} disabled={app.comingSoon}>
                  <span className="catalog-name">
                    {t(`${app.id}.nombre`)}
                    {app.comingSoon && <span className="badge">{t('catalogo.pronto')}</span>}
                  </span>
                  <span className="catalog-description">{t(`${app.id}.descripcion`)}</span>
                  {missing.length > 0 && !app.comingSoon && (
                    <span className="catalog-missing">{t('catalogo.falta', { que: missing.map((n) => NEED_LABEL[n]).join(', ') })}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
        <details className="resources">
          <summary>{t('catalogo.recursos')}</summary>
          <ul>
            {data.texts.map((x) => (
              <li key={x.key}>
                {x.abbreviation} · {x.title} · {data.book.name}
              </li>
            ))}
            <li>TN, TQ, TWL, TW, TA · {data.language}</li>
          </ul>
          <p className="quiet">{data.source}</p>
        </details>
      </main>
    </div>
  )
}
