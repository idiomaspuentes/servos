import { describe, expect, it } from 'vitest'

import { hexOf, isLight } from './phone'

describe("the phone's bars over the app", () => {
  it('write dark on the light themes and light on the dark ones', () => {
    expect(isLight('rgb(247, 242, 232)')).toBe(true) // paper
    expect(isLight('rgb(255, 255, 255)')).toBe(true)
    expect(isLight('rgb(12, 19, 22)')).toBe(false) // night
    expect(isLight('rgb(0, 0, 0)')).toBe(false)
  })
})

describe('the strips around the page', () => {
  it('take the page ground as Android writes a colour', () => {
    expect(hexOf('rgb(247, 242, 232)')).toBe('#f7f2e8')
    expect(hexOf('rgb(12, 19, 22)')).toBe('#0c1316')
    expect(hexOf('transparent')).toBeNull()
  })
})
