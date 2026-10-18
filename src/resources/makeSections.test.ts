/// <reference types="node" />
/**
 * Writes where each section begins in every chapter of the Bible (`sections.json`), from the `\ts\*` markers of
 * unfoldingWord's ULT (en_ult on Door43, CC BY-SA 4.0): the translators' sections that translationCore works by. The
 * gateway languages' texts do not mark them and no pack carries them, so the app has them all (a small table):
 *
 *   SERVOS_SECCIONES=1 npx vitest run src/resources/makeSections.test.ts
 *
 * Skipped without the variable. Reads 66 files from Door43 (public).
 */
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'vitest'
import { BIBLE_ORDER } from './reading'

const RAW = 'https://git.door43.org/unfoldingWord/en_ult/raw/branch/master'

/** `01-GEN.usfm` … `39-MAL.usfm`, `41-MAT.usfm` … `67-REV.usfm`. */
const fileOf = (code: string) => {
  const i = BIBLE_ORDER.indexOf(code)
  return `${String(i < 39 ? i + 1 : i + 2).padStart(2, '0')}-${code.toUpperCase()}.usfm`
}

/** Chapter → the verses where its sections begin (the first verse of the chapter always begins one). */
export function sectionStartsIn(usfm: string): Record<number, number[]> {
  const out: Record<number, number[]> = {}
  let chapter = 0
  let marked = true
  for (const m of usfm.matchAll(/\\c\s+(\d+)|\\ts\\\*|\\v\s+(\d+)/g)) {
    if (m[1]) {
      chapter = Number(m[1])
      out[chapter] = []
      marked = true
    } else if (m[2]) {
      const verse = Number(m[2])
      const starts = out[chapter]
      if (starts && (marked || !starts.length) && !starts.includes(verse)) starts.push(verse)
      marked = false
    } else marked = true
  }
  return out
}

describe.skipIf(!process.env.SERVOS_SECCIONES)('secciones de toda la Biblia', () => {
  it('lee las marcas del ULT de cada libro', async () => {
    const all: Record<string, Record<number, number[]>> = {}
    for (let i = 0; i < BIBLE_ORDER.length; i += 6) {
      await Promise.all(
        BIBLE_ORDER.slice(i, i + 6).map(async (code) => {
          const response = await fetch(`${RAW}/${fileOf(code)}`)
          if (!response.ok) throw new Error(`${fileOf(code)}: ${response.status}`)
          all[code] = sectionStartsIn(await response.text())
        })
      )
    }
    const ordered = Object.fromEntries(BIBLE_ORDER.map((code) => [code, all[code]]))
    writeFileSync(join(__dirname, 'sections.json'), JSON.stringify(ordered) + '\n')
    const chapters = Object.values(all).reduce((n, b) => n + Object.keys(b).length, 0)
    console.log(`${BIBLE_ORDER.length} libros, ${chapters} capítulos`)
  }, 600_000)
})
