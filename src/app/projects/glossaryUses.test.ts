import { describe, expect, it } from 'vitest'
import { hasForm } from './glossaryUses'

describe('finding a glossary form in a verse', () => {
  it('finds a form as words of its own, whatever its case', () => {
    expect(hasForm('Y el Rey dijo:', 'rey')).toBe(true)
    expect(hasForm('waqyarqani, nirqa', 'waqyarqani')).toBe(true)
  })

  it('does not take a form inside a longer word', () => {
    expect(hasForm('los reyes dijeron', 'rey')).toBe(false)
  })

  it('finds a form of several words', () => {
    expect(hasForm('conforme a la mano de Jehová', 'conforme a la mano de')).toBe(true)
  })

  it('finds nothing for an empty form', () => {
    expect(hasForm('algo', '  ')).toBe(false)
  })
})
