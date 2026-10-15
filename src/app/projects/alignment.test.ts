import { describe, expect, it } from 'vitest'
import { addSourcesToBox, computeAlignedSourceIndices, deriveAlignmentBoxes } from '@usfm-ast/alignment-box-model'
import type { PrototypeText } from '../../prototype/data'
import { alignmentFor, draftTokens, sourceWords } from './alignment'

const tpl = {
  abbreviation: 'TPL',
  lines: { 1: [{ marker: 'p', pieces: [{ text: 'Y', word: 10 }, { text: ' ' }, { text: 'Jehová', word: 11 }, { text: ' ' }, { text: 'habló,', word: 12 }, { text: ' ' }, { text: 'y', word: 13 }] }] },
} as unknown as PrototypeText

describe('alinear la traducción', () => {
  it('las palabras de la fuente, con su lugar en el capítulo y su ocurrencia sin la puntuación', () => {
    const { tokens, places } = sourceWords(tpl, 1, 'JON 1:1')
    expect(tokens.map((t) => [t.surface, t.occurrence, t.occurrences])).toEqual([
      ['Y', 1, 1],
      ['Jehová', 1, 1],
      ['habló,', 1, 1],
      ['y', 1, 1],
    ])
    expect(places).toEqual([10, 11, 12, 13])
  })

  it('una palabra del borrador puesta en la caja de una de la fuente queda alineada; las otras no', () => {
    const source = sourceWords(tpl, 1, 'JON 1:1').tokens
    const draft = draftTokens('Taytaku rimarqa', 'JON 1:1')
    const boxes = deriveAlignmentBoxes(source, [], draft)
    const groups = addSourcesToBox(source, draft, [], boxes[1].id, [0])
    expect(computeAlignedSourceIndices(draft, deriveAlignmentBoxes(source, groups, draft))).toEqual([true, false])
  })

  it('los enlaces siguen a las palabras que quedan cuando cambia el texto', () => {
    const source = sourceWords(tpl, 1, 'JON 1:1').tokens
    const draft = draftTokens('Taytaku rimarqa', 'JON 1:1')
    const groups = addSourcesToBox(source, draft, [], deriveAlignmentBoxes(source, [], draft)[1].id, [0])
    const after = alignmentFor({ groups, text: 'Taytaku rimarqa' }, 'Chaymanta Taytaku rimarqa')
    const now = draftTokens('Chaymanta Taytaku rimarqa', 'JON 1:1')
    expect(computeAlignedSourceIndices(now, deriveAlignmentBoxes(source, after, now))).toEqual([false, true, false])
  })
})
