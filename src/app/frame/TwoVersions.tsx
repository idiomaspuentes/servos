/**
 * Choosing between two versions of a verse (design 6.2): both in full, each with the words the other lacks marked,
 * so the few words to weigh stand out. One is touched, and the one filled button keeps it; the other is gone. The
 * verse kept can be corrected afterwards like any other, in the editor. A choice that came with the book from another
 * phone, where nobody chose yet, says each version by who wrote it: neither was sent from there to here.
 */

import { useMemo, useState } from 'react'
import { useT } from '../i18n/i18n'
import { compareVersions, type VersionPiece } from '../projects/versions'
import { joinStartOf, joinedVerses, readDraft, type OtherVersion, type StructureConflict } from '../projects/work'

/** Pieces side by side with the same mark, as one: a change of three words is one mark, not three. */
const runsOf = (pieces: VersionPiece[]) =>
  pieces.reduce<VersionPiece[]>((runs, p) => {
    const last = runs[runs.length - 1]
    if (last && last.changed === p.changed) last.text += p.text
    else runs.push({ ...p })
    return runs
  }, [])

export function TwoVersions({
  here,
  received,
  onChoose,
  inScreen = false,
}: {
  here: OtherVersion
  received: OtherVersion
  onChoose(keepReceived: boolean): void
  /** On a screen of its own its button is the filled one; inside the editor, the editor's «Next» is. */
  inScreen?: boolean
}) {
  const t = useT()
  const [picked, setPicked] = useState<'here' | 'received' | null>(null)
  const { a, b } = useMemo(() => compareVersions(here.text, received.text), [here.text, received.text])

  const version = (which: 'here' | 'received', label: string, pieces: VersionPiece[]) => (
    <button type="button" className={picked === which ? 'version is-on' : 'version'} aria-pressed={picked === which} onClick={() => setPicked(which)}>
      <span className="version-who">
        <span className="version-dot" aria-hidden="true" />
        {label}
      </span>
      {/* A version that is no text is a verse someone emptied on purpose: said, not shown as an empty box. */}
      {(which === 'here' ? here.text : received.text).trim() ? (
        <span className="version-text">{runsOf(pieces).map((p, i) => (p.changed ? <mark key={i}>{p.text}</mark> : p.text))}</span>
      ) : (
        <span className="version-text quiet">{t('versiones.borrado')}</span>
      )}
    </button>
  )

  return (
    <section className="versions" aria-label={t('versiones.titulo')}>
      <p className="versions-ask">{t(received.carried ? 'versiones.preguntaLlegaron' : 'versiones.pregunta')}</p>
      {version('here', received.carried ? (here.by ? t('versiones.ahoraDe', { nombre: here.by }) : t('versiones.ahora')) : here.by ? t('versiones.aquiDe', { nombre: here.by }) : t('versiones.aqui'), a)}
      {version('received', t(received.carried ? 'versiones.laDe' : 'versiones.recibidaDe', { nombre: received.by }), b)}
      <button type="button" className={inScreen ? 'button-primary' : 'button-secondary'} disabled={!picked} onClick={() => picked && onChoose(picked === 'received')}>
        {picked === 'here'
          ? received.carried
            ? here.by
              ? t('versiones.quedarseRecibida', { nombre: here.by })
              : t('versiones.quedarseAhora')
            : t('versiones.quedarseAqui')
          : picked === 'received'
            ? t('versiones.quedarseRecibida', { nombre: received.by })
            : t('versiones.elijaUna')}
      </button>
      <p className="quiet versions-after">{t('versiones.despues')}</p>
    </section>
  )
}

/** A stretch's verses as they are here: each verse alone, or a join, with its text. */
function unitsHere(book: string, c: StructureConflict) {
  const out: Array<{ from: number; to: number; text: string }> = []
  for (let v = c.from; v <= c.to; v++) {
    if (joinStartOf(book, c.chapter, v) !== v) continue
    const verses = joinedVerses(book, c.chapter, v)
    out.push({ from: v, to: verses[verses.length - 1], text: readDraft(book, c.chapter, v) })
  }
  return out
}
const label = (u: { from: number; to: number }) => (u.to > u.from ? `${u.from}–${u.to}` : `${u.from}`)

/**
 * Verses joined one way here and another there (1 and 2 apart, or 1–2 as one): the two ways side by side, each verse
 * or join with its text, and one kept for the whole stretch. Not verse by verse: a text said for 1–2 is not a version
 * of verse 1.
 */
export function TwoShapes({
  book,
  conflict,
  onChoose,
  inScreen = false,
}: {
  book: string
  conflict: StructureConflict
  onChoose(keepReceived: boolean): void
  inScreen?: boolean
}) {
  const t = useT()
  const [picked, setPicked] = useState<'here' | 'received' | null>(null)
  const here = unitsHere(book, conflict)
  const by = conflict.received.find((r) => r.by)?.by ?? ''
  // «apart (1, 2)» or «joined (1–2)»: the shape said in words, the numbers beside it.
  const shapeOf = (units: Array<{ from: number; to: number }>) =>
    t(units.some((u) => u.to > u.from) ? 'versiones.unidos' : 'versiones.separados', { v: units.map(label).join(', ') })
  const shape = (which: 'here' | 'received', title: string, units: Array<{ from: number; to: number; text: string }>) => (
    <button type="button" className={picked === which ? 'version is-on' : 'version'} aria-pressed={picked === which} onClick={() => setPicked(which)}>
      <span className="version-who">
        <span className="version-dot" aria-hidden="true" />
        {title}
      </span>
      {units.map((u) => (
        <span key={u.from} className="version-unit">
          <span className="verse-number">{label(u)}</span>
          <span className="version-text">{u.text || '—'}</span>
        </span>
      ))}
    </button>
  )
  return (
    <section className="versions" aria-label={t('versiones.formaTitulo')}>
      <p className="versions-ask">
        {t(conflict.carried ? 'versiones.formaPreguntaLlegaron' : 'versiones.formaPregunta', { aqui: shapeOf(here), alla: shapeOf(conflict.received), nombre: by })}
      </p>
      {shape('here', t(conflict.carried ? 'versiones.ahora' : 'versiones.aqui'), here)}
      {shape('received', t(conflict.carried ? 'versiones.laDe' : 'versiones.recibidaDe', { nombre: by }), conflict.received)}
      <button type="button" className={inScreen ? 'button-primary' : 'button-secondary'} disabled={!picked} onClick={() => picked && onChoose(picked === 'received')}>
        {picked === 'here'
          ? t(conflict.carried ? 'versiones.quedarseAhora' : 'versiones.quedarseAqui')
          : picked === 'received'
            ? t('versiones.quedarseRecibida', { nombre: by })
            : t('versiones.elijaUna')}
      </button>
      <p className="quiet versions-after">{t('versiones.formaDespues')}</p>
    </section>
  )
}
