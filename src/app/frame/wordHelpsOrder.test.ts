import { describe, expect, it } from 'vitest'
import { chapterOf } from '../../prototype/data'
import { helpsOfWord } from './TouchWords'

describe('las ayudas de una palabra tocada', () => {
  // Jonah 1:3 in the bundled example: the first «Jehová» has its own key word, and notes on «del rostro de Jehová».
  const data = chapterOf('jon', 1)!
  const tpl = data.texts.find((x) => x.abbreviation === 'TPL')!
  const place = (tpl.lines[3] ?? []).flatMap((l) => l.pieces).find((p) => p.text === 'Jehová')?.word

  it('empiezan por su palabra clave, y cada clase va de la más precisa a la más amplia', () => {
    expect(place).toBeDefined()
    const helps = helpsOfWord(data, 'TPL', place!).filter((h) => h.kind === 'palabra' || h.kind === 'nota')
    expect(helps[0].kind).toBe('palabra')
    expect(helps[0].places.TPL).toEqual([place])
    const kinds = helps.map((h) => h.kind)
    expect(kinds.lastIndexOf('palabra')).toBeLessThan(kinds.indexOf('nota'))
    for (const kind of ['palabra', 'nota']) {
      const spans = helps.filter((h) => h.kind === kind).map((h) => h.places.TPL?.length ?? 0)
      expect(spans).toEqual([...spans].sort((a, b) => a - b))
    }
  })

  it('si su única palabra clave abarca una frase, la nota sobre la palabra sola va primero (Jonás 1:1)', () => {
    const tpl1 = (tpl.lines[1] ?? []).flatMap((l) => l.pieces).find((p) => p.text === 'Jehová')?.word
    const helps = helpsOfWord(data, 'TPL', tpl1!).filter((h) => h.kind === 'palabra' || h.kind === 'nota')
    expect(helps[0].kind).toBe('nota')
    expect(helps[0].places.TPL).toEqual([tpl1])
    // «la palabra de Jehová»: the word list quotes דְּבַר־יְהוָה, both words.
    expect(helps.find((h) => h.kind === 'palabra')?.places.TPL?.length).toBeGreaterThan(1)
  })
})
