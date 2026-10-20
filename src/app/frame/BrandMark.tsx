/**
 * Servos's mark, drawn here so it needs no file (the page shared inside Claude has none): the book that speaks, one
 * solid open book in one colour, its left page written (two lines cut out of it) and its right page spoken (three
 * voice bars cut out of it). Translating, written and by voice. Every cut is as wide as the others and square-ended,
 * as the interface's letters' strokes are; the shape is one path with holes, so it stays one silhouette at 16 px. It takes the
 * accent's colour (moss by day, light moss by night). The app's icons (public/) are the same book, white on moss,
 * drawn by design/logo/render-icons.js from the same path: change both. The browser tab's icon is this book redrawn
 * on a 16 grid (MICRO there), so a change here is redrawn there too.
 */
const BOOK_THAT_SPEAKS =
  'M22.7 11.5Q16.49 8.5 6.3 8.5Q3.3 8.5 3.3 11.5V33.5Q3.3 36.5 6.3 36.5Q16.49 36.5 22.7 39.5Z' +
  'M25.3 11.5Q31.51 8.5 41.7 8.5Q44.7 8.5 44.7 11.5V33.5Q44.7 36.5 41.7 36.5Q31.51 36.5 25.3 39.5Z' +
  'M7.7 17H17.9V20.2H7.7ZM7.7 24H14.1V27.2H7.7Z' +
  'M28.1 18.8H31.3V28.8H28.1ZM33.7 14.8H36.9V32.8H33.7ZM39.3 17.8H42.5V29.8H39.3Z'

export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="3 8 42 32" aria-hidden="true" focusable="false">
      <path d={BOOK_THAT_SPEAKS} fill="currentColor" fillRule="evenodd" />
    </svg>
  )
}
