import { describe, expect, it } from 'vitest'
import type { PrototypeData } from '../../prototype/data'
import type { T } from '../i18n/i18n'
import { BOOK_INTRO, BOOK_ISSUES, CHAPTER_INTRO } from '../miniapps/contract'
import { placeLabel } from '../projects/progress'
import { passageOf, stopLabel, stopsOf } from './PlacePicker'

const t = ((key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key)) as T

const chapter = (extra: Partial<PrototypeData>) =>
  ({ sections: [], verses: [1, 2].map((verse) => ({ verse, notes: [], questions: [], words: [] })), ...extra }) as unknown as PrototypeData

describe('the stop for the book’s issues', () => {
  const first = chapter({ bookIntro: '# Rut', intro: '# Rut 1' })

  it('comes right after the book’s introduction when the book has issues', () => {
    expect(stopsOf(first, 'verse', true, true)).toEqual([[BOOK_INTRO], [BOOK_ISSUES], [CHAPTER_INTRO], [1], [2]])
  })

  it('is not there when the book has none', () => {
    expect(stopsOf(first, 'verse', true, false)).toEqual([[BOOK_INTRO], [CHAPTER_INTRO], [1], [2]])
  })

  it('opens the book when it has no introduction', () => {
    expect(stopsOf(chapter({ intro: '# Rut 1' }), 'verse', true, true)).toEqual([[BOOK_ISSUES], [CHAPTER_INTRO], [1], [2]])
  })

  it('is not there for a mini app without introductions', () => {
    expect(stopsOf(first, 'verse', false, true)).toEqual([[1], [2]])
  })

  it('is named in the list, the position line and «Siga donde quedó»', () => {
    expect(stopLabel([BOOK_ISSUES], t)).toBe('marco.loDificilCorta')
    expect(passageOf('Rut', 1, [BOOK_ISSUES], t)).toBe('Rut · marco.loDificil')
    expect(placeLabel(t, 'Rut', { chapter: 1, verse: BOOK_ISSUES })).toBe('libro.loDificil {"libro":"Rut"}')
  })
})
