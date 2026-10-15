/**
 * Aligning the translation with a source, as Taller aligns (its boxes, and usfm-ast's box model under them) and as
 * translationCore 4 does: one box for each word of the source, and the words of the draft in a bank above them. A
 * touch takes a word of the draft (or several), a touch on a box puts them there; × takes one out. Boxes are joined
 * when several words of the source say together what the draft says in one (or the other way round), and separated
 * again. The source is the literal bridge text by default, or the simple one, or the original; each keeps its own
 * alignment. For the original, under each word, the words of the TPL that translate it, for whoever does not read
 * Hebrew or Greek.
 *
 * Wired, the alignment is written into the book's USFM as `\zaln`, as Taller does; here it is kept in this browser.
 */

import { useEffect, useMemo, useState } from 'react'
import {
  addSourcesToBox,
  computeAlignedSourceIndices,
  deriveAlignmentBoxes,
  mergeAlignmentBoxes,
  orderedAlignedTransIndices,
  removeSourcesFromBox,
  splitAlignmentGroupPure,
  transIndexForAlignedWord,
  type AlignmentBoxModel,
} from '@usfm-ast/alignment-box-model'
import type { AlignmentGroup } from '@usfm-tools/types'
import { chapterOf } from '../../../prototype/data'
import { placesOfOriginals, wordAt } from '../../frame/TouchWords'
import { alignmentFor, draftTokens, readAlignment, sourceWords, writeAlignment } from '../../projects/alignment'
import { readDraft } from '../../projects/work'
import type { MiniApp, MiniAppCenterProps, Position } from '../contract'

const verseTextOf = (book: string, chapter: number, verse: number) => readDraft(book, chapter, verse).replace(/\n/g, ' ')
const sidOf = (at: Position) => `${at.book.toUpperCase()} ${at.chapter}:${at.verse}`

/** The source chosen for a book, kept for the next visit: the TPL until another is chosen. */
const sourceKey = (book: string) => `servos.prototipo.alineacion.fuente.${book}`
function readSource(book: string): string {
  try {
    return localStorage.getItem(sourceKey(book)) ?? 'TPL'
  } catch {
    return 'TPL'
  }
}
function keepSource(book: string, source: string) {
  try {
    localStorage.setItem(sourceKey(book), source)
  } catch {
    /* for this visit */
  }
}

function Center({ context }: MiniAppCenterProps) {
  const { t, data, position, person, frame } = context
  const book = position.book
  const [sourceId, setSourceId] = useState(() => readSource(book))
  const source = data.texts.find((x) => x.abbreviation === sourceId) ?? data.texts[0]
  const text = verseTextOf(book, position.chapter, position.verse)
  const sid = sidOf(position)
  const draft = useMemo(() => draftTokens(text, sid), [text, sid])
  const { tokens: original, places } = useMemo(() => sourceWords(source, position.verse, sid), [source, position.verse, sid])

  const [groups, setGroups] = useState<AlignmentGroup[]>([])
  const [past, setPast] = useState<AlignmentGroup[][]>([])
  const [future, setFuture] = useState<AlignmentGroup[][]>([])
  const [words, setWords] = useState<number[]>([])
  const [picked, setPicked] = useState<string[]>([])
  // A new verse, or another source: its links as kept, following the words of the draft that stayed.
  useEffect(() => {
    setGroups(alignmentFor(readAlignment(book, position.chapter, position.verse, source.abbreviation), text))
    setPast([])
    setFuture([])
    setWords([])
    setPicked([])
  }, [book, position.chapter, position.verse, source.abbreviation, text])

  const boxes = useMemo(() => deriveAlignmentBoxes(original, groups, draft), [original, groups, draft])
  const aligned = useMemo(() => computeAlignedSourceIndices(draft, boxes), [draft, boxes])
  const left = aligned.filter((a) => !a).length

  const change = (next: AlignmentGroup[] | null) => {
    if (!next) return
    setPast((p) => [...p.slice(-49), groups])
    setFuture([])
    setGroups(next)
    setWords([])
    setPicked([])
    writeAlignment(book, position.chapter, position.verse, source.abbreviation, { groups: next, text, by: person.name, at: new Date().toISOString() })
    frame.setSaved('guardado')
  }
  const undo = () => {
    const back = past[past.length - 1]
    if (!back) return
    setFuture((f) => [groups, ...f])
    setPast((p) => p.slice(0, -1))
    setGroups(back)
    writeAlignment(book, position.chapter, position.verse, source.abbreviation, { groups: back, text, by: person.name, at: new Date().toISOString() })
  }
  const redo = () => {
    const ahead = future[0]
    if (!ahead) return
    setPast((p) => [...p, groups])
    setFuture((f) => f.slice(1))
    setGroups(ahead)
    writeAlignment(book, position.chapter, position.verse, source.abbreviation, { groups: ahead, text, by: person.name, at: new Date().toISOString() })
  }

  const tapWord = (i: number) => {
    setPicked([])
    setWords((now) => (now.includes(i) ? now.filter((x) => x !== i) : [...now, i]))
  }
  const tapBox = (box: AlignmentBoxModel) => {
    if (words.length) return change(addSourcesToBox(original, draft, groups, box.id, words))
    setPicked((now) => (now.includes(box.id) ? now.filter((x) => x !== box.id) : [...now, box.id]))
  }
  const pickedBoxes = boxes.filter((b) => picked.includes(b.id))
  const join = () => pickedBoxes.length > 1 && change(mergeAlignmentBoxes(original, draft, groups, picked, picked[0]))
  const separate = () => {
    const box = pickedBoxes[0]
    if (pickedBoxes.length === 1 && box.groupIndex !== null) change(splitAlignmentGroupPure(original, draft, groups, box.groupIndex))
  }
  const empty = () => {
    let next = groups
    for (const box of pickedBoxes) {
      const now = deriveAlignmentBoxes(original, next, draft).find((b) => b.targetTokenIndices.join() === box.targetTokenIndices.join())
      if (now) next = removeSourcesFromBox(original, draft, next, now.id, orderedAlignedTransIndices(now, draft))
    }
    change(next)
  }

  // For the original, under each word the words of the TPL that translate it: what it says, for whoever does not
  // read Hebrew or Greek.
  const bridge = data.texts.find((x) => x.abbreviation === 'TPL')
  const glossOf = (index: number) => {
    if (!source.original || !bridge) return ''
    return (placesOfOriginals(data, [places[index]]).TPL ?? []).map((p) => wordAt(bridge, p)).join(' ')
  }

  if (!draft.length) {
    return (
      <div className="align">
        <div className="align-empty">
          <p className="notice">{t('alineador.sinTraducir')}</p>
          <button type="button" className="button-primary" onClick={() => frame.open('editor', position)}>
            {t('alineador.traducirAhora')}
          </button>
        </div>
      </div>
    )
  }

  const hint = words.length
    ? t('alineador.tocarCaja', { n: words.length })
    : picked.length
      ? t('alineador.cajasElegidas', { n: picked.length })
      : left
        ? t('alineador.comoSeHace')
        : t('alineador.todoAlineado')
  const merged = pickedBoxes.length === 1 && pickedBoxes[0].targetTokens.length > 1

  return (
    <div className="align">
      <div className="align-top">
        <div className="review-quote-switch" role="radiogroup" aria-label={t('alineador.fuente')}>
          {data.texts.map((x) => (
            <button
              key={x.abbreviation}
              type="button"
              role="radio"
              aria-checked={x === source}
              onClick={() => {
                setSourceId(x.abbreviation)
                keepSource(book, x.abbreviation)
              }}
            >
              {x.original ? t(`estudio.lengua.${x.lang ?? 'original'}`) : x.abbreviation}
            </button>
          ))}
        </div>
        <span className={left ? 'align-left' : 'align-left is-done'}>{left ? t('alineador.quedan', { n: left }) : t('alineador.listo')}</span>
      </div>

      {/* The draft's words, the bank they are taken from: a word placed stays, marked, so the verse still reads. */}
      <section className="align-bank" aria-label={t('alineador.suTraduccion')}>
        {draft.map((tok, i) => (
          <button
            key={i}
            type="button"
            className="al-word"
            data-aligned={aligned[i] || undefined}
            data-selected={words.includes(i) || undefined}
            aria-pressed={words.includes(i)}
            onClick={() => tapWord(i)}
          >
            {tok.surface}
          </button>
        ))}
      </section>
      <p className="align-hint" aria-live="polite">
        {hint}
      </p>

      <div className="align-boxes" dir={source.dir ?? 'ltr'} lang={source.lang}>
        {boxes.map((box) => {
          const placed = box.alignedSourceWords
          const compact = placed.length === 0 && !words.length
          return (
            <div
              key={box.id}
              role="button"
              tabIndex={0}
              className="al-box"
              data-original={source.original || undefined}
              data-compact={compact || undefined}
              data-merged={box.targetTokens.length > 1 || undefined}
              data-selected={picked.includes(box.id) || undefined}
              data-placing={words.length > 0 || undefined}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-no-box]')) return
                tapBox(box)
              }}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && tapBox(box)}
            >
              <div className="al-box__head">
                {box.targetTokens.map((tok, k) => {
                  const index = box.targetTokenIndices[k] ?? 0
                  const gloss = glossOf(index)
                  return (
                    <span key={index} className="al-ref">
                      <span className="al-ref__word">{tok.surface}</span>
                      {gloss && (
                        <span className="al-ref__gloss" dir="ltr" lang={bridge?.lang}>
                          {gloss}
                        </span>
                      )}
                    </span>
                  )
                })}
                {compact && (
                  <span className="al-box__plus" aria-hidden>
                    +
                  </span>
                )}
              </div>
              {!compact && (
                <div className="al-box__body" dir="ltr">
                  {placed.length === 0 ? (
                    <span className="al-box__empty" aria-hidden>
                      +
                    </span>
                  ) : (
                    placed.map((aw) => {
                      const at = transIndexForAlignedWord(draft, aw)
                      return (
                        <span key={`${aw.word}-${aw.occurrence}`} className="al-chip">
                          <span className="al-chip__word">{at !== null ? draft[at].surface : aw.word}</span>
                          {at !== null && (
                            <button
                              type="button"
                              className="al-chip__x"
                              data-no-box
                              aria-label={t('alineador.quitar', { palabra: draft[at].surface })}
                              onClick={() => change(removeSourcesFromBox(original, draft, groups, box.id, [at]))}
                            >
                              ×
                            </button>
                          )}
                        </span>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="align-actions">
        {picked.length ? (
          <>
            {pickedBoxes.length > 1 && (
              <button type="button" className="button-secondary" onClick={join}>
                {t('alineador.unir')}
              </button>
            )}
            {merged && (
              <button type="button" className="button-secondary" onClick={separate}>
                {t('alineador.separar')}
              </button>
            )}
            {pickedBoxes.some((b) => b.alignedSourceWords.length > 0) && (
              <button type="button" className="button-secondary" onClick={empty}>
                {t('alineador.vaciar')}
              </button>
            )}
            <button type="button" className="button-quiet" onClick={() => setPicked([])}>
              {t('alineador.cancelar')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="button-quiet" disabled={!past.length} onClick={undo}>
              ↶ {t('alineador.deshacer')}
            </button>
            <button type="button" className="button-quiet" disabled={!future.length} onClick={redo}>
              {t('alineador.rehacer')} ↷
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export const alineador: MiniApp = {
  id: 'alineador',
  phase: 'revision',
  checks: 'alineador.revisa',
  needs: ['text'],
  unit: 'verse',
  helps: false,
  fills: true,
  writes: true,
  // A verse is aligned when every word of the draft is in a box of the source chosen for the book.
  done: (at) => {
    const data = chapterOf(at.book, at.chapter)
    const text = verseTextOf(at.book, at.chapter, at.verse)
    if (!data || !text.trim()) return false
    const source = data.texts.find((x) => x.abbreviation === readSource(at.book)) ?? data.texts[0]
    const draft = draftTokens(text, sidOf(at))
    const { tokens } = sourceWords(source, at.verse, sidOf(at))
    const groups = alignmentFor(readAlignment(at.book, at.chapter, at.verse, source.abbreviation), text)
    return computeAlignedSourceIndices(draft, deriveAlignmentBoxes(tokens, groups, draft)).every(Boolean)
  },
  Center,
  primary: { label: 'alineador.seguir', returning: 'alineador.guardarVolver', run: (c) => c.frame.next() },
  texts: {
    es: {
      nombre: 'Alinear la traducción',
      descripcion: 'Unir cada palabra de su traducción con la palabra del texto fuente que traduce',
      revisa: 'Alineación',
      fuente: 'Alinear con',
      quedan: 'Quedan {n}',
      listo: 'Todo alineado',
      suTraduccion: 'Su traducción',
      comoSeHace: 'Toque una palabra de su traducción (o varias) y luego la caja de la palabra que traduce.',
      tocarCaja: 'Ahora toque la caja de la palabra que traduce.',
      cajasElegidas: 'Cajas elegidas: {n}. Puede unirlas, separarlas o vaciarlas.',
      todoAlineado: 'Todas las palabras de este versículo están en su caja.',
      quitar: 'Quitar «{palabra}» de esta caja',
      unir: 'Unir cajas',
      separar: 'Separar',
      vaciar: 'Vaciar',
      cancelar: 'Cancelar',
      deshacer: 'Deshacer',
      rehacer: 'Rehacer',
      seguir: 'Siguiente versículo',
      guardarVolver: 'Volver',
      sinTraducir: 'Este versículo todavía no está traducido.',
      traducirAhora: 'Traducirlo ahora',
    },
    pt: {
      nombre: 'Alinhar a tradução',
      descripcion: 'Ligar cada palavra da sua tradução à palavra do texto fonte que ela traduz',
      revisa: 'Alinhamento',
      fuente: 'Alinhar com',
      quedan: 'Faltam {n}',
      listo: 'Tudo alinhado',
      suTraduccion: 'Sua tradução',
      comoSeHace: 'Toque uma palavra da sua tradução (ou várias) e depois a caixa da palavra que ela traduz.',
      tocarCaja: 'Agora toque a caixa da palavra que ela traduz.',
      cajasElegidas: 'Caixas escolhidas: {n}. Pode juntá-las, separá-las ou esvaziá-las.',
      todoAlineado: 'Todas as palavras deste versículo estão na sua caixa.',
      quitar: 'Tirar «{palabra}» desta caixa',
      unir: 'Juntar caixas',
      separar: 'Separar',
      vaciar: 'Esvaziar',
      cancelar: 'Cancelar',
      deshacer: 'Desfazer',
      rehacer: 'Refazer',
      seguir: 'Próximo versículo',
      guardarVolver: 'Voltar',
      sinTraducir: 'Este versículo ainda não está traduzido.',
      traducirAhora: 'Traduzir agora',
    },
    en: {
      nombre: 'Align the translation',
      descripcion: 'Link each word of your translation to the word of the source text it translates',
      revisa: 'Alignment',
      fuente: 'Align with',
      quedan: '{n} left',
      listo: 'All aligned',
      suTraduccion: 'Your translation',
      comoSeHace: 'Touch a word of your translation (or several), then the box of the word it translates.',
      tocarCaja: 'Now touch the box of the word it translates.',
      cajasElegidas: 'Boxes chosen: {n}. You can join, separate or empty them.',
      todoAlineado: 'Every word of this verse is in its box.',
      quitar: 'Take «{palabra}» out of this box',
      unir: 'Join boxes',
      separar: 'Separate',
      vaciar: 'Empty',
      cancelar: 'Cancel',
      deshacer: 'Undo',
      rehacer: 'Redo',
      seguir: 'Next verse',
      guardarVolver: 'Go back',
      sinTraducir: 'This verse is not translated yet.',
      traducirAhora: 'Translate it now',
    },
  },
}
