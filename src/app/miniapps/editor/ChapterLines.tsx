/**
 * A text of the chapter as it is set: each verse in its lines, a poem's lines set in by their marker. The open verse
 * stands out and is brought into sight in its pane; the ones around it say where it is. A touched word shows its
 * helps under its verse.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import type { PrototypeText } from '../../../prototype/data'
import { WordLines } from '../../frame/TouchWords'

export function ChapterLines({
  text,
  verse,
  lit,
  hint,
  onWord,
  under,
}: {
  text: PrototypeText
  verse: number
  lit: Set<number>
  hint: string
  onWord(verse: number, place: number): void
  /** What goes under a verse (the helps of a touched word). */
  under(verse: number): ReactNode
}) {
  const current = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // Within the pane only: scrolling the page would move the screen under the person's finger.
    const el = current.current
    const pane = el?.closest<HTMLElement>('.pane')
    if (el && pane) pane.scrollTop = Math.max(0, el.offsetTop - 12)
  }, [verse, text.key])

  const verses = Object.keys(text.lines).map(Number).sort((a, b) => a - b)
  return (
    <div className={text.original ? 'chapter-lines is-original' : 'chapter-lines'}>
      <p className="chapter-lines-title">
        {text.title} · {hint}
      </p>
      {verses.map((v) => (
        <div key={v} ref={v === verse ? current : undefined}>
          <div className={v === verse ? 'chapter-verse is-current' : 'chapter-verse'} dir={text.dir ?? 'ltr'} lang={text.lang}>
            <WordLines lines={text.lines[v]} verse={v} lit={lit} onWord={(place) => onWord(v, place)} />
          </div>
          {under(v)}
        </div>
      ))}
    </div>
  )
}
