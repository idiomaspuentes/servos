/**
 * Enough markdown for notes, questions and articles: headings, lists, paragraphs, bold, italics, and links shown as
 * their text (an `rc:` link means nothing on a phone without the article's context). Given `links`, an article
 * an `rc:` link points to (`[[rc://…/tw/dict/bible/kt/grace]]`) is offered by its title, to open; without it, or for an
 * article not on the device, the link goes.
 */

import type { ReactNode } from 'react'
import { articleOf, rcLinksIn, type ArticleRef } from '../../resources/articleLinks'

export type { ArticleRef }

/**
 * How a text's articles are offered: the title of one on this device (null when it is not), opening it, and, for an
 * article's own links (`[profeta](../kt/prophet.md)`), the article a link points to; those are offered by their text.
 */
export type ArticleLinks = {
  titleOf(ref: ArticleRef): string | null
  open(ref: ArticleRef, label?: string): void
  hrefOf?(href: string): ArticleRef | null
}

function inline(text: string, links?: ArticleLinks): ReactNode[] {
  const out: ReactNode[] = []
  // A link may have a space before its target («[apóstrofe] (./figs-apostrophe/01.md)», as es-419's articles write
  // some): then only a target that looks like a path, so a plain parenthesis after brackets stays text.
  const pattern = /(\[\[rc:[^\]]+\]\]|\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[[^\]]+\](?:\([^)]+\)| \([^\s)]*[/:.][^\s)]*\)))/g
  let last = 0
  let i = 0
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0
    if (at > last) out.push(text.slice(last, at))
    const m = match[0]
    if (m.startsWith('[[')) {
      const ref = articleOf(m.slice(2, -2))
      const title = ref && links?.titleOf(ref)
      if (ref && title)
        out.push(
          <button key={i++} type="button" className="md-article" onClick={() => links!.open(ref)}>
            {title}
          </button>
        )
    } else if (m.startsWith('**')) out.push(<strong key={i++}>{m.slice(2, -2)}</strong>)
    else if (m.startsWith('[')) {
      const label = m.slice(1, m.indexOf(']'))
      const ref = links?.hrefOf?.(m.slice(m.indexOf('(') + 1, -1).trim())
      out.push(
        ref ? (
          <button key={i++} type="button" className="md-article" onClick={() => links!.open(ref, label)}>
            {label}
          </button>
        ) : (
          label
        )
      )
    }
    else out.push(<em key={i++}>{m.slice(1, -1)}</em>)
    last = at + m.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/**
 * Notes point to their article as `(See: [[rc://…/ta/man/…]])`, an introduction to several (`(Ver: [[…]], [[…]])`); the
 * helps panel already offers a note's article as a button, so the raw links are dropped, with what held them.
 * With `keep`, only those whose article is not offered.
 */
export function withoutArticleLinks(text: string, keep?: (rc: string) => boolean): string {
  const gone = (rc: string) => !keep?.(rc)
  return text
    .replace(/\s*\((?:ver|see|veja)\s*:?\s*((?:\[\[rc:[^\]]+\]\][\s,;y]*)+)\)/gi, (all, inside: string) => {
      const kept = rcLinksIn(inside).filter((rc) => !gone(rc))
      return kept.length ? all.replace(inside, kept.map((rc) => `[[${rc}]]`).join(', ')) : ''
    })
    .replace(/\[\[(rc:[^\]]+)\]\]/g, (all, rc: string) => (gone(rc) ? '' : all))
    .replace(/([^.])\.\.(?![./])/g, '$1.') // «Dios». (ver: …). leaves two periods; «../kt/prophet.md» is a path
}

export function Markdown({ text, skipFirstHeading = false, links }: { text: string; skipFirstHeading?: boolean; links?: ArticleLinks }) {
  const blocks: ReactNode[] = []
  const offered = (rc: string) => {
    const ref = articleOf(rc)
    return Boolean(ref && links?.titleOf(ref))
  }
  const lines = withoutArticleLinks(text, links && offered).replace(/\\n/g, '\n').split('\n')
  let list: string[] = []
  let paragraph: string[] = []
  let skipped = !skipFirstHeading
  const flush = () => {
    if (paragraph.length) blocks.push(<p key={blocks.length}>{inline(paragraph.join(' '), links)}</p>)
    if (list.length) blocks.push(<ul key={blocks.length}>{list.map((item, i) => <li key={i}>{inline(item, links)}</li>)}</ul>)
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
      blocks.push(heading[1].length <= 2 ? <h3 key={blocks.length}>{inline(heading[2], links)}</h3> : <h4 key={blocks.length}>{inline(heading[2], links)}</h4>)
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
