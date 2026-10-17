/**
 * Servos's mark, drawn here so it needs no file (the page shared inside Claude has none): the book that speaks, an open
 * book whose left page is written in one language and whose right page is said aloud in another, a voice in ochre.
 * Translating, written and by voice, not only reading. The app's icons (public/) are the same drawing.
 */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <rect width="96" height="96" rx="21" fill="#17496a" />
      <path d="M46.9 32 Q36 24.8 20.4 28.4 L20.4 71.6 Q36 68 46.9 75.2 Z" fill="#f6f1e7" />
      <path d="M49.1 32 Q60 24.8 75.6 28.4 L75.6 71.6 Q60 68 49.1 75.2 Z" fill="#f6f1e7" />
      <g stroke="#17496a" strokeOpacity="0.45" strokeWidth="2.3" strokeLinecap="round" fill="none">
        <path d="M25.2 38.3 Q34.8 35.6 43.2 40.4" />
        <path d="M25.2 46.1 Q34.8 43.4 43.2 48.2" />
        <path d="M25.2 53.9 Q34.8 51.2 43.2 56" />
        <path d="M25.2 61.7 Q34.8 59 43.2 63.8" />
      </g>
      <g stroke="#d39a2c" strokeWidth="3" strokeLinecap="round">
        <path d="M54 49 V58" />
        <path d="M58.5 43 V64" />
        <path d="M63 46.5 V60.5" />
        <path d="M67.5 41 V66" />
        <path d="M72 48 V59" />
      </g>
    </svg>
  )
}
