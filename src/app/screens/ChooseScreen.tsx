/**
 * The verses of a book with two versions (received while this phone had its own text), one at a time: what the
 * bridge text says, a layer away; the two versions with what tells them apart; and, once one is kept, the next. A verse
 * can be left for later; it stays waiting, and the book page keeps saying how many are left.
 */

import { useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { useProjectFont } from '../frame/fonts'
import { RowButton } from '../frame/Actions'
import { TwoShapes, TwoVersions } from '../frame/TwoVersions'
import { WordLines } from '../frame/TouchWords'
import { useT } from '../i18n/i18n'
import type { Project } from '../projects/model'
import { versesToChoose } from '../projects/versions'
import { authorOf, chooseStructure, chooseVersion, otherVersion, readDraft, structureConflictsOf } from '../projects/work'

export function ChooseScreen({
  project,
  book,
  title,
  chapters,
  textAbbreviation,
  person,
  onBack,
}: {
  project: Project
  book: string
  /** The book's name as the team says it. */
  title: string
  chapters: PrototypeData[]
  /** The bridge text the person reads by (TPL by default). */
  textAbbreviation: string
  /** Who chooses: the choice goes into the book's journal with their name. */
  person: string
  onBack(): void
}) {
  const t = useT()
  // The verses to choose, as they were on opening: one chosen or left for later does not move the others.
  const [queue] = useState(() => versesToChoose(book, chapters.map((c) => ({ chapter: c.chapter, verses: c.verses.map((v) => v.verse) }))))
  const [at, setAt] = useState(0)
  // A verse several people wrote waits once for each of them: they come one after another, on the same verse.
  const [round, setRound] = useState(0)
  const [chosen, setChosen] = useState(0)
  const [source, setSource] = useState(false)
  useProjectFont(project.font)

  const name = title
  const place = queue[at]
  const data = place && chapters.find((c) => c.chapter === place.chapter)
  const bridge = data && (data.texts.find((x) => x.abbreviation === textAbbreviation) ?? data.texts.find((x) => !x.original))
  const received = place?.kind === 'texto' ? otherVersion(book, place.chapter, place.verse) : null
  const stretch = place?.kind === 'estructura' ? structureConflictsOf(book, place.chapter).find((c) => c.from === place.verse) ?? null : null
  const next = () => {
    setChosen((n) => n + 1)
    setAt((n) => n + 1)
  }

  return (
    <div className="screen">
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
        {!place || (!received && !stretch) ? (
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
              {name} {place.chapter}:{stretch ? `${stretch.from}–${stretch.to}` : place.verse}
            </h2>
            {/* What it translates, a layer away: the choice is between the two, and the bridge text helps weigh it. */}
            <RowButton kind="fold" label={t('versiones.loQueDice', { texto: bridge?.abbreviation ?? textAbbreviation })} expanded={source} onClick={() => setSource((s) => !s)} />
            {source && bridge && (
              <div className="versions-source" dir={bridge.dir}>
                {(stretch ? Array.from({ length: stretch.to - stretch.from + 1 }, (_, i) => stretch.from + i) : [place.verse]).map((v) => (
                  <WordLines key={v} lines={bridge.lines[v] ?? []} verse={v} lit={new Set()} onWord={() => {}} />
                ))}
              </div>
            )}
            {stretch ? (
              <TwoShapes
                key={`${place.chapter}.${stretch.from}`}
                book={book}
                conflict={stretch}
                inScreen
                onChoose={(keepReceived) => {
                  chooseStructure(book, place.chapter, stretch.from, keepReceived, person)
                  next()
                }}
              />
            ) : (
              <TwoVersions
                key={`${place.chapter}.${place.verse}.${round}`}
                here={{ text: readDraft(book, place.chapter, place.verse), by: authorOf(book, place.chapter, place.verse) ?? '' }}
                received={received!}
                inScreen
                onChoose={(keepReceived) => {
                  chooseVersion(book, place.chapter, place.verse, keepReceived, person)
                  if (otherVersion(book, place.chapter, place.verse)) setRound((n) => n + 1)
                  else next()
                }}
              />
            )}
            <button type="button" className="button-secondary" onClick={() => setAt((n) => n + 1)}>
              {t('versiones.despuesEste')}
            </button>
          </>
        )}
      </main>
    </div>
  )
}
