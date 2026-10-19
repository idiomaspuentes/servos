/**
 * What there is to know of a word of the original, as Taller's word card shows it: its lemma, its grammar in plain
 * words, its Strong number, and whom it points to (what a pronoun stands for; for a verb, who does it and to whom).
 */

import type { PrototypeData } from '../../prototype/data'
import { lexiconOf } from '../../prototype/data'
import { referentFileOf } from '../../prototype/original'
import { glossOfWord, strongCode, strongParts } from '../../lexicon/lexicon'
import { describeMorph, type MorphLabel } from '../../original/morphology'
import { REFERENT_ORDER, referentKey, referentsOf, type ReferentKind, type ReferentTarget } from '../../original/referents'
import { useT } from '../i18n/i18n'

/** The places of the words of the original in a verse, in order: a word of a verse is its place in this list, from 1. */
export function wordsOfVerse(data: PrototypeData, verse: number): number[] {
  const original = data.texts.find((x) => x.original)
  return (original?.lines[verse] ?? []).flatMap((l) => l.pieces.map((p) => p.word).filter((w): w is number => w !== undefined))
}

/**
 * The place of the word MACULA numbers `word` in a verse, which counts the words of notes too (the Hebrew's qere): a
 * qere, not shown, is read on the ketiv shown before it. Undefined when the verse has no such word.
 */
export function maculaPlace(data: PrototypeData, verse: number, word: number): number | undefined {
  const shown = wordsOfVerse(data, verse)
  const noted = new Set(data.texts.find((x) => x.original)?.inNotes?.[verse] ?? [])
  let at = -1
  for (let n = 1; n <= word; n++) if (!noted.has(n)) at++
  return at < 0 ? undefined : shown[at]
}

/** How many words MACULA counts in a verse: those shown and those of its notes. */
export const maculaCount = (data: PrototypeData, verse: number): number =>
  wordsOfVerse(data, verse).length + (data.texts.find((x) => x.original)?.inNotes?.[verse]?.length ?? 0)

/** The text of a word of the original, at its place. */
export function originalText(data: PrototypeData, place: number): string {
  const original = data.texts.find((x) => x.original)
  for (const lines of Object.values(original?.lines ?? {})) for (const l of lines) for (const p of l.pieces) if (p.word === place) return p.text
  return ''
}

export function OriginalFacts({ data, place }: { data: PrototypeData; place: number }) {
  const t = useT()
  const original = data.texts.find((x) => x.original)
  const word = original?.words?.[place]
  if (!word) return null
  const say = (labels: MorphLabel[]) => labels.map((label) => ('key' in label ? t(`mo.${label.key}`) : label.text)).join(', ')
  const morph = describeMorph(word.morph).map(say).filter(Boolean)
  return (
    <dl className="word-facts">
      <div>
        <dt>{t('lx.lemma')}</dt>
        <dd>
          <bdi className="word-facts-original" lang={original?.lang} dir={original?.dir}>
            {word.lemma}
          </bdi>
        </dd>
      </div>
      {morph.length > 0 && (
        <div>
          <dt>{t('lx.morph')}</dt>
          <dd>{morph.join(' + ')}</dd>
        </div>
      )}
      <div>
        <dt>{t('lx.strong')}</dt>
        <dd>{strongParts(word.strong).map(strongCode).join(' · ')}</dd>
      </div>
    </dl>
  )
}

const ASK: Record<ReferentKind, string> = {
  causer: 'lx.causer',
  agent: 'lx.agent',
  subject: 'lx.subject',
  patient: 'lx.patient',
  other: 'lx.otherPart',
  refers: 'lx.refers',
}

/** Whom a word points to, grouped by the question asked of it, in Taller's order; nothing for a word that points to none. */
function referentGroups(data: PrototypeData, verse: number, place: number): ReferentTarget[][] {
  const surface = originalText(data, place)
  // Which of its kind in the verse it is counts only when the verse writes it more than once: the file marks a word
  // written once with no number (0).
  const same = wordsOfVerse(data, verse).filter((p) => referentKey(originalText(data, p)) === referentKey(surface))
  const occurrence = same.length > 1 ? same.indexOf(place) + 1 : undefined
  const targets = referentsOf(referentFileOf(data.book.id), { chapter: data.chapter, verse }, surface, occurrence)
  const groups = new Map<string, ReferentTarget[]>()
  for (const target of targets) groups.set(`${target.kind}|${target.piece ?? ''}`, [...(groups.get(`${target.kind}|${target.piece ?? ''}`) ?? []), target])
  return [...groups.values()].sort((a, b) => REFERENT_ORDER.indexOf(a[0].kind) - REFERENT_ORDER.indexOf(b[0].kind))
}

/** Whether the word points to another: its credit is then owed where it is shown. */
export const hasReferents = (data: PrototypeData, verse: number, place: number): boolean => referentGroups(data, verse, place).length > 0

/**
 * Whom the word points to, under the questions Taller asks: who makes it happen, who does it, to whom, what a
 * pronoun stands for. Nothing for a word that points to no other. A verse that writes the same word twice is told
 * apart by which of them was touched. Its credit is said by whoever shows it (`credit`), once with the lexicon's.
 */
export function Referents({ data, verse, place, credit = true }: { data: PrototypeData; verse: number; place: number; credit?: boolean }) {
  const t = useT()
  const original = data.texts.find((x) => x.original)
  const ordered = referentGroups(data, verse, place)
  if (!ordered.length) return null
  const gloss = (target: ReferentTarget) => {
    const found = lexiconOf(target.strong)
    const at = { book: data.book.id.toUpperCase(), chapter: target.chapter || data.chapter, verse: target.verse || verse }
    return found ? glossOfWord(found.file, at, found.letter) : ''
  }
  return (
    <section className="word-referents">
      {ordered.map((group) => {
        const first = group[0]
        return (
          <div key={`${first.kind}|${first.piece ?? ''}`}>
            <p className="word-referents-ask">{first.kind === 'refers' && first.piece ? t('lx.refersPiece', { piece: first.piece }) : t(ASK[first.kind])}</p>
            <ul>
              {group.map((target, i) => (
                <li key={i}>
                  <bdi className="word-referents-text" lang={original?.lang} dir={original?.dir}>
                    {target.text}
                  </bdi>
                  {gloss(target) && <span className="quiet"> · {gloss(target)}</span>}
                  {target.chapter > 0 && (target.chapter !== data.chapter || target.verse !== verse) && (
                    <span className="quiet"> · {`${target.chapter}:${target.verse}`}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
      {credit && <p className="quiet lexicon-credit">{t('lx.refCredit')}</p>}
    </section>
  )
}
