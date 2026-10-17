/**
 * Servos's mark, drawn here so it needs no file (the page shared inside Claude has none): a bridge, its arch over a deck
 * that crosses from one bank to the other; the deck is a line of text that starts in one language and ends in the
 * other (ochre). The bridge text, and Idiomas Puentes. In the app it is drawn on the page itself, as a printer's mark,
 * in the text's colour (ink by day, paper at night); the app's icons (public/) set the same drawing in a square.
 */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="8 24 80 44" aria-hidden="true" focusable="false">
      <path d="M22 58 Q48 10 74 58" stroke="currentColor" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        <path d="M35 41 V58" />
        <path d="M48 35 V58" />
        <path d="M61 41 V58" />
      </g>
      <path d="M12 60 H48" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      <path className="brand-mark-other" d="M48 60 H84" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}
