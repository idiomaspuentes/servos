/**
 * A book as USFM, to take the team's work to another app (Paratext, translationCore) or to Door43 by hand. The text
 * follows the bridge text's shape, as the editor does: a paragraph where the bridge text begins one, each line of a
 * poem with its marker (`\q1`, `\q2`), verses joined as one (`\v 1-2`). A verse not translated yet is there, empty,
 * so the book has all its verses.
 */

import type { PrototypeData } from '../../prototype/data'
import { bookName } from './model'
import { joinedTo, readDraft } from './work'

const isPoem = (marker: string) => /^q\d?$|^qm\d?$/.test(marker)

export function bookUsfm(code: string, projectName: string, chapters: PrototypeData[], bridge = 'TPL', title?: string): string {
  // The name the team gave the book, else the bridge text's.
  const name = title?.trim() || bookName(code)
  const out = [`\\id ${code.toUpperCase()} ${projectName}`, '\\usfm 3.0', '\\ide UTF-8', `\\h ${name}`, `\\toc1 ${name}`, `\\toc2 ${name}`, `\\mt ${name}`]
  for (const data of chapters) {
    const text = data.texts.find((x) => x.abbreviation === bridge) ?? data.texts.find((x) => !x.original)
    // The verses that begin a paragraph in the bridge text.
    const starts = new Set(
      (text?.pieces ?? []).flatMap((p) => (p.kind === 'paragraph' && p.verses.length ? [p.verses[0].verse] : []))
    )
    out.push(`\\c ${data.chapter}`)
    const verses = data.verses.map((v) => v.verse)
    for (let i = 0; i < verses.length; i++) {
      const v = verses[i]
      const end = joinedTo(code, data.chapter, v) ?? v
      const number = end > v ? `${v}-${end}` : `${v}`
      const markers = (text?.lines[v] ?? []).map((l) => l.marker)
      const lines = readDraft(code, data.chapter, v)
        .split('\n')
        .map((l) => l.replace(/\s+/g, ' ').trim())
      if (markers.some(isPoem)) {
        // A poem: each line its marker, the verse number on the first.
        lines.forEach((line, n) => {
          const marker = markers[Math.min(n, markers.length - 1)] || 'q1'
          out.push(n === 0 ? `\\${marker} \\v ${number}${line ? ` ${line}` : ''}` : `\\${marker} ${line}`)
        })
      } else {
        if (starts.has(v) || i === 0) out.push(`\\${markers[0] && markers[0] !== 'q' ? markers[0] : 'p'}`)
        const joined = lines.filter(Boolean).join(' ')
        out.push(`\\v ${number}${joined ? ` ${joined}` : ''}`)
      }
      // The verses a join takes in are said by its first.
      while (i + 1 < verses.length && verses[i + 1] <= end) i++
    }
  }
  return out.join('\n') + '\n'
}
