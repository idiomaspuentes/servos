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
