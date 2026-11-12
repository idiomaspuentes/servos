/**
 * An article read in a sheet (a key word's, Translation Academy's), whose own links to other articles are offered by
 * their text and open in the same sheet, with «‹ Back» to the one before: the article it was opened on is not lost.
 * An article is taken from the chapter's data first, else read from this device (`readArticle`). A link is offered only
 * when its article can be read: the example bundled in the app carries its chapters' articles, not all of them.
 *
 * Opened on one of the book's issues (`inBook`), an Academy article also lists, folded above it, the notes of this book
 * that point to it: those of the section it was opened from first, marked «aquí»; one goes to its verse.
 */

import { useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { articleFrom, type ArticleRef } from '../../resources/articleLinks'
import { noteGist, notesInBook, type BookIssue } from '../projects/bookIssues'
import { useT } from '../i18n/i18n'
import { articlesOnDevice, readArticle } from '../projects/library'
import { DondeAparece } from './DondeAparece'
import { Markdown, type ArticleLinks } from './Markdown'
import { Sheet } from './Sheet'

export interface OpenArticle {
  /** Which article it is, for its links relative to it; none for one whose place is not known. */
  ref: ArticleRef | null
  title: string
  markdown: string
}

/** An article as the chapter's data has it (`words`, `academy`), when it does. */
export function articleIn(data: PrototypeData, ref: ArticleRef): OpenArticle | null {
  const found = ref.kind === 'tw' ? data.words[ref.path] : data.academy[ref.path]
  return found?.markdown ? { ref, title: found.title, markdown: found.markdown } : null
}

export interface InBook {
  /** The book's name as the team says it. */
  name: string
  issues: BookIssue[]
  /** The section it was opened from: its notes first. */
  here?: { chapter: number; verses: number[] }
  onGo(chapter: number, verse: number): void
}

export function ArticleSheet({ data, article, onClose, inBook }: { data: PrototypeData; article: OpenArticle; onClose(): void; inBook?: InBook }) {
  const t = useT()
  const [stack, setStack] = useState<OpenArticle[]>([article])
  const shown = stack[stack.length - 1]
  const open = async (ref: ArticleRef, label?: string) => {
    const found = articleIn(data, ref) ?? (await readArticle(ref).then((a) => (a ? { ref, ...a } : null)).catch(() => null))
    setStack((s) => [...s, found ?? { ref, title: label ?? ref.path, markdown: t('ayudas.articuloNoEsta') }])
  }
  const links: ArticleLinks = {
    titleOf: (ref) => articleIn(data, ref)?.title ?? null,
    open: (ref, label) => void open(ref, label),
    hrefOf: (href) => {
      const ref = articleFrom(href, shown.ref)
      return ref && (articleIn(data, ref) || articlesOnDevice(ref.kind)) ? ref : null
    },
  }
  return (
    <Sheet title={shown.title} onClose={onClose}>
      {stack.length > 1 && (
        <button type="button" className="word-help-read article-back" onClick={() => setStack((s) => s.slice(0, -1))}>
          ‹ {t('ayudas.volverA', { titulo: stack[stack.length - 2].title.split(',')[0].trim() })}
        </button>
      )}
      {inBook && shown.ref?.kind === 'ta' && <NotesInBook key={stack.length} inBook={inBook} path={shown.ref.path} onClose={onClose} />}
      <Markdown key={stack.length} text={shown.markdown} skipFirstHeading links={links} />
      {shown.ref && <DondeAparece key={stack.length} language={data.language} article={shown.ref} />}
    </Sheet>
  )
}

/** «En Rut: 14 notas», folded: the book's notes on the article shown, each going to its verse. */
function NotesInBook({ inBook, path, onClose }: { inBook: InBook; path: string; onClose(): void }) {
  const t = useT()
  const notes = notesInBook(inBook.issues, path, inBook.here)
  if (!notes) return null
  const summary = notes.length === 1 ? t('ayudas.enLibroUna', { libro: inBook.name }) : t('ayudas.enLibro', { libro: inBook.name, n: notes.length })
  return (
    <details className="word-help-other in-book">
      <summary>{summary}</summary>
      <ul className="in-book-list">
        {notes.map((n) => (
          <li key={`${n.chapter}:${n.id}`}>
            <button
              type="button"
              className="row-button in-book-row"
              onClick={() => {
                onClose()
                inBook.onGo(n.chapter, n.verse)
              }}
            >
              <span className="row-button-label">
                <span className="in-book-place">
                  {inBook.name} {n.chapter}:{n.verse}
                  {n.quote && <span className="in-book-quote"> «{n.quote}»</span>}
                  {n.here && <span className="badge">{t('ayudas.aqui')}</span>}
                </span>
                <span className="in-book-gist">{noteGist(n.note)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
