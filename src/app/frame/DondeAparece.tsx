/**
 * «Dónde aparece», folded under an article: the books that use it (`books`), with how many times, the ones on this
 * device first; the ones not here apart, with their size and «Bajar». A book whose helps do not cover it is not said
 * as zero: it is left unsaid, and when no book is covered the section says the helps do not tell. Asked only when
 * opened; not shown at all without format 3 or without the map that answers (`xmap` for words, `map` for the Academy).
 */

import { useState } from 'react'
import type { ArticleRef } from '../../resources/articleLinks'
import { articleAcrossBooks, articleIdV3, articleMapUnit } from '../../resources/v3/lookups'
import { useT } from '../i18n/i18n'
import { bookName } from '../projects/model'
import { ElsewhereBooks, MissingBooks, useLookup, useMapHere } from './acrossBooks'

export function DondeAparece({ language, article }: { language: string; article: ArticleRef }) {
  const t = useT()
  const id = articleIdV3(article)
  const here = useMapHere(language, articleMapUnit(article))
  const [open, setOpen] = useState(false)
  const answer = useLookup(open && here, language, `books ${id}`, (reader) => reader.books({ article: id }))
  const books = answer ? articleAcrossBooks(answer) : null
  if (!here || (books && !books.installed)) return null

  const times = (n: number) => (n === 1 ? t('ayudas.unaVez') : t('ayudas.vecesN', { n }))
  const counts = new Map(books?.missing.map((b) => [b.book, b.count]))
  const bringable = books?.missing.filter((b): b is { book: string; count: number; bytes: number } => b.bytes !== undefined) ?? []
  const notCarried = books?.missing.filter((b) => b.bytes === undefined).map((b) => b.book) ?? []
  const nothing = books && !books.here.length && !books.missing.length

  return (
    <details className="word-help-other across article-across" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t('ayudas.dondeAparece')}</summary>
      {books && nothing && <p className="quiet">{t(!books.covered ? 'ayudas.dondeApareceSinDatos' : 'ayudas.dondeApareceNinguno')}</p>}
      {books && books.here.length > 0 && (
        <ul className="across-list">
          {books.here.map((b) => (
            <li key={b.book} className="across-row">
              <span className="across-row-name">
                {bookName(b.book)}
                <span className="quiet"> · {times(b.count)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {books && (
        <>
          <MissingBooks language={language} books={bringable} meta={(book) => <span className="quiet"> · {times(counts.get(book) ?? 0)}</span>} />
          <ElsewhereBooks books={notCarried} />
        </>
      )}
    </details>
  )
}

