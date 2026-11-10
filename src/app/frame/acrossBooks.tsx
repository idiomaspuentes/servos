/**
 * What «En toda la Biblia» (the word card) and «Dónde aparece» (an article) share: whether the map that answers is on
 * this device, the books that are not here with what bringing them costs, and a verse of another place read in a
 * sheet. Only in format 3 (`packsFormat() === 3`) with a reader of the language: format 2 screens show none of it.
 */

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { packsFormat } from '../../resources/online/packsServer'
import { useOnlineResources } from '../../resources/online/onlineResources'
import { readerV3 } from '../../resources/v3/client'
import { parsePlace } from '../../resources/v3/lookups'
import { useI18n, useT } from '../i18n/i18n'
import { libraryVersion, subscribeLibrary } from '../projects/library'
import { bookName } from '../projects/model'
import { askForBook, useBookAsked } from '../projects/onlineBooks'
import { sizeIn } from '../projects/onlineWords'
import { useOnline } from './online'
import { Sheet } from './Sheet'
import { verseOpener } from './verseOpener'

/**
 * Whether the map unit that answers (`xmap`, `map`) is on this device in format 3: a section without it is not shown
 * (nobody looked, which is not «nowhere»). Asks only the reader's installed state, no query. Asked again when the
 * library changes (a book brought or received).
 */
export function useMapHere(language: string, unit: 'xmap' | 'map'): boolean {
  const library = useSyncExternalStore(subscribeLibrary, libraryVersion)
  const [here, setHere] = useState(false)
  useEffect(() => {
    if (packsFormat() !== 3 || !language) return setHere(false)
    let live = true
    readerV3(language)
      .then((reader) => live && setHere(Boolean(reader?.installed(unit))))
      .catch(() => live && setHere(false))
    return () => {
      live = false
    }
  }, [language, unit, library])
  return here
}

/**
 * A query run only once its section is opened, and again when the library changes while it is open. Undefined until
 * it answers; null when it could not be asked (no reader, an error): the section then says nothing.
 */
export function useLookup<T>(open: boolean, language: string, key: string, ask: (reader: NonNullable<Awaited<ReturnType<typeof readerV3>>>) => Promise<T>): T | null | undefined {
  const library = useSyncExternalStore(subscribeLibrary, libraryVersion)
  const [found, setFound] = useState<{ key: string; value: T | null } | null>(null)
  const of = `${language}|${key}`
  useEffect(() => {
    if (!open) return
    let live = true
    readerV3(language)
      .then((reader) => (reader ? ask(reader) : null))
      .catch(() => null)
      .then((value) => live && setFound({ key: of, value }))
    return () => {
      live = false
    }
    // `ask` is a new function every render; what it asks is in `of`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, of, library])
  return found && found.key === of ? found.value : undefined
}

/** A book and a place in it, as the app names books: «Tito 2:11». */
export function placeName(ref: string): string {
  const p = parsePlace(ref)
  return p ? `${bookName(p.book)} ${p.chapter}:${p.verse}` : ref
}

/**
 * The books not on this device, each with its size and «Bajar» while there is internet and nothing stops the language;
 * «Bajando…» once asked. `meta` says more of a book (how many times the article is used there).
 */
export function MissingBooks({ language, books, meta }: { language: string; books: { book: string; bytes: number }[]; meta?(book: string): ReactNode }) {
  const t = useT()
  if (!books.length) return null
  return (
    <div className="across-missing">
      <p className="word-help-label">{t('ayudas.noEstanEnAparato')}</p>
      <ul className="across-list">
        {books.map((b) => (
          <MissingBook key={b.book} language={language} book={b.book} bytes={b.bytes} meta={meta?.(b.book)} />
        ))}
      </ul>
    </div>
  )
}

function MissingBook({ language, book, bytes, meta }: { language: string; book: string; bytes: number; meta?: ReactNode }) {
  const { t, language: lang } = useI18n()
  const online = useOnline()
  const blocked = useOnlineResources().blocked[language]
  const asked = useBookAsked(language, book)
  return (
    <li className="across-row">
      <span className="across-row-name">
        {bookName(book)}
        {meta}
        {bytes > 0 && <span className="quiet"> · {sizeIn(t, bytes, lang)}</span>}
      </span>
      {asked ? (
        <span className="quiet">{t('ayudas.bajando')}</span>
      ) : (
        online &&
        !blocked && (
          <button type="button" className="chip" aria-label={t('ayudas.bajarLibro', { libro: bookName(book) })} onClick={() => void askForBook(language, book)}>
            {t('ayudas.bajar')}
          </button>
        )
      )}
    </li>
  )
}

/** Books named in one line («También en Lucas, Juan…»): where it is, though this language has no text of them to bring. */
export function ElsewhereBooks({ books }: { books: string[] }) {
  const t = useT()
  if (!books.length) return null
  return <p className="quiet across-elsewhere">{t('ayudas.tambienEn', { libros: books.map(bookName).join(', ') })}</p>
}

/**
 * A verse of another place, read from this device in a sheet over what the person was doing (their place is not
 * lost), with the way there when the app can open it where they work.
 */
export function VerseSheet({ data, place, onClose }: { data: PrototypeData; place: string; onClose(): void }) {
  const t = useT()
  const passage = useLookup(true, data.language, place, (reader) => reader.passage(place))
  const at = parsePlace(place)
  const opener = verseOpener()
  const canGo = Boolean(at && opener?.can(at))
  const label = (res: string) => data.texts.find((x) => x.key === res)?.abbreviation ?? res.slice(res.lastIndexOf('/') + 1).toUpperCase()
  return (
    <Sheet title={placeName(place)} onClose={onClose}>
      {passage?.data?.texts.map((x) => (
        <div key={x.res} className="across-verse">
          <p className="word-help-label">{label(x.res)}</p>
          <p>{x.text}</p>
        </div>
      ))}
      {canGo && at && (
        <button
          type="button"
          className="button-secondary"
          onClick={() => {
            onClose()
            opener!.open(at)
          }}
        >
          {t('ayudas.irA', { lugar: placeName(place) })}
        </button>
      )}
    </Sheet>
  )
}
