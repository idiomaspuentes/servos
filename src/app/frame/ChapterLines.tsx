/**
 * A text of the chapter as it is set: each verse in its lines, a poem's lines set in by their marker. The open verse
 * (or section) stands out and is brought into sight in its pane; the ones around it say where it is. A touched word
 * shows its helps under its verse.
 */

import { useEffect, useRef, type ReactNode } from 'react'
import type { PrototypeText } from '../../prototype/data'
import { WordLines } from './TouchWords'

export function ChapterLines({
  text,
  shown,
  at,
  line,
  lit,
  hint,
  onWord,
  under,
  only = false,
  glossed,
  helped,
}: {
  text: PrototypeText
  /** The verses open: the verse, or those of its section. */
  shown: number[]
  /** The verse brought into sight: the one being written, within a section too. */
  at: number
  /**
   * The line being written in that verse, when one is: the same line here stands out and is brought to the middle of
   * the pane, so it is in sight as soon as the person slides to it. A text with fewer lines (the original has one a
   * verse) shows its last.
   */
  line: number | null
  lit: Set<number>
  hint: string
  onWord(verse: number, place: number): void
  /** What goes under a verse (the helps of a touched word). */
  under(verse: number): ReactNode
  /** Only the verses open, larger, for reading them alone (the study); else the whole chapter, the open ones lit. */
  only?: boolean
  /** Words the glossary has an entry for. */
  glossed?: Set<number>
  /** Words a note or a key word is about. */
  helped?: Set<number>
}) {
  const current = useRef<HTMLDivElement>(null)
  const count = text.lines[at]?.length ?? 0
  const writing = line === null || !count ? undefined : Math.min(line, count - 1)
  useEffect(() => {
    // Within the pane only: scrolling the page would move the screen under the person's finger. The pane is laid
    // out while out of sight too, so it is ready before the person slides to it.
    const verse = current.current
    const pane = verse?.closest<HTMLElement>('.pane')
    if (!verse || !pane) return
    const target = writing === undefined ? null : verse.querySelector<HTMLElement>('.is-writing-line')
    if (!target) {
      const top = verse.offsetTop - 12
      pane.scrollTop = top < pane.clientHeight / 3 ? 0 : top
      return
    }
    const p = pane.getBoundingClientRect()
    const r = target.getBoundingClientRect()
    pane.scrollTop = Math.max(0, pane.scrollTop + (r.top - p.top) - (pane.clientHeight - r.height) / 2)
  }, [at, writing, text.key])

  const noted = text.wordNotes ? new Set(Object.keys(text.wordNotes).map(Number)) : undefined
  const verses = Object.keys(text.lines)
    .map(Number)
    .sort((a, b) => a - b)
    .filter((v) => !only || shown.includes(v))
  return (
    <div className={`chapter-lines${text.original ? ' is-original' : ''}${only ? ' is-alone' : ''}`}>
      <p className="chapter-lines-title">
        {text.title} · {hint}
      </p>
      {verses.map((v) => (
        <div key={v} ref={v === at ? current : undefined}>
          <div className={shown.includes(v) ? 'chapter-verse is-current' : 'chapter-verse'} dir={text.dir ?? 'ltr'} lang={text.lang}>
            <WordLines lines={text.lines[v]} verse={v} lit={lit} onWord={(place) => onWord(v, place)} writing={v === at ? writing : undefined} glossed={glossed} helped={helped} noted={noted} />
          </div>
          {under(v)}
        </div>
      ))}
    </div>
  )
}
