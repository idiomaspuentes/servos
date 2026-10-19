/**
 * Under a verse already translated whose helps a newer pack changed (helpsChanges.ts): one row, the label «Ayudas
 * cambiadas» and what changed said short; unfolded, what each note and text said before, and «Seen», which takes the
 * row away. One row only, so the boxes of a section stay close. The notes as they are now are read in the helps,
 * where a changed one unfolds what it said too (`HelpsPanel`).
 */

import { useState, useSyncExternalStore } from 'react'
import { RowButton } from '../../frame/Actions'
import { Markdown } from '../../frame/Markdown'
import { useT } from '../../i18n/i18n'
import { changeAt, changesVersion, seeChange, subscribeChanges, type VerseChange } from '../../projects/helpsChanges'

/** What changed in a verse, said short: «Nota cambiada · TPL». */
export function useChangeSummary() {
  const t = useT()
  return (c: VerseChange) => {
    const parts: string[] = []
    for (const kind of ['cambiada', 'nueva', 'quitada'] as const) {
      const n = c.notes.filter((x) => x.kind === kind).length
      if (n) parts.push(t(n === 1 ? `cambios.nota.${kind}` : `cambios.notas.${kind}`, { n }))
    }
    for (const x of c.texts) parts.push(x.text === 'literal' ? 'TPL' : 'TPS')
    return parts.join(' · ')
  }
}

export function HelpsChanged({
  book,
  chapter,
  verse,
  original,
}: {
  book: string
  chapter: number
  verse: number
  /** The original's language and direction, for the words a note is about. */
  original?: { lang?: string; dir?: 'ltr' | 'rtl' }
}) {
  const t = useT()
  useSyncExternalStore(subscribeChanges, changesVersion)
  const summaryOf = useChangeSummary()
  const [open, setOpen] = useState(false)
  const change = changeAt(book, chapter, verse)
  if (!change) return null
  const quote = (text: string) => (
    <span lang={original?.lang} dir={original?.dir}>
      {text}
    </span>
  )
  return (
    <section className="helps-changed" aria-label={t('cambios.etiqueta')}>
      <RowButton
        kind="fold"
        label={
          <span className="helps-changed-head">
            <span className="badge badge-changed">{t('cambios.etiqueta')}</span>
            <span className="quiet">{summaryOf(change)}</span>
          </span>
        }
        expanded={open}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <>
          <ul className="helps-changed-list">
            {change.notes.map((n) => (
              <li key={n.id}>
                <p>
                  {t(`cambios.cual.${n.kind}`)} {quote(n.quote)}
                </p>
                {n.kind === 'nueva' ? (
                  <p className="quiet">{t('cambios.leaEnAyudas')}</p>
                ) : (
                  <div className="helps-changed-before">
                    <p className="quiet">{t('cambios.decia')}</p>
                    <Markdown text={n.before ?? ''} />
                  </div>
                )}
              </li>
            ))}
            {change.texts.map((x) => (
              <li key={x.text}>
                <p>{t('cambios.textoCambio', { texto: x.text === 'literal' ? 'TPL' : 'TPS' })}</p>
                <div className="helps-changed-before">
                  <p className="quiet">{t('cambios.decia')}</p>
                  <p className="helps-changed-text">{x.before || '—'}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="chip-row">
            <button type="button" className="chip" onClick={() => seeChange(book, chapter, verse)}>
              ✓ {t('cambios.visto')}
            </button>
          </div>
        </>
      )}
    </section>
  )
}
