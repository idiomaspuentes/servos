/**
 * An article read in a sheet (a key word's, Translation Academy's), whose own links to other articles are offered by
 * their text and open in the same sheet, with «‹ Back» to the one before: the article it was opened on is not lost.
 * An article is taken from the chapter's data first, else read from this device (`readArticle`). A link is offered only
 * when its article can be read: the example bundled in the app carries its chapters' articles, not all of them.
 */

import { useState } from 'react'
import type { PrototypeData } from '../../prototype/data'
import { articleFrom, type ArticleRef } from '../../resources/articleLinks'
import { useT } from '../i18n/i18n'
import { articlesOnDevice, readArticle } from '../projects/library'
import { Markdown, type ArticleLinks } from './Markdown'
import { Sheet } from './Sheet'

export interface OpenArticle {
  /** Which article it is, for its links relative to it; none for one whose place is not known. */
  ref: ArticleRef | null
  title: string
  markdown: string
}

/** An article as the chapter's data has it (`words`, `academy`), when it does. */
export function articleIn(data: PrototypeData, ref: ArticleRef): OpenArticle | null {
  const found = ref.kind === 'tw' ? data.words[ref.path] : data.academy[ref.path]
  return found?.markdown ? { ref, title: found.title, markdown: found.markdown } : null
}

export function ArticleSheet({ data, article, onClose }: { data: PrototypeData; article: OpenArticle; onClose(): void }) {
  const t = useT()
  const [stack, setStack] = useState<OpenArticle[]>([article])
  const shown = stack[stack.length - 1]
  const open = async (ref: ArticleRef, label?: string) => {
    const found = articleIn(data, ref) ?? (await readArticle(ref).then((a) => (a ? { ref, ...a } : null)).catch(() => null))
    setStack((s) => [...s, found ?? { ref, title: label ?? ref.path, markdown: t('ayudas.articuloNoEsta') }])
  }
  const links: ArticleLinks = {
    titleOf: (ref) => articleIn(data, ref)?.title ?? null,
    open: (ref, label) => void open(ref, label),
    hrefOf: (href) => {
      const ref = articleFrom(href, shown.ref)
      return ref && (articleIn(data, ref) || articlesOnDevice(ref.kind)) ? ref : null
    },
  }
  return (
    <Sheet title={shown.title} onClose={onClose}>
      {stack.length > 1 && (
        <button type="button" className="word-help-read article-back" onClick={() => setStack((s) => s.slice(0, -1))}>
          ‹ {t('ayudas.volverA', { titulo: stack[stack.length - 2].title.split(',')[0].trim() })}
        </button>
      )}
      <Markdown key={stack.length} text={shown.markdown} skipFirstHeading links={links} />
    </Sheet>
  )
}
