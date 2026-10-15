import { describe, expect, it } from 'vitest'
import { compareVersions } from './versions'

const marked = (pieces: Array<{ text: string; changed: boolean }>) => pieces.filter((p) => p.changed).map((p) => p.text)
const whole = (pieces: Array<{ text: string }>) => pieces.map((p) => p.text).join('')

describe('two versions of a verse, compared word by word', () => {
  it('marks only the words each version does not share with the other', () => {
    const { a, b } = compareVersions('Ve a Nínive, esa gran ciudad', 'Anda a Nínive, esa ciudad grande')
    expect(marked(a)).toEqual(['Ve', 'gran'])
    expect(marked(b)).toEqual(['Anda', 'grande'])
  })

  it('keeps each version as it was written, spaces and lines included', () => {
    const text = 'Jonás se levantó\npara huir  a Tarsis.'
    expect(whole(compareVersions(text, 'otra cosa').a)).toBe(text)
  })

  it('counts a sign as a difference: a comma can change what a verse says', () => {
    const { a, b } = compareVersions('Nínive, la ciudad', 'Nínive la ciudad')
    expect(marked(a)).toEqual(['Nínive,'])
    expect(marked(b)).toEqual(['Nínive'])
  })

  it('marks nothing when both say the same', () => {
    const { a, b } = compareVersions('y él se fue', 'y él se fue')
    expect(marked(a)).toEqual([])
    expect(marked(b)).toEqual([])
  })

  it('marks words changed side by side as one change, the space between them included', () => {
    const { a } = compareVersions('Sucedió un día que Jehová habló', 'Un día Jehová habló')
    expect(marked(a)).toEqual(['Sucedió', ' ', 'un', 'que'])
  })

  it('marks a word moved elsewhere in only one of the two places', () => {
    const { a, b } = compareVersions('subió al barco Jonás', 'Jonás subió al barco')
    expect(marked(a)).toEqual(['Jonás'])
    expect(marked(b)).toEqual(['Jonás'])
  })
})
