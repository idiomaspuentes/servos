/**
 * Servos's mark, drawn here so it needs no file (the page shared inside Claude has none): a bridge, its arch over a deck
 * that crosses from one bank to the other; the deck is a line of text that starts in one language (paper) and ends in
 * the other (ochre). The bridge text, and Idiomas Puentes. The app's icons (public/) are the same drawing.
 */
export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 96 96" aria-hidden="true" focusable="false">
      <rect width="96" height="96" rx="22" fill="#17384a" />
      <path d="M22 58 Q48 10 74 58" stroke="#f6f1e7" strokeWidth="5.5" strokeLinecap="round" fill="none" />
      <g stroke="#f6f1e7" strokeWidth="2.6" strokeLinecap="round">
        <path d="M35 41 V58" />
        <path d="M48 35 V58" />
        <path d="M61 41 V58" />
      </g>
      <path d="M12 60 H48" stroke="#f6f1e7" strokeWidth="6" strokeLinecap="round" />
      <path d="M48 60 H84" stroke="#e0a83a" strokeWidth="6" strokeLinecap="round" />
    </svg>
  )
}
