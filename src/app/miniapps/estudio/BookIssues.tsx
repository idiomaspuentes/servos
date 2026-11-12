/**
 * «Lo difícil de este libro»: the Academy articles the book's notes use, most used first, each a row that opens its
 * sheet (its article and its notes in this book). The first few in sight, the rest folded, so the stop is read without
 * scrolling through a long book's every issue. One opened is marked «Leído»; reading them is offered, not required.
 */

import { useState } from 'react'
import { useT } from '../../i18n/i18n'
import type { BookIssue } from '../../projects/bookIssues'

/** How many issues are in sight before «Ver los otros». */
export const ISSUES_IN_SIGHT = 8

export function BookIssues({ issues, bookName, read, onOpen }: { issues: BookIssue[]; bookName: string; read: string[]; onOpen(issue: BookIssue): void }) {
  const t = useT()
  const [all, setAll] = useState(false)
  const count = (i: BookIssue) =>
    i.notes.length === 1
      ? t('estudio.asuntoCuentaUna')
      : i.chapters === 1
        ? t('estudio.asuntoCuentaUnCapitulo', { n: i.notes.length })
        : t('estudio.asuntoCuenta', { n: i.notes.length, c: i.chapters })
  const row = (i: BookIssue) => (
    <li key={i.path}>
      <button type="button" className="row-button issue-row" onClick={() => onOpen(i)}>
        <span className="row-button-label">
          <span className="issue-row-title">
            {i.title}
            {read.includes(i.path) && <span className="badge">{t('estudio.leido')}</span>}
          </span>
          <span className="issue-row-meta">{count(i)}</span>
        </span>
      </button>
    </li>
  )
  const rest = issues.length - ISSUES_IN_SIGHT
  return (
    <article className="study-intro book-issues" aria-label={t('estudio.loDificil')}>
      <h3>{t('estudio.loDificil')}</h3>
      <p>{t('estudio.loDificilPara', { libro: bookName })}</p>
      <ul className="in-book-list">{issues.slice(0, ISSUES_IN_SIGHT).map(row)}</ul>
      {rest > 0 && (
        <>
          <button type="button" className="row-button is-fold" aria-expanded={all} onClick={() => setAll((x) => !x)}>
            <span className="row-button-label">{t('estudio.otrosAsuntos', { n: rest })}</span>
          </button>
          {all && <ul className="in-book-list">{issues.slice(ISSUES_IN_SIGHT).map(row)}</ul>}
        </>
      )}
    </article>
  )
}
