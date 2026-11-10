/**
 * «Buscar», from a book's «More» (format 3): a word or more, looked for in the texts and helps of the language's books
 * on this device (the library's full-text index: SQLite in the apps, built in memory on the web). The field is the one
 * thing to do; under it the hits, by kind, each with its place and the words found marked. A hit in a book the person
 * works on here opens its verse in the mini app last worked in; one in another book is only read.
 */
import type { Hit } from '@bt-synergy/language-pack-client'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { readerV3 } from '../../resources/v3/client'
import { Sheet } from '../frame/Sheet'
import type { VersePlace } from '../frame/verseOpener'
import { useT } from '../i18n/i18n'
import { libraryVersion, subscribeLibrary } from '../projects/library'
import { groupHits, groupKey, hitPlace, hitWhere, resLabel, snippetParts } from './searchHits'

/** As many hits as a phone shows without the list becoming the work; the sheet says when there may be more. */
export const SEARCH_LIMIT = 60
/** The person stops typing this long before the search runs. */
const PAUSE_MS = 300

type Found = { text: string; hits: Hit[] } | { text: string; none: 'libros' | 'error' }

export function SearchSheet({
  language,
  canOpen,
  onOpen,
  onClose,
}: {
  /** The helps language whose books are searched. */
  language: string
  canOpen(place: VersePlace): boolean
  onOpen(place: VersePlace): void
  onClose(): void
}) {
  const t = useT()
  const [text, setText] = useState('')
  const [found, setFound] = useState<Found | null>(null)
  const library = useSyncExternalStore(subscribeLibrary, libraryVersion)
  const wanted = text.trim()
  useEffect(() => {
    if (wanted.length < 2) return
    let live = true
    const timer = setTimeout(() => {
      readerV3(language)
        .then(async (reader): Promise<Found> => {
          if (!reader) return { text: wanted, none: 'libros' }
          const answer = await reader.search(wanted, { limit: SEARCH_LIMIT })
          return { text: wanted, hits: answer.data ?? [] }
        })
        .catch((): Found => ({ text: wanted, none: 'error' }))
        .then((f) => live && setFound(f))
    }, PAUSE_MS)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [wanted, language, library])

  const shown = found && found.text === wanted ? found : null
  const status =
    wanted.length < 2
      ? t('buscar.ayuda')
      : !shown
        ? t('buscar.buscando')
        : 'none' in shown
          ? t(shown.none === 'libros' ? 'buscar.sinLibros' : 'buscar.noSePudo')
          : shown.hits.length === 0
            ? t('buscar.nada', { texto: wanted })
            : shown.hits.length >= SEARCH_LIMIT
              ? t('buscar.primeros', { n: shown.hits.length })
              : shown.hits.length === 1
                ? t('buscar.uno')
                : t('buscar.varios', { n: shown.hits.length })

  return (
    <Sheet title={t('buscar.titulo')} onClose={onClose}>
      <form className="search-form" role="search" onSubmit={(e) => e.preventDefault()}>
        <label className="field">
          <span className="field-label">{t('buscar.campo')}</span>
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} autoFocus enterKeyHint="search" autoComplete="off" spellCheck={false} />
        </label>
      </form>
      <p className="quiet" role="status">
        {status}
      </p>
      {shown && 'hits' in shown &&
        groupHits(shown.hits).map((group) => (
          <section key={group.kind} className="search-group">
            <h3 className="word-help-label">{t(groupKey(group.kind))}</h3>
            <ul className="search-hits">
              {group.hits.map((hit, i) => {
                const place = hitPlace(hit)
                const body = (
                  <>
                    <span className="search-hit-place">
                      {hitWhere(hit, t)}
                      {hit.kind === 'text' && <span className="search-hit-res"> · {resLabel(hit.res)}</span>}
                    </span>
                    <span className="search-hit-snippet">
                      {snippetParts(hit.snippet, wanted).map((p, k) => (p.found ? <mark key={k}>{p.text}</mark> : <span key={k}>{p.text}</span>))}
                    </span>
                  </>
                )
                return (
                  <li key={`${hit.res}|${hit.ref}|${hit.id ?? ''}|${i}`}>
                    {place && canOpen(place) ? (
                      <button type="button" className="search-hit" onClick={() => onOpen(place)}>
                        {body}
                      </button>
                    ) : (
                      <div className="search-hit is-read-only">{body}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
    </Sheet>
  )
}
