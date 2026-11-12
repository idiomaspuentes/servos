/**
 * «Asuntos de traducción aquí (n)», folded above a section's text: the book's issues with a note on its verses, each
 * with where it is in the section and how often in the whole book; one opens its sheet with the section's notes first.
 * An index of the section, nothing more: touching a word still brings its note. Nothing at all when the section has
 * none. Open or folded is kept on this device, for whoever always reads it.
 */

import { useState } from 'react'
import { useT } from '../../i18n/i18n'
import type { BookIssue, issuesOfSection } from '../../projects/bookIssues'

const OPEN_KEY = 'servos.estudio.asuntosAqui'

const keptOpen = () => {
  try {
    return localStorage.getItem(OPEN_KEY) === '1'
  } catch {
    return false
  }
}

export function SectionIssues({ rows, chapter, bookName, onOpen }: { rows: ReturnType<typeof issuesOfSection>; chapter: number; bookName: string; onOpen(issue: BookIssue): void }) {
  const t = useT()
  const [open, setOpen] = useState(keptOpen)
  if (!rows.length) return null
  const toggle = (next: boolean) => {
    setOpen(next)
    try {
      localStorage.setItem(OPEN_KEY, next ? '1' : '0')
    } catch {
      /* kept for this visit */
    }
  }
  return (
    <details className="word-help-other section-issues" open={open} onToggle={(e) => toggle(e.currentTarget.open)}>
      <summary>{t('estudio.asuntosAqui', { n: rows.length })}</summary>
      <ul className="in-book-list">
        {rows.map(({ issue, verses }) => (
          <li key={issue.path}>
            <button type="button" className="row-button issue-row" onClick={() => onOpen(issue)}>
              <span className="row-button-label">
                <span className="issue-row-title">{issue.title}</span>
                <span className="issue-row-meta">
                  {verses.map((v) => `${chapter}:${v}`).join(', ')} · {t('estudio.enTodoLibro', { n: issue.notes.length, libro: bookName })}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </details>
  )
}
