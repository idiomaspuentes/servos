import { describe, expect, it } from 'vitest'
import { boxKeeps, keyOf, pressesPrimary } from './keys'

const press = (key: string, mods: Partial<Pick<KeyboardEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>> = {}) =>
  ({ key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, ...mods }) as KeyboardEvent

describe('the keys of every mini app', () => {
  it('reads Alt+↓ and Alt+↑ as next and previous, and nothing else with the arrows', () => {
    expect(keyOf(press('ArrowDown', { altKey: true }))).toBe('next')
    expect(keyOf(press('ArrowUp', { altKey: true }))).toBe('previous')
    expect(keyOf(press('ArrowDown'))).toBeNull()
    expect(keyOf(press('ArrowDown', { altKey: true, shiftKey: true }))).toBeNull()
    expect(keyOf(press('ArrowDown', { altKey: true, ctrlKey: true }))).toBeNull()
  })

  it('reads Ctrl (or ⌘) with Enter, Z and Y as the filled button, undo and redo', () => {
    expect(keyOf(press('Enter', { ctrlKey: true }))).toBe('primary')
    expect(keyOf(press('Enter', { metaKey: true }))).toBe('primary')
    expect(keyOf(press('Enter'))).toBeNull()
    expect(keyOf(press('z', { ctrlKey: true }))).toBe('undo')
    expect(keyOf(press('y', { ctrlKey: true }))).toBe('redo')
    expect(keyOf(press('Z', { ctrlKey: true, shiftKey: true }))).toBe('redo')
    expect(keyOf(press('z', { ctrlKey: true, altKey: true }))).toBeNull()
  })
})

// A pressed key's target: a box being written in (an editor's line or another box) or none.
const on = (where: 'line' | 'box' | 'page') => ({
  closest: (selector: string) =>
    where === 'page' ? null : selector.includes('.line-field') ? (where === 'line' ? {} : null) : selector.includes('textarea') ? {} : null,
})
const at = (where: 'line' | 'box' | 'page', e: KeyboardEvent) => ({ ...e, target: on(where) }) as unknown as KeyboardEvent

describe('a key and a box being written in', () => {
  it('moves on from the editor’s lines, kept as typed, but not from a box whose text is not saved yet', () => {
    const down = press('ArrowDown', { altKey: true })
    expect(boxKeeps('next', at('line', down))).toBe(false)
    expect(boxKeeps('next', at('page', down))).toBe(false)
    expect(boxKeeps('next', at('box', down))).toBe(true)
    expect(boxKeeps('previous', at('box', press('ArrowUp', { altKey: true })))).toBe(true)
  })

  it('leaves undo and redo to any box', () => {
    expect(boxKeeps('undo', at('line', press('z', { ctrlKey: true })))).toBe(true)
    expect(boxKeeps('redo', at('box', press('y', { ctrlKey: true })))).toBe(true)
    expect(boxKeeps('undo', at('page', press('z', { ctrlKey: true })))).toBe(false)
  })
})

describe('Ctrl+Enter and the filled button', () => {
  const ctrlEnter = (more: Partial<KeyboardEvent> = {}) => ({ ...press('Enter', { ctrlKey: true }), ...more }) as KeyboardEvent

  it('presses it once per press, not again while the keys are held', () => {
    expect(pressesPrimary(ctrlEnter())).toBe(true)
    expect(pressesPrimary(ctrlEnter({ repeat: true }))).toBe(false)
  })

  it('leaves it alone while a word is composed, or when what has the key already used it', () => {
    expect(pressesPrimary(ctrlEnter({ isComposing: true }))).toBe(false)
    expect(pressesPrimary(ctrlEnter({ defaultPrevented: true }))).toBe(false)
    expect(pressesPrimary(press('Enter'))).toBe(false)
  })
})
