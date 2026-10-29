import { useId } from 'react'
import type { Phase } from '../projects/model'

/**
 * The book's steps, each with its picture beside its name (never alone, principle 11), so a row is known at a glance by
 * someone who reads little: study a magnifying glass, translation a pencil writing, checking a list with a tick, the
 * community a group of people, publishing an arrow going up. Drawn as the mark is (BrandMark): one colour, strokes of
 * one weight with square ends, on a grid of 48. The open book is left out: it is the mark.
 */
export function StepIcon({ phase }: { phase: Phase }) {
  const mask = useId()
  const line = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'butt', strokeLinejoin: 'miter' } as const
  return (
    <svg className="step-icon" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {phase === 'estudio' && (
        <>
          <circle cx="20" cy="20" r="11" strokeWidth="4.4" {...line} />
          <path d="M27.6 27.6L41 41" strokeWidth="6.4" {...line} />
        </>
      )}
      {phase === 'traduccion' && (
        <>
          <path d="M17 31L37 11" strokeWidth="7" {...line} />
          <path d="M14.5 28.5L19.5 33.5L11.5 36.5Z" fill="currentColor" />
          <path d="M24 39.4H41" strokeWidth="3.2" {...line} />
        </>
      )}
      {phase === 'revision' && (
        <>
          <path d="M6 12H30M6 20H24M6 28H16" strokeWidth="3.6" {...line} />
          <path d="M20 30L28 38L43 20" strokeWidth="4.8" {...line} />
        </>
      )}
      {phase === 'comunitaria' && (
        <>
          {/* The two behind are cut where the one in front stands, so the three read as three. */}
          <mask id={mask}>
            <rect width="48" height="48" fill="#fff" />
            <circle cx="24" cy="15" r="5.5" fill="#000" stroke="#000" strokeWidth="3" />
            <path d="M13 40A11 11 0 0 1 35 40Z" fill="#000" stroke="#000" strokeWidth="3" />
          </mask>
          <g mask={`url(#${mask})`} fill="currentColor">
            <circle cx="10.5" cy="18" r="4.5" />
            <path d="M2 38A8.5 8.5 0 0 1 19 38Z" />
            <circle cx="37.5" cy="18" r="4.5" />
            <path d="M29 38A8.5 8.5 0 0 1 46 38Z" />
          </g>
          <circle cx="24" cy="15" r="5.5" fill="currentColor" />
          <path d="M13 40A11 11 0 0 1 35 40Z" fill="currentColor" />
        </>
      )}
      {phase === 'publicacion' && (
        <>
          <path d="M24 34V9M13.5 19.5L24 9L34.5 19.5" strokeWidth="4.6" {...line} />
          <path d="M8 28V39H40V28" strokeWidth="4.2" {...line} />
        </>
      )}
    </svg>
  )
}
