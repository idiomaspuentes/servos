/// <reference types="node" />
/**
 * Writes the prototype's lexicon: the entries of the words of the original in its chapters, from Taller's lexicons on
 * Door43 (public reads, one small file a Strong number):
 *
 *   SERVOS_LEXICO=1 npx vitest run src/prototype/makeLexicon.test.ts
 *
 * Skipped without the variable. es-419_uhl is adapted from the UBS Dictionary of Biblical Hebrew, es-419_ugl from the
 * UBS Greek dictionary (CC BY-SA 4.0). A sense keeps the verses it applies to only in the prototype's books.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it } from 'vitest'
import { normalizeLexiconFile, strongParts, type LexiconFile } from '../lexicon/lexicon'
import type { PrototypeData } from './data'

const HOST = 'https://git.door43.org'
const REPO = { greek: 'es-419_gl/es-419_ugl', hebrew: 'es-419_gl/es-419_uhl' } as const

describe.skipIf(!process.env.SERVOS_LEXICO)('léxico del prototipo', () => {
  it('trae las entradas de las palabras de sus capítulos', async () => {
    const dir = join(__dirname, 'data')
    const chapters = readdirSync(dir)
      .filter((f) => /^[a-z0-9]+-\d+\.json$/.test(f))
      .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as PrototypeData)
    const books = new Set(chapters.map((c) => c.book.id.toUpperCase()))
    const wanted = new Map<string, { kind: 'greek' | 'hebrew'; number: number }>()
    for (const c of chapters) {
      for (const w of c.texts.find((x) => x.original)?.words ?? []) {
        for (const part of strongParts(w.strong)) wanted.set(`${part.kind}:${part.number}`, part)
      }
    }
    const out: Record<string, LexiconFile> = {}
    const list = [...wanted]
    for (let i = 0; i < list.length; i += 8) {
      await Promise.all(
        list.slice(i, i + 8).map(async ([key, part]) => {
          const response = await fetch(`${HOST}/${REPO[part.kind]}/raw/branch/master/content/${part.number}.json`)
          if (!response.ok) return
          const file = normalizeLexiconFile(await response.json())
          if (!file) return
          // Only the prototype's books in each sense's verses, and no long text the card does not show.
          for (const entry of file.entries)
            for (const sense of entry.senses)
              if (sense.refs) sense.refs = Object.fromEntries(Object.entries(sense.refs).filter(([b]) => books.has(b)))
          out[key] = { brief: file.brief, long: '', entries: file.entries }
        })
      )
    }
    writeFileSync(join(dir, 'lexicon.json'), JSON.stringify(out) + '\n')
    console.log(`${Object.keys(out).length} de ${wanted.size} entradas`)
  }, 600_000)
})
