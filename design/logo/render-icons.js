// Servos's icons, drawn from one SVG: the book that speaks (an open book, its left page written in one language, its
// right page said aloud in another, a voice in ochre). The same drawing is in src/app/frame/BrandMark.tsx: change both.
//
// Writes public/icon-512.png, icon-192.png, favicon-64.png (in their rounded square, corners see-through),
// icon-maskable-512.png and apple-touch-icon.png (full bleed, the book inside the safe circle). From the repository's
// root:
//
//   playwright-cli -s=iconos open about:blank
//   playwright-cli -s=iconos --raw run-code --filename=design/logo/render-icons.js
async (page) => {
  const INK = '#17496a'
  const PAPER = '#f6f1e7'
  const OCHRE = '#d39a2c'
  const book = `
    <path d="M46.9 32 Q36 24.8 20.4 28.4 L20.4 71.6 Q36 68 46.9 75.2 Z" fill="${PAPER}"/>
    <path d="M49.1 32 Q60 24.8 75.6 28.4 L75.6 71.6 Q60 68 49.1 75.2 Z" fill="${PAPER}"/>
    <g stroke="${INK}" stroke-opacity="0.45" stroke-width="2.3" stroke-linecap="round" fill="none">
      <path d="M25.2 38.3 Q34.8 35.6 43.2 40.4"/><path d="M25.2 46.1 Q34.8 43.4 43.2 48.2"/>
      <path d="M25.2 53.9 Q34.8 51.2 43.2 56"/><path d="M25.2 61.7 Q34.8 59 43.2 63.8"/>
    </g>
    <g stroke="${OCHRE}" stroke-width="3" stroke-linecap="round">
      <path d="M54 49 V58"/><path d="M58.5 43 V64"/><path d="M63 46.5 V60.5"/><path d="M67.5 41 V66"/><path d="M72 48 V59"/>
    </g>`
  // «any»: in the rounded square; full bleed: the square to the edges, the book a little smaller, around its centre.
  const any = (id, size) =>
    `<svg id="${id}" width="${size}" height="${size}" viewBox="0 0 96 96"><rect width="96" height="96" rx="21" fill="${INK}"/>${book}</svg>`
  const bleed = (id, size, scale) =>
    `<svg id="${id}" width="${size}" height="${size}" viewBox="0 0 96 96"><rect width="96" height="96" fill="${INK}"/>` +
    `<g transform="translate(48 51.8) scale(${scale}) translate(-48 -51.8)">${book}</g></svg>`
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">` +
      any('any512', 512) + any('any192', 192) + any('fav64', 64) + bleed('mask512', 512, 0.8) + bleed('apple180', 180, 0.9) +
      `</body></html>`
  )
  const shots = [
    ['#any512', 'public/icon-512.png'],
    ['#any192', 'public/icon-192.png'],
    ['#fav64', 'public/favicon-64.png'],
    ['#mask512', 'public/icon-maskable-512.png'],
    ['#apple180', 'public/apple-touch-icon.png'],
  ]
  for (const [selector, path] of shots) await page.locator(selector).screenshot({ path, omitBackground: true })
  return shots.map(([, path]) => path).join(', ')
}
