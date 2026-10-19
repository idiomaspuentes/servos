import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(HERE, 'fonts.css'), 'utf8')

type Face = { family: string; style: string; weight: string; src: string; ranges: [number, number][] }

const faces: Face[] = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => {
  const get = (prop: string) => body.match(new RegExp(`${prop}:\\s*([^;]+);`))?.[1].trim() ?? ''
  const ranges = get('unicode-range')
    .split(',')
    .map((r) => r.trim().replace(/^U\+/, '').split('-'))
    .map(([a, b]) => [parseInt(a, 16), parseInt(b ?? a, 16)] as [number, number])
  return { family: get('font-family').replace(/"/g, ''), style: get('font-style'), weight: get('font-weight'), src: get('src'), ranges }
})

const covers = (face: Face, ch: string) => face.ranges.some(([a, b]) => ch.codePointAt(0)! >= a && ch.codePointAt(0)! <= b)

describe('the scripture letters', () => {
  // Titus 1:1 «δὲ … κατὰ … Θεὸς»: with no Greek of its own, Charis SIL left these to the system, and Georgia (Windows)
  // draws a vowel with varia as the bare vowel and a spacing grave beside it.
  const greek = ['δ', 'ὲ', 'ὰ', 'ὸ', 'ῦ', 'ῃ', 'ἐ', 'ἁ', 'ά']

  for (const style of ['normal', 'italic'])
    for (const weight of ['400', '700'])
      it(`draws polytonic Greek inside the app (Charis SIL ${weight} ${style})`, () => {
        const own = faces.filter((f) => f.family === 'Charis SIL' && f.style === style && f.weight === weight)
        for (const ch of greek) {
          const face = own.find((f) => covers(f, ch))
          expect(face, `${ch} U+${ch.codePointAt(0)!.toString(16)}`).toBeDefined()
          const file = face!.src.match(/url\("([^"]+)"\)/)![1]
          expect(existsSync(resolve(HERE, file)), file).toBe(true)
        }
      })

  it('leaves Hebrew to the Hebrew letters', () => {
    const hebrew = ['א', 'ְ', '֑', 'ׁ']
    for (const ch of hebrew) expect(faces.filter((f) => covers(f, ch)).map((f) => f.family)).toEqual([])
  })
})
