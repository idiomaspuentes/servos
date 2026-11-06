import { describe, expect, it } from 'vitest'
import type { Event, Piece, TextModel } from '@bt-synergy/language-pack-v3'
import type { PackReader } from '@bt-synergy/language-pack-client'
import { readBookV3, textChapters } from './bookV3'

/** A text from USFM-like steps: `['open', 'para:p']`, `['verse', '1']`, `['word', 'Pablo', [0]]`, `' '`, `['close']`. */
function text(steps: Array<string | [kind: 'open' | 'close' | 'chapter' | 'verse', arg?: string] | [kind: 'word', text: string, align: number[]]>): TextModel {
  const pieces: Piece[] = []
  const events: Event[] = []
  const align: number[][] = []
  for (const step of steps) {
    if (typeof step === 'string') pieces.push([step, false])
    else if (step[0] === 'word') {
      pieces.push([step[1], true])
      align.push(step[2])
    } else events.push([pieces.length, step[0], step[1] ?? ''])
  }
  return { res: 'es-419_gl/es-419/glt', pieces, events, align }
}

describe('a format 3 text read as the prepared chapters are', () => {
  it('a verse range "1-2" counts as verse 1', () => {
    const chapter = textChapters(
      text([['chapter', '1'], ['open', 'para:p'], ['verse', '1-2'], ['word', 'Pablo', [0]], ', ', ['word', 'siervo', [1]], ['verse', '3'], ['word', 'pero', [2]], '.', ['close']])
    ).read(1)!
    expect(chapter.pieces).toEqual([{ kind: 'paragraph', verses: [{ verse: 1, text: 'Pablo, siervo' }, { verse: 3, text: 'pero.' }] }])
    expect(chapter.words.map((w) => [w.verse, w.text, w.originals])).toEqual([
      [1, 'Pablo', [0]],
      [1, 'siervo', [1]],
      [3, 'pero', [2]],
    ])
  })

  it('a heading before verse 1 is a heading piece', () => {
    const chapter = textChapters(
      text([['chapter', '1'], ['open', 'para:s1'], 'Saludo', ['close'], ['open', 'para:p'], ['verse', '1'], ['word', 'Pablo', [0]], ['close']])
    ).read(1)!
    expect(chapter.pieces).toEqual([{ kind: 'heading', text: 'Saludo' }, { kind: 'paragraph', verses: [{ verse: 1, text: 'Pablo' }] }])
    expect(chapter.lines[1]).toEqual([{ marker: 'p', pieces: [{ text: 'Pablo', word: 0 }] }])
  })

  it('numbers the words through the chapter, from 0 in each, and leaves the front matter out', () => {
    const chapters = textChapters(
      text([
        ['open', 'para:mt'], 'Tito', ['close'],
        ['chapter', '1'], ['open', 'para:p'], ['verse', '1'], ['word', 'a', [0]], ' ', ['word', 'b', [1]], ['close'],
        ['chapter', '2'], ['open', 'para:p'], ['verse', '1'], ['word', 'c', [2]], ['close'],
      ])
    )
    expect(chapters.numbers).toEqual([1, 2])
    expect(chapters.read(1)!.pieces).toEqual([{ kind: 'paragraph', verses: [{ verse: 1, text: 'a b' }] }])
    expect(chapters.read(2)!.words).toEqual([{ word: 2, verse: 1, text: 'c', originals: [2] }])
    expect(chapters.read(2)!.lines[1][0].pieces).toEqual([{ text: 'c', word: 0 }])
  })

  it('keeps a footnote out of the verse and gives its text to the word before it', () => {
    const chapter = textChapters(
      text([['chapter', '1'], ['open', 'para:p'], ['verse', '1'], ['word', 'Pablo', [0]], ['open', 'note:f'], ['open', 'char:ft'], 'O Saulo', ['close'], ['close'], '.', ['close']])
    ).read(1)!
    expect(chapter.pieces).toEqual([{ kind: 'paragraph', verses: [{ verse: 1, text: 'Pablo.' }] }])
    expect(chapter.notes).toEqual({ 0: 'O Saulo' })
  })

  it('reads no book that is not installed', async () => {
    const reader = { installed: () => false } as unknown as PackReader
    expect(await readBookV3(reader, 'es-419', 'tit')).toBeNull()
  })
})
