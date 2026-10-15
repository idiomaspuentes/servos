/**
 * The words of a verse, to mark those that say something, as with a highlighter: Taller's `WordPicker`. A touch
 * marks one word, or takes it off. A finger slid over the words marks all it passes, from the word it began on to
 * the one it is on, across lines as reading goes; begun on a marked word, the same stroke takes them off. Each stroke
 * is a stretch, so several stretches are several strokes: no button, no rule to learn.
 *
 * The page still moves under a finger that goes up or down first (`touch-action: pan-y`): a stroke is one that
 * begins sideways, and may then go down to the next lines.
 */

import { useRef } from 'react'

export function WordPicker({
  words,
  picked,
  onChange,
  off = false,
}: {
  words: string[]
  /** The places of the marked words, from 0. */
  picked: number[]
  onChange(picked: number[]): void
  /** Shown unmarked (the phrase was said not to be there), though what was marked is kept. */
  off?: boolean
}) {
  const shown = off ? [] : picked
  /** The stroke in hand: the word it began on, what was marked then, and whether it marks or takes off. */
  const stroke = useRef<{ from: number; base: number[]; marks: boolean; moved: boolean } | null>(null)
  /** A stroke that ends on the word it began on is followed by a click there, which is not a touch of its own. */
  const justStroked = useRef(false)
  const wordAt = (x: number, y: number): number | null => {
    const hit = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-word]')
    return hit ? Number(hit.dataset.word) : null
  }
  return (
    <p
      className="word-picker"
      onPointerDown={(event) => {
        const from = wordAt(event.clientX, event.clientY)
        justStroked.current = false
        stroke.current = from === null ? null : { from, base: shown, marks: !shown.includes(from), moved: false }
      }}
      onPointerMove={(event) => {
        const now = stroke.current
        // A mouse that only passes over, with no button down, is no stroke.
        if (!now || (event.pointerType === 'mouse' && event.buttons === 0)) return
        const at = wordAt(event.clientX, event.clientY)
        if (at === null || (at === now.from && !now.moved)) return
        now.moved = true
        const run = new Set(Array.from({ length: Math.abs(at - now.from) + 1 }, (_, i) => Math.min(at, now.from) + i))
        onChange(now.marks ? [...new Set([...now.base, ...run])].sort((a, b) => a - b) : now.base.filter((i) => !run.has(i)))
      }}
      onPointerUp={() => {
        justStroked.current = Boolean(stroke.current?.moved)
        stroke.current = null
      }}
      onPointerCancel={() => {
        // The page took the gesture to scroll: what the stroke had marked on its way is undone.
        if (stroke.current?.moved) onChange(stroke.current.base)
        stroke.current = null
      }}
    >
      {words.map((word, i) => (
        <button
          key={i}
          type="button"
          className={shown.includes(i) ? 'picker-word is-picked' : 'picker-word'}
          data-word={i}
          aria-pressed={shown.includes(i)}
          onClick={() => {
            if (justStroked.current) justStroked.current = false
            else onChange(shown.includes(i) ? shown.filter((x) => x !== i) : [...shown, i].sort((a, b) => a - b))
          }}
        >
          {word}
        </button>
      ))}
    </p>
  )
}
