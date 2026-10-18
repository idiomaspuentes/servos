/**
 * Adding a word to the project's glossary from the editor, or changing its entry: how the team translates the word of
 * the original the touched word stands for. On a phone the words the translator already wrote in this verse are
 * offered to touch, so the rendering is chosen rather than typed again.
 */

import { useState } from 'react'
import type { PrototypeData } from '../../../prototype/data'
import { Sheet } from '../../frame/Sheet'
import type { GlossaryTarget } from '../../frame/TouchWords'
import { useT } from '../../i18n/i18n'
import { entryFor, newGlossaryId, type GlossaryEntry } from '../../projects/glossary'

/** The words of a translation, each once, without the punctuation around them. */
const wordsOf = (text: string) => [...new Set(text.split(/\s+/).map((w) => w.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean))]

const forms = (text: string) =>
  text
    .split(/[;,]/)
    .map((f) => f.trim())
    .filter(Boolean)

export function GlossarySheet({
  data,
  target,
  glossary,
  written,
  person,
  onSave,
  onClose,
}: {
  data: PrototypeData
  target: GlossaryTarget
  glossary: GlossaryEntry[]
  /** What the translator wrote in the touched word's verse: its words are offered. */
  written: string
  person: string
  onSave(entry: GlossaryEntry): void
  onClose(): void
}) {
  const t = useT()
  const original = data.texts.find((x) => x.original)
  const words = target.originals.map((p) => original?.words?.[p]).filter((w): w is { lemma: string; strong: string } => Boolean(w))
  const strong = words.map((w) => w.strong).join(';')
  const lemma = words.map((w) => w.lemma).join(' + ')
  const before = entryFor(glossary, strong)
  const [rendering, setRendering] = useState(before?.rendering ?? '')
  const [others, setOthers] = useState(before?.alternatives.join(', ') ?? '')
  const [note, setNote] = useState(before?.note ?? '')
  const offered = wordsOf(written)

  if (!words.length) {
    return (
      <Sheet title={t('editor.glosario')} onClose={onClose}>
        <p>{t('editor.glosarioSinOriginal', { palabra: target.word })}</p>
      </Sheet>
    )
  }

  const save = () => {
    onSave({
      id: before?.id ?? newGlossaryId(glossary.map((e) => e.id)),
      lemma,
      strong,
      english: before?.english ?? [],
      sense: before?.sense ?? '',
      rendering: rendering.trim(),
      alternatives: forms(others),
      avoid: before?.avoid ?? [],
      scope: before?.scope ?? 'all',
      variants: before?.variants ?? [],
      twLink: before?.twLink ?? '',
      examples: before?.examples ?? [],
      // A new entry, or a change, is a proposal until the team agrees on it.
      status: before && before.rendering === rendering.trim() ? before.status : 'proposed',
      note: note.trim(),
      by: person,
    })
  }

  return (
    <Sheet
      title={t('editor.glosario')}
      onClose={onClose}
      dirty={rendering !== (before?.rendering ?? '') || others !== (before?.alternatives.join(', ') ?? '') || note !== (before?.note ?? '')}
    >
      <div className="glossary-form">
        <p className="glossary-word">
          <span>{target.word}</span>
          <span className="help-original" dir={original?.dir} lang={original?.lang}>
            {lemma}
          </span>
        </p>
        <label className="field">
          <span className="field-label">{t('editor.comoSeTraduce')}</span>
          <input value={rendering} onChange={(e) => setRendering(e.target.value)} placeholder={t('editor.comoSeTraduceEjemplo')} />
        </label>
        {offered.length > 0 && (
          <div className="glossary-offered">
            <span className="quiet">{t('editor.deSuTraduccion')}</span>
            <div className="study-prompts">
              {offered.map((w) => (
                <button key={w} type="button" className="chip" onClick={() => setRendering((now) => (now.trim() ? `${now.trim()} ${w}` : w))}>
                  {w}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="field">
          <span className="field-label">{t('editor.otrasFormas')}</span>
          <input value={others} onChange={(e) => setOthers(e.target.value)} placeholder={t('editor.otrasFormasAyuda')} />
        </label>
        <label className="field">
          <span className="field-label">{t('editor.notaGlosario')}</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        {before?.by && <p className="quiet">{t('ayudas.glosarioDe', { nombre: before.by })}</p>}
        <button type="button" className="button-primary" disabled={!rendering.trim()} onClick={save}>
          {t('editor.guardarGlosario')}
        </button>
      </div>
    </Sheet>
  )
}
