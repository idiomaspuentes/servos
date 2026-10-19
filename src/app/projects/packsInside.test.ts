import { describe, expect, it } from 'vitest'
import { toOpen } from './packsInside'

describe('the packs the app brings', () => {
  const inside = [
    { file: 'originals.langpack.zip', id: 'a1' },
    { file: 'es-419.langpack.zip', id: 'b2' },
  ]

  it('opens all of them the first time, the originals first', () => {
    expect(toOpen(inside, []).map((p) => p.file)).toEqual(['originals.langpack.zip', 'es-419.langpack.zip'])
  })

  it('opens none it opened before, and goes on from one not ended', () => {
    expect(toOpen(inside, ['a1', 'b2'])).toEqual([])
    expect(toOpen(inside, ['a1']).map((p) => p.file)).toEqual(['es-419.langpack.zip'])
  })

  it('opens a pack again when a new version of the app brings it changed', () => {
    expect(toOpen([inside[0], { file: 'es-419.langpack.zip', id: 'c3' }], ['a1', 'b2']).map((p) => p.id)).toEqual(['c3'])
  })
})
