/**
 * What «En toda la Biblia» (the word card) and «Dónde aparece» (an article) share: whether the map that answers is on
 * this device, the books that are not here with what bringing them costs, and a verse of another place read in a
 * sheet. Only in format 3 (`packsFormat() === 3`) with a reader of the language: format 2 screens show none of it.
 */

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { packsFormat } from '../../resources/online/packsServer'
import { useOnlineResources } from '../../resources/online/onlineResources'
import { readersGenerationV3, readerV3, subscribeReadersV3 } from '../../resources/v3/client'
import { parsePlace, type BookRead } from '../../resources/v3/lookups'
import { BOOKS } from '@bt-synergy/language-pack-v3'
import type { PackReader } from '@bt-synergy/language-pack-client'
import { useI18n, useT } from '../i18n/i18n'
import { helpsLanguagesHere, libraryVersion, subscribeLibrary, v3Books } from '../projects/library'
import { bookName } from '../projects/model'
import { askForBook, useBookAsked, useDownloadSize } from '../projects/onlineBooks'
import { sizeIn } from '../projects/onlineWords'
import { useOnline } from './online'
import { Sheet } from './Sheet'
import { verseOpener } from './verseOpener'

/**
 * Whether the map unit that answers (`xmap`, `map`) is on this device in format 3: a section without it is not shown
 * (nobody looked, which is not «nowhere»). Asks only the reader's installed state, no query. Asked again when the
 * readers are made anew (a book brought or received), not at every chapter the library reads.
 */
export function useMapHere(language: string, unit: 'xmap' | 'map'): boolean {
  const library = useSyncExternalStore(subscribeReadersV3, readersGenerationV3)
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
 * A query run only once its section is opened, and again when the readers are made anew while it is open (an install,
 * a refresh: not every chapter read while a download is applied). Undefined until it answers; null when it could not
 * be asked (no reader, an error).
 */
export function useLookup<T>(open: boolean, language: string, key: string, ask: (reader: NonNullable<Awaited<ReturnType<typeof readerV3>>>) => Promise<T>): T | null | undefined {
  const library = useSyncExternalStore(subscribeReadersV3, readersGenerationV3)
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
 * The books of a language this device can read in format 3 (their text and the original it is aligned to), read: those
 * of `only` when given (the books an answer names), else all.
 */
export async function booksRead(reader: PackReader, only?: ReadonlySet<string>): Promise<BookRead[]> {
  const out: BookRead[] = []
  for (const book of BOOKS) {
    if (only && !only.has(book)) continue
    if (!reader.installed(`book:${book}`) || !reader.installed(`orig:${book}`)) continue
    const [model, orig] = await Promise.all([reader.book(book), reader.orig(book)])
    if (model && orig) out.push({ book, model, orig })
  }
  return out
}

/**
 * The books of a language this device reads from a pack of before (today's rows) and not from format 3: they are here,
 * but the format 3 lookups do not see them. Follows the library (a book received moves from here to format 3).
 */
export function useBooksBefore(language: string): ReadonlySet<string> {
  useSyncExternalStore(subscribeLibrary, libraryVersion)
  const inV3 = v3Books().get(language) ?? new Set<string>()
  const here = helpsLanguagesHere().find((l) => l.code === language)?.books ?? []
  return new Set(here.map((b) => b.toLowerCase()).filter((b) => !inV3.has(b)))
}

/**
 * The books where it is that this device reads from a pack of before: said apart, as search says them, with «Bajar»
 * to bring them in format 3 where the language can. `meta` says more of a book.
 */
export function BeforeBooks({ language, books, meta }: { language: string; books: string[]; meta?(book: string): ReactNode }) {
  const t = useT()
  if (!books.length) return null
  return (
    <div className="across-missing">
      <p className="word-help-label">{t('ayudas.dePaqueteAntes')}</p>
      <ul className="across-list">
        {books.map((book) => (
          <MissingBook key={book} language={language} book={book} meta={meta?.(book)} />
        ))}
      </ul>
    </div>
  )
}

/**
 * The books not on this device that the language can bring, each with «Bajar» while there is internet and nothing
 * stops the language, and «Bajando…» once asked. `meta` says more of a book (how many times the article is used there).
 */
export function MissingBooks({ language, books, meta }: { language: string; books: string[]; meta?(book: string): ReactNode }) {
  const t = useT()
  if (!books.length) return null
  return (
    <div className="across-missing">
      <p className="word-help-label">{t('ayudas.noEstanEnAparato')}</p>
      <ul className="across-list">
        {books.map((book) => (
          <MissingBook key={book} language={language} book={book} meta={meta?.(book)} />
        ))}
      </ul>
    </div>
  )
}

/**
 * One book not here. Its size is what downloading it brings (`useDownloadSize`, as the book's screen says it: its
 * text, the original and the lexicon groups it needs), said only once known; never one smaller than what comes.
 */
function MissingBook({ language, book, meta }: { language: string; book: string; meta?: ReactNode }) {
  const { t, language: lang } = useI18n()
  const online = useOnline()
  const blocked = useOnlineResources().blocked[language]
  const asked = useBookAsked(language, book)
  const size = useDownloadSize(language, book, online && !asked && !blocked)
  return (
    <li className="across-row">
      <span className="across-row-name">
        {bookName(book)}
        {meta}
        {typeof size === 'number' && size > 0 && <span className="quiet"> · {sizeIn(t, size, lang)}</span>}
      </span>
      {asked ? (
        <span className="quiet">{t('ayudas.bajando')}</span>
      ) : (
        online &&
        !blocked &&
        size !== null && (
          <button type="button" className="chip" aria-label={t('ayudas.bajarLibro', { libro: bookName(book) })} onClick={() => void askForBook(language, book)}>
            {t('ayudas.bajar')}
          </button>
        )
      )}
    </li>
  )
}

/**
 * The books where it is that this language has no text of, said in one short sentence with how many; their names a
 * touch away.
 */
export function ElsewhereBooks({ books }: { books: string[] }) {
  const t = useT()
  const [named, setNamed] = useState(false)
  if (!books.length) return null
  const said = books.length === 1 ? t('ayudas.yEnUnLibroMas') : t('ayudas.yEnLibrosMas', { n: books.length })
  return (
    <div className="across-elsewhere">
      <button type="button" className="word-help-read" aria-expanded={named} onClick={() => setNamed(!named)}>
        {said} {named ? '▴' : '▾'}
      </button>
      {named && <p className="quiet">{books.map(bookName).join(', ')}</p>}
    </div>
  )
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
      {passage === undefined && <p className="quiet">{t('ayudas.buscando')}</p>}
      {passage !== undefined && !passage?.data?.texts.length && <p className="quiet">{t('ayudas.versiculoNoLlego')}</p>}
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
