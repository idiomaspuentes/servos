/**
 * Enough markdown for notes, questions and articles: headings, lists, paragraphs, bold, italics, and links shown as
 * their text (an `rc:` link means nothing on a phone without the article's context).
 */

import type { ReactNode } from 'react'

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let i = 0
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    const m = match[0]
    if (m.startsWith('**')) out.push(<strong key={i++}>{m.slice(2, -2)}</strong>)
    else if (m.startsWith('[')) out.push(m.slice(1, m.indexOf(']')))
    else out.push(<em key={i++}>{m.slice(1, -1)}</em>)
    last = at + m.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/**
 * Notes point to their article as `(See: [[rc://…/ta/man/…]])`; the helps panel already offers the article as a
 * button, so the raw link is dropped.
 */
export function withoutArticleLinks(text: string): string {
  return text
    .replace(/\s*\((?:ver|see|veja)\s*:?\s*\[\[rc:[^\]]+\]\]\)/gi, '')
    .replace(/\[\[rc:[^\]]+\]\]/g, '')
    .replace(/([^.])\.\.(?!\.)/g, '$1.') // «Dios». (ver: …). leaves two periods
}

export function Markdown({ text, skipFirstHeading = false }: { text: string; skipFirstHeading?: boolean }) {
  const blocks: ReactNode[] = []
  const lines = withoutArticleLinks(text).replace(/\\n/g, '\n').split('\n')
  let list: string[] = []
  let paragraph: string[] = []
  let skipped = !skipFirstHeading
  const flush = () => {
    if (paragraph.length) blocks.push(<p key={blocks.length}>{inline(paragraph.join(' '))}</p>)
    if (list.length) blocks.push(<ul key={blocks.length}>{list.map((item, i) => <li key={i}>{inline(item)}</li>)}</ul>)
    paragraph = []
    list = []
  }
  for (const raw of lines) {
    const line = raw.trim()
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    const item = line.match(/^[*-]\s+(.*)$/)
    if (!line) flush()
    else if (heading) {
      flush()
      if (!skipped) {
        skipped = true
        continue
      }
      blocks.push(heading[1].length <= 2 ? <h3 key={blocks.length}>{inline(heading[2])}</h3> : <h4 key={blocks.length}>{inline(heading[2])}</h4>)
    } else if (item) {
      if (paragraph.length) flush()
      list.push(item[1])
    } else {
      if (list.length) flush()
      paragraph.push(line)
    }
  }
  flush()
  return <div className="markdown">{blocks}</div>
}
