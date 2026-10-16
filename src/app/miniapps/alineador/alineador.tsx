/**
 * Aligning the translation with a source, as Taller aligns (its boxes, and usfm-ast's box model under them) and as
 * translationCore 4 does: one box for each word of the source, and the words of the draft in a bank above them. A
 * touch takes a word of the draft (or several), a touch on a box puts them there; or a word is dragged there, out of the
 * bank or from another box, and back to the bank to take it out (× does too). Boxes are joined when several words of
 * the source say together what the draft says in one (or the other way round), choosing them or dragging one onto
 * another, and separated again. The draft can be corrected on the way, in the editor, and back here. The source is the literal bridge text by default, or the simple one, or the original; each keeps its own
 * alignment. For the original, under each word, the words of the TPL that translate it, for whoever does not read
 * Hebrew or Greek.
 *
 * Wired, the alignment is written into the book's USFM as `\zaln`, as Taller does; here it is kept in this browser.
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
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
import { joinedVerses, textOf } from '../../projects/work'
import type { MiniApp, MiniAppCenterProps, Position } from '../contract'

const verseTextOf = (book: string, chapter: number, verse: number) => textOf(book, chapter, verse).replace(/\n/g, ' ')
/** The verses aligned together where the person is: the verse, or the verses joined with it (kept on the first). */
const unitOf = (at: Position) => joinedVerses(at.book, at.chapter, at.verse)
const sidOf = (at: Position) => {
  const unit = unitOf(at)
  return `${at.book.toUpperCase()} ${at.chapter}:${unit.length > 1 ? `${unit[0]}-${unit[unit.length - 1]}` : unit[0]}`
}

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

/** Each verse's undo and redo for each source, kept while the app is open: changing source, or going to the editor and
 * back, does not lose them. A verse whose text changed starts anew: its old links are for words no longer there. */
type History = { past: AlignmentGroup[][]; future: AlignmentGroup[][] }
const histories = new Map<string, History>()
const NONE: History = { past: [], future: [] }

/** What a finger or a mouse carries: words of the bank, a word out of a box, or a box to join to another. */
type Carried = { type: 'word'; indices: number[] } | { type: 'chip'; boxId: string; transIndex: number } | { type: 'box'; boxId: string }

const BANK = 'bank'

function Center({ context }: MiniAppCenterProps) {
  const { t, data, position, person, frame } = context
  const book = position.book
  const [sourceId, setSourceId] = useState(() => readSource(book))
  const source = data.texts.find((x) => x.abbreviation === sourceId) ?? data.texts[0]
  const text = verseTextOf(book, position.chapter, position.verse)
  const sid = sidOf(position)
  const unit = unitOf(position)
  const verse = unit[0]
  const draft = useMemo(() => draftTokens(text, sid), [text, sid])
  const { tokens: original, places } = useMemo(() => sourceWords(source, unit, sid), [source, sid]) // eslint-disable-line react-hooks/exhaustive-deps
  const historyKey = `${book}.${position.chapter}.${verse}.${source.abbreviation}.${text}`

  const [groups, setGroups] = useState<AlignmentGroup[]>([])
  const [history, setHistoryState] = useState<History>(NONE)
  const setHistory = (h: History) => {
    histories.set(historyKey, h)
    setHistoryState(h)
  }
  const [words, setWords] = useState<number[]>([])
  const [picked, setPicked] = useState<string[]>([])
  const [carrying, setCarrying] = useState<string | null>(null)
  // A new verse, or another source: its links as kept, following the words of the draft that stayed, and its history.
  useEffect(() => {
    setGroups(alignmentFor(readAlignment(book, position.chapter, verse, source.abbreviation), text))
    setHistoryState(histories.get(historyKey) ?? NONE)
    setWords([])
    setPicked([])
  }, [book, position.chapter, verse, source.abbreviation, text, historyKey])

  const boxes = useMemo(() => deriveAlignmentBoxes(original, groups, draft), [original, groups, draft])
  const aligned = useMemo(() => computeAlignedSourceIndices(draft, boxes), [draft, boxes])
  const left = aligned.filter((a) => !a).length

  const keep = (next: AlignmentGroup[]) => {
    setGroups(next)
    writeAlignment(book, position.chapter, verse, source.abbreviation, { groups: next, text, by: person.name, at: new Date().toISOString() })
    frame.setSaved('guardado')
  }
  const change = (next: AlignmentGroup[] | null) => {
    if (!next) return
    setHistory({ past: [...history.past.slice(-49), groups], future: [] })
    keep(next)
    setWords([])
    setPicked([])
  }
  const undo = () => {
    const back = history.past[history.past.length - 1]
    if (!back) return
    setHistory({ past: history.past.slice(0, -1), future: [groups, ...history.future] })
    keep(back)
  }
  const redo = () => {
    const ahead = history.future[0]
    if (!ahead) return
    setHistory({ past: [...history.past, groups], future: history.future.slice(1) })
    keep(ahead)
  }

  const put = (boxId: string, indices: number[]) => indices.length && change(addSourcesToBox(original, draft, groups, boxId, indices))
  const tapWord = (i: number) => {
    setPicked([])
    setWords((now) => (now.includes(i) ? now.filter((x) => x !== i) : [...now, i]))
  }
  const tapBox = (box: AlignmentBoxModel) => {
    if (words.length) return put(box.id, words)
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

  // Dragging, as Taller does: a mouse moves a little first, a finger rests a moment (a quick touch is still a touch,
  // and a finger that moves at once still scrolls).
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } })
  )
  const onDragStart = (e: DragStartEvent) => {
    const from = e.active.data.current as Carried | undefined
    if (from?.type === 'word') setCarrying(from.indices.map((i) => draft[i]?.surface).join(' '))
    else if (from?.type === 'chip') setCarrying(draft[from.transIndex]?.surface ?? null)
    else if (from?.type === 'box') setCarrying(boxes.find((b) => b.id === from.boxId)?.targetTokens.map((x) => x.surface).join(' ') ?? null)
  }
  const onDragEnd = (e: DragEndEvent) => {
    setCarrying(null)
    const from = e.active.data.current as Carried | undefined
    const over = e.over ? String(e.over.id) : null
    if (!from || !over) return
    const toBox = over.startsWith('box-') ? over.slice(4) : null
    if (from.type === 'word' && toBox) put(toBox, from.indices)
    else if (from.type === 'chip' && toBox && toBox !== from.boxId) put(toBox, [from.transIndex])
    else if (from.type === 'chip' && over === BANK) change(removeSourcesFromBox(original, draft, groups, from.boxId, [from.transIndex]))
    else if (from.type === 'box' && toBox && toBox !== from.boxId) change(mergeAlignmentBoxes(original, draft, groups, [toBox, from.boxId], toBox))
  }

  // For the original, under each word the words of the TPL that translate it: what it says, for whoever does not
  // read Hebrew or Greek.
  const bridge = data.texts.find((x) => x.abbreviation === 'TPL')
  const glossOf = (index: number) => {
    if (!source.original || !bridge) return ''
    return (placesOfOriginals(data, [places[index]]).TPL ?? []).map((p) => wordAt(bridge, p)).join(' ')
  }
  const editDraft = () => frame.open('editor', position)

  if (!draft.length) {
    return (
      <div className="align">
        <div className="align-empty">
          <p className="notice">{t('alineador.sinTraducir')}</p>
          <button type="button" className="button-primary" onClick={editDraft}>
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
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setCarrying(null)}>
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

        <div className="align-bank-head">
          <span className="quiet">{t('alineador.suTraduccion')}</span>
          <button type="button" className="chip" onClick={editDraft}>
            ✎ {t('alineador.corregirBorrador')}
          </button>
        </div>
        <Bank label={t('alineador.suTraduccion')}>
          {draft.map((tok, i) => (
            <BankWord key={i} index={i} surface={tok.surface} aligned={aligned[i]} selected={words.includes(i)} carries={words.includes(i) ? words : [i]} onTap={tapWord} />
          ))}
        </Bank>
        <p className="align-hint" aria-live="polite">
          {hint}
        </p>

        <div className="align-boxes" dir={source.dir ?? 'ltr'} lang={source.lang}>
          {boxes.map((box) => (
            <Box
              key={box.id}
              box={box}
              draft={draft}
              original={source.original === true}
              compact={box.alignedSourceWords.length === 0 && !words.length && !carrying}
              selected={picked.includes(box.id)}
              placing={words.length > 0}
              glossOf={glossOf}
              glossLang={bridge?.lang}
              removeLabel={(w) => t('alineador.quitar', { palabra: w })}
              onTap={tapBox}
              onRemove={(at) => change(removeSourcesFromBox(original, draft, groups, box.id, [at]))}
            />
          ))}
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
              <button type="button" className="chip" onClick={() => setPicked([])}>
                ✕ {t('alineador.cancelar')}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="chip" disabled={!history.past.length} onClick={undo}>
                ↶ {t('alineador.deshacer')}
              </button>
              <button type="button" className="chip" disabled={!history.future.length} onClick={redo}>
                {t('alineador.rehacer')} ↷
              </button>
            </>
          )}
        </div>
      </div>
      <DragOverlay>{carrying ? <span className="al-word al-word--ghost">{carrying}</span> : null}</DragOverlay>
    </DndContext>
  )
}

/** The bank: where a word taken out of a box can be dropped back. */
function Bank({ label, children }: { label: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: BANK })
  return (
    <section ref={setNodeRef} className="align-bank" data-over={isOver || undefined} aria-label={label}>
      {children}
    </section>
  )
}

/** A word of the draft in the bank: a touch takes it, a drag carries it (with the others taken) to a box. */
function BankWord({
  index,
  surface,
  aligned,
  selected,
  carries,
  onTap,
}: {
  index: number
  surface: string
  aligned: boolean
  selected: boolean
  carries: number[]
  onTap(index: number): void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `word-${index}`, data: { type: 'word', indices: carries } satisfies Carried })
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      type="button"
      className="al-word"
      data-aligned={aligned || undefined}
      data-selected={selected || undefined}
      data-dragging={isDragging || undefined}
      aria-pressed={selected}
      onClick={() => onTap(index)}
    >
      {surface}
    </button>
  )
}

/** A box: the source's word (or words, joined) on top, dragged by it onto another box to join them; the draft's below. */
function Box({
  box,
  draft,
  original,
  compact,
  selected,
  placing,
  glossOf,
  glossLang,
  removeLabel,
  onTap,
  onRemove,
}: {
  box: AlignmentBoxModel
  draft: ReturnType<typeof draftTokens>
  original: boolean
  compact: boolean
  selected: boolean
  placing: boolean
  glossOf(index: number): string
  glossLang?: string
  removeLabel(word: string): string
  onTap(box: AlignmentBoxModel): void
  onRemove(transIndex: number): void
}) {
  const drop = useDroppable({ id: `box-${box.id}` })
  const drag = useDraggable({ id: `boxdrag-${box.id}`, data: { type: 'box', boxId: box.id } satisfies Carried })
  const placed = box.alignedSourceWords
  return (
    <div
      ref={drop.setNodeRef}
      role="button"
      tabIndex={0}
      className="al-box"
      data-original={original || undefined}
      data-compact={compact || undefined}
      data-merged={box.targetTokens.length > 1 || undefined}
      data-selected={selected || undefined}
      data-placing={placing || undefined}
      data-over={drop.isOver || undefined}
      data-dragging={drag.isDragging || undefined}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-no-box]')) return
        onTap(box)
      }}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onTap(box)}
    >
      <div ref={drag.setNodeRef} {...drag.listeners} {...drag.attributes} role={undefined} tabIndex={undefined} className="al-box__head">
        {box.targetTokens.map((tok, k) => {
          const index = box.targetTokenIndices[k] ?? 0
          const gloss = glossOf(index)
          return (
            <span key={index} className="al-ref">
              <span className="al-ref__word">{tok.surface}</span>
              {gloss && (
                <span className="al-ref__gloss" dir="ltr" lang={glossLang}>
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
              return at !== null ? (
                <Chip key={`${aw.word}-${aw.occurrence}`} boxId={box.id} transIndex={at} surface={draft[at].surface} removeLabel={removeLabel(draft[at].surface)} onRemove={() => onRemove(at)} />
              ) : (
                <span key={`${aw.word}-${aw.occurrence}`} className="al-chip">
                  <span className="al-chip__word">{aw.word}</span>
                </span>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

/** A word of the draft in a box: dragged to another box, or back to the bank; × takes it out. */
function Chip({ boxId, transIndex, surface, removeLabel, onRemove }: { boxId: string; transIndex: number; surface: string; removeLabel: string; onRemove(): void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `chip-${boxId}-${transIndex}`, data: { type: 'chip', boxId, transIndex } satisfies Carried })
  return (
    <span className="al-chip" data-dragging={isDragging || undefined} data-no-box>
      <span ref={setNodeRef} {...listeners} {...attributes} className="al-chip__word">
        {surface}
      </span>
      <button type="button" className="al-chip__x" data-no-box aria-label={removeLabel} onClick={onRemove}>
        ×
      </button>
    </span>
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
    const unit = unitOf(at)
    const { tokens } = sourceWords(source, unit, sidOf(at))
    const groups = alignmentFor(readAlignment(at.book, at.chapter, unit[0], source.abbreviation), text)
    return computeAlignedSourceIndices(draft, deriveAlignmentBoxes(tokens, groups, draft)).every(Boolean)
  },
  Center,
  primary: { nextOnly: true, label: 'alineador.seguir', returning: 'alineador.guardarVolver', run: (c) => c.frame.next() },
  texts: {
    es: {
      nombre: 'Alinear la traducción',
      descripcion: 'Unir cada palabra de su traducción con la palabra del texto fuente que traduce',
      revisa: 'Alineación',
      fuente: 'Alinear con',
      quedan: 'Quedan {n}',
      listo: 'Todo alineado',
      suTraduccion: 'Su traducción',
      comoSeHace: 'Toque una palabra (o varias) y luego su caja, o mantenga el dedo y arrástrela a la caja.',
      tocarCaja: 'Ahora toque la caja de la palabra que traduce.',
      cajasElegidas: 'Cajas elegidas: {n}. Puede unirlas, separarlas o vaciarlas.',
      todoAlineado: 'Todas las palabras de este versículo están en su caja.',
      quitar: 'Quitar «{palabra}» de esta caja',
      unir: 'Unir cajas',
      separar: 'Separar',
      vaciar: 'Vaciar',
      cancelar: 'Cancelar',
      corregirBorrador: 'Corregir el borrador',
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
      comoSeHace: 'Toque uma palavra (ou várias) e depois sua caixa, ou mantenha o dedo e arraste-a até a caixa.',
      tocarCaja: 'Agora toque a caixa da palavra que ela traduz.',
      cajasElegidas: 'Caixas escolhidas: {n}. Pode juntá-las, separá-las ou esvaziá-las.',
      todoAlineado: 'Todas as palavras deste versículo estão na sua caixa.',
      quitar: 'Tirar «{palabra}» desta caixa',
      unir: 'Juntar caixas',
      separar: 'Separar',
      vaciar: 'Esvaziar',
      cancelar: 'Cancelar',
      corregirBorrador: 'Corrigir o rascunho',
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
      comoSeHace: 'Touch a word (or several), then its box, or hold your finger on it and drag it to the box.',
      tocarCaja: 'Now touch the box of the word it translates.',
      cajasElegidas: 'Boxes chosen: {n}. You can join, separate or empty them.',
      todoAlineado: 'Every word of this verse is in its box.',
      quitar: 'Take «{palabra}» out of this box',
      unir: 'Join boxes',
      separar: 'Separate',
      vaciar: 'Empty',
      cancelar: 'Cancel',
      corregirBorrador: 'Correct the draft',
      deshacer: 'Undo',
      rehacer: 'Redo',
      seguir: 'Next verse',
      guardarVolver: 'Go back',
      sinTraducir: 'This verse is not translated yet.',
      traducirAhora: 'Translate it now',
    },
  },
}
