/**
 * The `rc:` links the helps write to point to an article (`[[rc://…/tw/dict/bible/kt/grace]]`): which article each
 * is, so a screen can offer it by its title and the chapter's data can bring it along.
 */

/** The article an `rc:` link points to: a word's (`bible/kt/grace`) or Translation Academy's (`translate/figs-idiom`). */
export type ArticleRef = { kind: 'tw' | 'ta'; path: string }

export function articleOf(rc: string): ArticleRef | null {
  const tw = rc.match(/\/tw\/dict\/(.+?)(?:\.md)?$/)
  if (tw) return { kind: 'tw', path: tw[1] }
  const ta = rc.match(/\/ta\/man\/(.+?)(?:\/01\.md)?$/)
  return ta ? { kind: 'ta', path: ta[1] } : null
}

/** The `rc:` links a text points to, as written (`rc://…/tw/dict/bible/kt/grace`). */
export const rcLinksIn = (text: string): string[] => [...text.matchAll(/\[\[(rc:[^\]]+)\]\]/g)].map((m) => m[1])

/**
 * The article a link inside another article points to: an `rc:` link, or a path relative to the article it is in, as
 * Translation Words (`../kt/prophet.md`, from `bible/kt/grace`) and Translation Academy (`../figs-simile/01.md`, from
 * `translate/figs-metaphor`) write them. A link to a note on a passage, or outside the helps, is none.
 */
export function articleFrom(href: string, from: ArticleRef | null): ArticleRef | null {
  if (href.startsWith('rc:')) return articleOf(href)
  if (!from || /^[a-z]+:/i.test(href) || href.startsWith('#')) return null
  // A Translation Academy article is a folder (`translate/figs-metaphor/01.md`): its links start from inside it.
  const base = (from.kind === 'ta' ? `${from.path}/01.md` : `${from.path}.md`).split('/').slice(0, -1)
  for (const part of href.split('/')) {
    if (part === '..') base.pop()
    else if (part && part !== '.') base.push(part)
  }
  const path = base.join('/').replace(/\.md$/, '')
  return from.kind === 'ta' ? { kind: 'ta', path: path.replace(/\/01$/, '') } : { kind: 'tw', path }
}
