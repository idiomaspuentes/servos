/**
 * A book as USFM, to take the team's work to another app (Paratext, translationCore) or to Door43 by hand. The text
 * follows the bridge text's shape, as the editor does: a paragraph where the bridge text begins one, each line of a
 * poem with its marker (`\q1`, `\q2`), verses joined as one (`\v 1-2`). A verse not translated yet is there, empty,
 * so the book has all its verses.
 */

import type { AlignmentGroup } from '@usfm-tools/types'
import { normalizeWordForAlignmentMatch } from '@usfm-tools/editor-core'
import type { PrototypeData } from '../../prototype/data'
import { alignmentFor, readAlignment } from './alignment'
import { bookName } from './model'
import { joinedTo, readDraft } from './bookText'

const isPoem = (marker: string) => /^q\d?$|^qm\d?$/.test(marker)

/**
 * A verse's lines with its alignment to the original written in, as unfoldingWord's tools write it: each word of the
 * draft as `\w` (its occurrence among the same words of the verse), the words a group links inside its `\zaln-s` (one
 * for each original word, with its Strong number, lemma and morphology) and `\zaln-e`, punctuation outside them. A
 * group is closed at punctuation and at the end of a line, and opened again where it goes on.
 */
export function alignedLines(lines: string[], groups: AlignmentGroup[]): string[] {
  type Token = { line: number; surface: string; core: string; before: string; after: string; occ: number; occs: number; group: number }
  const tokens: Token[] = []
  lines.forEach((line, n) => {
    for (const surface of line.split(/\s+/).filter(Boolean)) {
      const core = normalizeWordForAlignmentMatch(surface)
      const at = core ? surface.indexOf(core) : surface.length
      tokens.push({ line: n, surface, core, before: surface.slice(0, at), after: core ? surface.slice(at + core.length) : '', occ: 0, occs: 0, group: -1 })
    }
  })
  const total = new Map<string, number>()
  for (const tk of tokens) if (tk.core) total.set(tk.core, (total.get(tk.core) ?? 0) + 1)
  const seen = new Map<string, number>()
  for (const tk of tokens) {
    if (!tk.core) continue
    tk.occ = (seen.get(tk.core) ?? 0) + 1
    seen.set(tk.core, tk.occ)
    tk.occs = total.get(tk.core) ?? 1
    tk.group = groups.findIndex((g) => g.targets.some((w) => normalizeWordForAlignmentMatch(w.word) === tk.core && w.occurrence === tk.occ))
  }
  const attr = (v: string) => v.replace(/"/g, "'")
  const open = (g: AlignmentGroup) =>
    g.sources
      .map(
        (o) =>
          `\\zaln-s |x-strong="${attr(o.strong)}" x-lemma="${attr(o.lemma)}"${o.morph ? ` x-morph="${attr(o.morph)}"` : ''} x-occurrence="${o.occurrence}" x-occurrences="${o.occurrences}" x-content="${attr(o.content)}"\\*`
      )
      .join('')
  const close = (g: AlignmentGroup) => '\\zaln-e\\*'.repeat(g.sources.length)
  return lines.map((_, n) => {
    let out = ''
    let current = -1
    const shut = () => {
      if (current >= 0) out += close(groups[current])
      current = -1
    }
    tokens
      .filter((tk) => tk.line === n)
      .forEach((tk, i) => {
        const word = tk.core ? `\\w ${tk.core}|x-occurrence="${tk.occ}" x-occurrences="${tk.occs}"\\w*` : ''
        // The same group going on, with only a space between: the space and the word inside it.
        if (tk.group >= 0 && tk.group === current && !tk.before) {
          out += ` ${word}`
        } else {
          shut()
          out += `${i > 0 ? ' ' : ''}${tk.before}`
          if (tk.group >= 0) {
            out += open(groups[tk.group])
            current = tk.group
          }
          out += word || tk.surface
        }
        if (tk.after) {
          shut()
          out += tk.after
        }
      })
    shut()
    return out
  })
}

/** Where a book's text is read from: the book's door, or (to lay out an empty book, or one being moved) another. */
export interface TextSource {
  readDraft(book: string, chapter: number, verse: number): string
  joinedTo(book: string, chapter: number, verse: number): number | null
}

export function bookUsfm(
  code: string,
  projectName: string,
  chapters: PrototypeData[],
  bridge = 'TPL',
  title?: string,
  aligned = false,
  from: TextSource = { readDraft, joinedTo }
): string {
  // The name the team gave the book, else the bridge text's.
  const name = title?.trim() || bookName(code)
  const out = [`\\id ${code.toUpperCase()}${projectName ? ` ${projectName}` : ''}`, '\\usfm 3.0', '\\ide UTF-8', `\\h ${name}`, `\\toc1 ${name}`, `\\toc2 ${name}`, `\\mt ${name}`]
  for (const data of chapters) {
    const text = data.texts.find((x) => x.abbreviation === bridge) ?? data.texts.find((x) => !x.original)
    // The verses that begin a paragraph in the bridge text.
    const starts = new Set(
      (text?.pieces ?? []).flatMap((p) => (p.kind === 'paragraph' && p.verses.length ? [p.verses[0].verse] : []))
    )
    out.push(`\\c ${data.chapter}`)
    // The alignment that goes in the USFM is the one with the original (with a bridge text it is the team's aid).
    const original = data.texts.find((x) => x.original)
    const verses = data.verses.map((v) => v.verse)
    for (let i = 0; i < verses.length; i++) {
      const v = verses[i]
      const end = from.joinedTo(code, data.chapter, v) ?? v
      const number = end > v ? `${v}-${end}` : `${v}`
      const markers = (text?.lines[v] ?? []).map((l) => l.marker)
      const draft = from.readDraft(code, data.chapter, v)
      const plain = draft.split('\n').map((l) => l.replace(/\s+/g, ' ').trim())
      const groups = aligned && original ? alignmentFor(readAlignment(code, data.chapter, v, original.abbreviation), draft) : []
      const lines = groups.length ? alignedLines(plain, groups) : plain
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
