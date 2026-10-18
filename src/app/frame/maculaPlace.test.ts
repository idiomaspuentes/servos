import { describe, expect, it } from 'vitest'
import type { PrototypeData } from '../../prototype/data'
import { maculaCount, maculaPlace } from './OriginalWord'

// Ruth 1:8, shortened: the ketiv יעשה shown (place 11 of the chapter), its qere in a note, the words after it.
const shown = ['אמה', 'יעשה', 'יהוה', 'המתים', 'ועמדי']
const data = {
  texts: [
    {
      original: true,
      lines: { 8: [{ marker: 'p', pieces: shown.map((text, i) => ({ text, word: 10 + i })) }] },
      // MACULA's words: 1 אמה, 2 יעשה (ketiv), 3 יַעַשׂ (qere, in the note), 4 יהוה, 5 המתים, 6 ועמדי.
      inNotes: { 8: [3] },
    },
  ],
} as unknown as PrototypeData

describe('las palabras de MACULA sobre las que se ven', () => {
  it('cuenta también las palabras de las notas', () => {
    expect(maculaCount(data, 8)).toBe(6)
  })

  it('antes del qere, la misma; el qere, sobre su ketiv; después, una menos', () => {
    expect(maculaPlace(data, 8, 1)).toBe(10)
    expect(maculaPlace(data, 8, 2)).toBe(11)
    expect(maculaPlace(data, 8, 3)).toBe(11)
    expect(maculaPlace(data, 8, 4)).toBe(12)
    expect(maculaPlace(data, 8, 6)).toBe(14)
  })

  it('un versículo sin notas va palabra por palabra', () => {
    const plain = { texts: [{ ...data.texts[0], inNotes: undefined }] } as unknown as PrototypeData
    expect(maculaCount(plain, 8)).toBe(5)
    expect(maculaPlace(plain, 8, 3)).toBe(12)
    expect(maculaPlace(plain, 8, 7)).toBeUndefined()
  })
})
