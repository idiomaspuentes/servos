/**
 * One word of the glossary, opened from its list: the team's decision on it (agreed, or a proposal to agree on), a way
 * to change it, and where its word of the original is in the project's books, each verse saying whether the team's
 * translation uses it. A verse is opened in the editor from here, to bring it in line.
 */

import { useMemo, useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { Sheet } from '../frame/Sheet'
import { useT } from '../i18n/i18n'
import { bookName } from '../projects/model'
import type { GlossaryEntry } from '../projects/glossary'
import { glossaryUses, type GlossaryUse } from '../projects/glossaryUses'

const forms = (text: string) =>
  text
    .split(/[;,]/)
    .map((f) => f.trim())
    .filter(Boolean)

export function GlossaryEntrySheet({
  entry,
  books,
  person,
  dir,
  onSave,
  onOpenVerse,
  onClose,
}: {
  entry: GlossaryEntry
  /** The project's books whose texts are on this phone. */
  books: Array<{ code: string; name: string; chapters: PrototypeData[] }>
  person: string
  /** The direction of the original (Hebrew is right to left). */
  dir?: 'ltr' | 'rtl'
  onSave(entry: GlossaryEntry): void
  onOpenVerse(use: GlossaryUse): void
  onClose(): void
}) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [rendering, setRendering] = useState(entry.rendering)
  const [others, setOthers] = useState(entry.alternatives.join(', '))
  const [note, setNote] = useState(entry.note)
  const uses = useMemo(() => glossaryUses(entry, books), [entry, books])
  const differ = uses.filter((u) => u.state === 'other').length
  const agreed = entry.status === 'agreed'

  const save = () => {
    const changed = rendering.trim() !== entry.rendering
    onSave({
      ...entry,
      rendering: rendering.trim(),
      alternatives: forms(others),
      note: note.trim(),
      // A rendering changed is a proposal again, until the team agrees on it.
      status: changed ? 'proposed' : entry.status,
      by: person,
    })
    setEditing(false)
  }

  return (
    <Sheet
      title={entry.rendering}
      onClose={onClose}
      dirty={editing && (rendering.trim() !== entry.rendering || others !== entry.alternatives.join(', ') || note !== entry.note)}
    >
      <div className="glossary-form">
        {/* The rendering is the sheet's title; under it, the word of the original it stands for and the decision. */}
        <p className="glossary-state">
          <span className={agreed ? 'badge badge-done' : 'badge'}>{t(agreed ? 'ayudas.acordada' : 'ayudas.propuesta')}</span>
          {entry.by && <span className="quiet">{t('ayudas.glosarioDe', { nombre: entry.by })}</span>}
          <span className="glossary-lemma" dir={dir}>
            {entry.lemma}
          </span>
        </p>
        {entry.alternatives.length > 0 && <p className="quiet">{t('ayudas.tambien', { formas: entry.alternatives.join(', ') })}</p>}
        {entry.note && <p className="study-other-text">{entry.note}</p>}

        {editing ? (
          <>
            <label className="field">
              <span className="field-label">{t('editor.comoSeTraduce')}</span>
              <input value={rendering} onChange={(e) => setRendering(e.target.value)} />
            </label>
            <label className="field">
              <span className="field-label">{t('editor.otrasFormas')}</span>
              <input value={others} onChange={(e) => setOthers(e.target.value)} placeholder={t('editor.otrasFormasAyuda')} />
            </label>
            <label className="field">
              <span className="field-label">{t('editor.notaGlosario')}</span>
              <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {rendering.trim() !== entry.rendering && agreed && <p className="quiet">{t('glosario.vuelvePropuesta')}</p>}
            <button type="button" className="button-primary" disabled={!rendering.trim()} onClick={save}>
              {t('editor.guardarGlosario')}
            </button>
            <button type="button" className="button-secondary" onClick={() => setEditing(false)}>
              {t('glosario.noCambiar')}
            </button>
          </>
        ) : (
          <>
            {/* A proposal's one thing to do is to agree on it; changing it is there, quieter. */}
            {!agreed && (
              <button type="button" className="button-primary" onClick={() => onSave({ ...entry, status: 'agreed', by: person })}>
                {t('glosario.acordar')}
              </button>
            )}
            <button type="button" className="button-secondary" onClick={() => setEditing(true)}>
              {t('glosario.cambiar')}
            </button>
          </>
        )}

        <section className="glossary-uses" aria-label={t('glosario.dondeAparece', { n: uses.length })}>
          <h3>{t('glosario.dondeAparece', { n: uses.length })}</h3>
          {uses.length === 0 ? (
            <p className="quiet">{t('glosario.noAparece')}</p>
          ) : (
            <>
              {differ > 0 && <p className="quiet">{t('glosario.dicenOtra', { n: differ })}</p>}
              <ul className="glossary-use-list">
                {uses.map((u) => (
                  <li key={`${u.book}.${u.chapter}.${u.verse}`}>
                    <button type="button" className={`glossary-use is-${u.state}`} onClick={() => onOpenVerse(u)}>
                      <span className="glossary-use-place">
                        {books.find((b) => b.code === u.book)?.name ?? bookName(u.book)} {u.chapter}:{u.verse}
                      </span>
                      <span className="glossary-use-state">
                        {u.state === 'uses' ? `✓ ${t('glosario.loUsa')}` : u.state === 'other' ? t('glosario.diceOtra') : t('glosario.sinTraducir')}
                      </span>
                      <span aria-hidden="true">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </Sheet>
  )
}
