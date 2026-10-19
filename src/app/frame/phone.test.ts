import { describe, expect, it } from 'vitest'

import { isLight } from './phone'

describe("the phone's bars over the app", () => {
  it('write dark on the light themes and light on the dark ones', () => {
    expect(isLight('rgb(247, 242, 232)')).toBe(true) // paper
    expect(isLight('rgb(255, 255, 255)')).toBe(true)
    expect(isLight('rgb(12, 19, 22)')).toBe(false) // night
    expect(isLight('rgb(0, 0, 0)')).toBe(false)
  })
})
