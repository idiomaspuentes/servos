/**
 * What is hard to translate in a book: the Translation Academy articles its notes point to, with the notes, most used
 * first. Read from the chapters the mini app already has in memory, so it is the same in both pack formats; format 3
 * only adds, in the article's sheet, the other books that use it (`DondeAparece`).
 *
 * A note over several verses (`1:1-2`) is in each of them in the chapter's data: it is one note, kept at its first
 * verse, covering the others.
 */

import type { PrototypeData } from '../../prototype/data'

export type IssueNote = { chapter: number; verse: number; covers: number[]; id: string; quote: string; note: string }
export type BookIssue = { path: string; title: string; onDevice: boolean; notes: IssueNote[]; chapters: number }

/** The Academy articles the book's notes point to, most used first (then by title). */
export function issuesOfBook(chapters: ReadonlyArray<{ chapter: number; data: PrototypeData }>): BookIssue[] {
  const byPath = new Map<string, { notes: Map<string, IssueNote>; article?: { title: string; markdown: string } }>()
  for (const { chapter, data } of chapters) {
    for (const { verse, notes } of data.verses) {
      for (const n of notes) {
        if (!n.academy) continue
        let issue = byPath.get(n.academy)
        if (!issue) byPath.set(n.academy, (issue = { notes: new Map() }))
        const found = data.academy[n.academy]
        if (found?.markdown && !issue.article?.markdown) issue.article = found
        // The same note seen again in a later verse of its chapter: it covers that verse too.
        const key = `${chapter}:${n.id}`
        const kept = issue.notes.get(key)
        if (kept) {
          if (!kept.covers.includes(verse)) kept.covers.push(verse)
        } else issue.notes.set(key, { chapter, verse, covers: [verse], id: n.id, quote: n.quote, note: n.note })
      }
    }
  }
  const issues = [...byPath].map(([path, { notes, article }]): BookIssue => {
    const list = [...notes.values()].sort((a, b) => a.chapter - b.chapter || a.verse - b.verse)
    return {
      path,
      title: article ? article.title : path.slice(path.lastIndexOf('/') + 1),
      onDevice: Boolean(article),
      notes: list,
      chapters: new Set(list.map((n) => n.chapter)).size,
    }
  })
  return issues.sort((a, b) => b.notes.length - a.notes.length || a.title.localeCompare(b.title))
}

let kept: { datas: PrototypeData[]; issues: BookIssue[] } | null = null

/**
 * `issuesOfBook`, kept while the chapters are the same objects (the library replaces a chapter's data when it reads
 * it again): the frame asks at every render, and a long book has thousands of notes.
 */
export function issuesOfBookKept(chapters: ReadonlyArray<{ chapter: number; data: PrototypeData }>): BookIssue[] {
  const datas = chapters.map((c) => c.data)
  if (kept && kept.datas.length === datas.length && kept.datas.every((d, i) => d === datas[i])) return kept.issues
  kept = { datas, issues: issuesOfBook(chapters) }
  return kept.issues
}

/** The issues with a note on these verses of a chapter, each with the verses it is on, in the book's order. */
export function issuesOfSection(issues: BookIssue[], chapter: number, verses: number[]): Array<{ issue: BookIssue; verses: number[] }> {
  const out: Array<{ issue: BookIssue; verses: number[] }> = []
  for (const issue of issues) {
    const here = new Set<number>()
    for (const n of issue.notes) if (n.chapter === chapter) for (const v of n.covers) if (verses.includes(v)) here.add(v)
    if (here.size) out.push({ issue, verses: [...here].sort((a, b) => a - b) })
  }
  return out
}

/**
 * The book's notes on an article, for its sheet: those on the section (`here`) first, marked, then the others in the
 * book's order. Null when the book's notes do not use it.
 */
export function notesInBook(issues: BookIssue[], path: string, here?: { chapter: number; verses: number[] }): Array<IssueNote & { here: boolean }> | null {
  const issue = issues.find((i) => i.path === path)
  if (!issue) return null
  const marked = issue.notes.map((n) => ({ ...n, here: Boolean(here && n.chapter === here.chapter && n.covers.some((v) => here.verses.includes(v))) }))
  return [...marked.filter((n) => n.here), ...marked.filter((n) => !n.here)]
}

/** A note's first line, without its markdown: what a list of notes shows of each. */
export function noteGist(markdown: string): string {
  const first = markdown.trimStart().split(/\\n|\n/)[0] ?? ''
  return first
    .replace(/^#+\s*/, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .trim()
}
