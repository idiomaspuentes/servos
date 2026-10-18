import { describe, expect, it } from 'vitest'
import { keyOf } from './keys'

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
