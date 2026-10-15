/**
 * The verses of a book with two versions (received while this phone had its own text), one at a time: what the
 * bridge text says, a layer away; the two versions with what tells them apart; and, once one is kept, the next. A verse
 * can be left for later; it stays waiting, and the book page keeps saying how many are left.
 */

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { loadFont } from '../frame/fonts'
import { TwoVersions } from '../frame/TwoVersions'
import { WordLines } from '../frame/TouchWords'
import { useT } from '../i18n/i18n'
import { bookName, type Project } from '../projects/model'
import { versesToChoose } from '../projects/versions'
import { authorOf, chooseVersion, otherVersion, readDraft } from '../projects/work'

export function ChooseScreen({
  project,
  book,
  chapters,
  textAbbreviation,
  onBack,
}: {
  project: Project
  book: string
  chapters: PrototypeData[]
  /** The bridge text the person reads by (TPL by default). */
  textAbbreviation: string
  onBack(): void
}) {
  const t = useT()
  // The verses to choose, as they were on opening: one chosen or left for later does not move the others.
  const queue = useMemo(() => versesToChoose(book, chapters.map((c) => ({ chapter: c.chapter, verses: c.verses.map((v) => v.verse) }))), [book, chapters])
  const [at, setAt] = useState(0)
  const [chosen, setChosen] = useState(0)
  const [source, setSource] = useState(false)
  useEffect(() => loadFont(project.font), [project.font])

  const name = bookName(book)
  const place = queue[at]
  const data = place && chapters.find((c) => c.chapter === place.chapter)
  const bridge = data && (data.texts.find((x) => x.abbreviation === textAbbreviation) ?? data.texts.find((x) => !x.original))
  const received = place && otherVersion(book, place.chapter, place.verse)

  return (
    <div className="screen" style={project.font ? ({ '--project-font': `'${project.font}', var(--font)` } as CSSProperties) : undefined}>
      <header className="header">
        <button type="button" className="button-quiet header-back" onClick={onBack}>
          ‹ {name}
        </button>
        <div className="header-title">
          <span className="header-app">{t('versiones.titulo')}</span>
          {place && <span className="header-person">{t('versiones.nDe', { n: at + 1, total: queue.length })}</span>}
        </div>
        <span />
      </header>
      <main className="main">
        {!place || !received ? (
          <>
            <p className="review-done">✓ {queue.length ? t('versiones.listo', { n: chosen }) : t('versiones.ninguno')}</p>
            {queue.length - chosen > 0 && <p className="quiet">{t('versiones.quedan', { n: queue.length - chosen })}</p>}
            <button type="button" className="button-primary" onClick={onBack}>
              {t('versiones.volverAl', { libro: name })}
            </button>
          </>
        ) : (
          <>
            <h2 className="versions-place">
              {name} {place.chapter}:{place.verse}
            </h2>
            {/* What it translates, a layer away: the choice is between the two, and the bridge text helps weigh it. */}
            <button type="button" className="button-quiet versions-source-toggle" aria-expanded={source} onClick={() => setSource((s) => !s)}>
              {t(source ? 'versiones.ocultarFuente' : 'versiones.verFuente', { texto: bridge?.abbreviation ?? textAbbreviation })} {source ? '▴' : '▾'}
            </button>
            {source && bridge && (
              <div className="versions-source" dir={bridge.dir}>
                <WordLines lines={bridge.lines[place.verse] ?? []} verse={place.verse} lit={new Set()} onWord={() => {}} />
              </div>
            )}
            <TwoVersions
              key={`${place.chapter}.${place.verse}`}
              here={{ text: readDraft(book, place.chapter, place.verse), by: authorOf(book, place.chapter, place.verse) ?? '' }}
              received={received}
              inScreen
              onChoose={(keepReceived) => {
                chooseVersion(book, place.chapter, place.verse, keepReceived)
                setChosen((n) => n + 1)
                setAt((n) => n + 1)
              }}
            />
            <button type="button" className="button-quiet" onClick={() => setAt((n) => n + 1)}>
              {t('versiones.despuesEste')}
            </button>
          </>
        )}
      </main>
    </div>
  )
}
