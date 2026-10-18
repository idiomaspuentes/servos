import { describe, expect, it } from 'vitest'
import { addPerson } from './people'

describe('the people who use a phone', () => {
  it('starts with the first name written, working', () => {
    expect(addPerson(null, '  María  José ')).toEqual({ names: ['María José'], current: 'María José' })
  })

  it('adds another person and makes them the one working', () => {
    expect(addPerson({ names: ['Ana'], current: 'Ana' }, 'Tito')).toEqual({ names: ['Ana', 'Tito'], current: 'Tito' })
  })

  it('does not add the same name twice, whatever its capitals', () => {
    expect(addPerson({ names: ['Ana', 'Tito'], current: 'Tito' }, 'ana')).toEqual({ names: ['Ana', 'Tito'], current: 'Ana' })
  })
})
