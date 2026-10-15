/**
 * A verse written a line to a field, as Taller does (`src/components/VerseLines.tsx`): each line of a poem in the
 * text translated from has its field, drawn set in like that line, so the app knows the shape of the verse (`\q1`,
 * `\q2`) and nobody types a marker. Enter begins a line, Backspace at the start joins it to the one before. A verse of
 * prose is one field.
 */

import { useRef, useState, type KeyboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { fieldLines, joinLine, linesText, setLine, splitLine, type LinePlace, type LinesChange } from '../../../usfm/verseLines'

export const lineFieldId = (id: string, line: number) => (line === 0 ? id : `${id}-l${line + 1}`)

export function LineFields({
  id,
  text,
  markers,
  poem,
  label,
  placeholder,
  addLabel,
  onChange,
}: {
  id: string
  /** The verse as it is kept: its lines parted by `\n`. */
  text: string
  /** The markers of the lines of the text translated from, in order. */
  markers: string[]
  poem: boolean
  label: string
  placeholder(line: number): string
  addLabel: string
  onChange(text: string): void
}) {
  const [more, setMore] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const least = poem ? markers.length : 1
  const lines = poem ? fieldLines(text, least, more) : [text.replace(/\n+/g, ' ')]
  const last = markers[markers.length - 1] ?? 'p'
  const markerOf = (line: number) => (poem ? markers[line] ?? last : markers[0] ?? 'p')

  const put = (place: LinePlace) => {
    const box = root.current?.querySelector<HTMLTextAreaElement>(`#${CSS.escape(lineFieldId(id, place.line))}`)
    if (!box) return
    box.focus()
    box.setSelectionRange(place.offset, place.offset)
  }
  // At once, so the focus moves while the key is still down and the phone keeps its keyboard up.
  const apply = (change: LinesChange) => {
    const kept = linesText(change.lines)
    const written = kept ? kept.split('\n').length : 0
    flushSync(() => {
      setMore(Math.max(0, change.lines.length - Math.max(written, least, 1)))
      onChange(kept)
    })
    put(change.place)
  }

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>, line: number) => {
    const box = event.currentTarget
    const { selectionStart: from, selectionEnd: to } = box
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      if (poem) apply(splitLine(lines, line, from, to))
    } else if (poem && event.key === 'Backspace' && from === 0 && to === 0 && line > 0) {
      event.preventDefault()
      apply(joinLine(lines, line))
    } else if (event.key === 'ArrowUp' && from === 0 && to === 0 && line > 0) {
      event.preventDefault()
      put({ line: line - 1, offset: lines[line - 1].length })
    } else if (event.key === 'ArrowDown' && from === box.value.length && line < lines.length - 1) {
      event.preventDefault()
      put({ line: line + 1, offset: 0 })
    }
  }

  return (
    <div ref={root} className="line-fields" role="group" aria-label={label} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node | null) && setMore(0)}>
      {lines.map((value, line) => (
        <div key={line} className="usfm-line" data-marker={markerOf(line)}>
          <textarea
            id={lineFieldId(id, line)}
            className="line-field"
            rows={1}
            value={value}
            placeholder={placeholder(line + 1)}
            aria-label={poem ? `${label} · ${line + 1}` : label}
            enterKeyHint={poem ? 'next' : 'done'}
            onKeyDown={(event) => onKey(event, line)}
            onChange={(event) => {
              if (!poem) return onChange(event.target.value.replace(/\r?\n/g, ' '))
              // A keyboard that sends no key for Enter leaves a line end in the text: it is the same request.
              const change = setLine(lines, line, event.target.value)
              if (change.lines.length !== lines.length) apply(change)
              else onChange(linesText(change.lines))
            }}
          />
        </div>
      ))}
      {poem && lines[lines.length - 1].trim() ? (
        <button type="button" className="line-add" onClick={() => apply({ lines: [...lines, ''], place: { line: lines.length, offset: 0 } })}>
          {addLabel}
        </button>
      ) : null}
    </div>
  )
}
