/**
 * Choosing between two versions of a verse (design 6.2): both in full, each with the words the other lacks marked,
 * so the few words to weigh stand out. One is touched, and the one filled button keeps it; the other is gone. The
 * verse kept can be corrected afterwards like any other, in the editor.
 */

import { useMemo, useState } from 'react'
import { useT } from '../i18n/i18n'
import { compareVersions, type VersionPiece } from '../projects/versions'
import type { OtherVersion } from '../projects/work'

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
      <span className="version-text">{runsOf(pieces).map((p, i) => (p.changed ? <mark key={i}>{p.text}</mark> : p.text))}</span>
    </button>
  )

  return (
    <section className="versions" aria-label={t('versiones.titulo')}>
      <p className="versions-ask">{t('versiones.pregunta')}</p>
      {version('here', here.by ? t('versiones.aquiDe', { nombre: here.by }) : t('versiones.aqui'), a)}
      {version('received', t('versiones.recibidaDe', { nombre: received.by }), b)}
      <button type="button" className={inScreen ? 'button-primary' : 'button-secondary'} disabled={!picked} onClick={() => picked && onChoose(picked === 'received')}>
        {picked === 'here' ? t('versiones.quedarseAqui') : picked === 'received' ? t('versiones.quedarseRecibida', { nombre: received.by }) : t('versiones.elijaUna')}
      </button>
      <p className="quiet versions-after">{t('versiones.despues')}</p>
    </section>
  )
}
