// Servos's icons, drawn from one SVG: the book that speaks (one solid open book, its left page written, two lines cut
// out of it, its right page spoken, three voice bars cut out of it), white on moss. The same path is in
// src/app/frame/BrandMark.tsx: change both.
//
// The icon is not the logo put in a square: it is the book on a full field of moss, about 55-60 % of the icon's width,
// so it sits inside the maskable safe circle (80 % of the width) and reads at 16 px as one silhouette.
//
// The browser tab's icon is the book alone, in the moss, the way it stands beside «Servos» in the app. At 16 px the
// book's cuts would be a third of a pixel wide and fall between pixels, so the tab has its own drawing (MICRO), the
// same book redrawn on a 16 grid with every edge on a whole pixel. Change it with the book.
//
// Writes, in public/:
//   icon-512.png, icon-192.png, favicon-64.png  in their rounded square, corners see-through (favicon-64 is not
//                                                linked: a browser that takes a PNG would put the square in the tab);
//   icon-maskable-512.png, apple-touch-icon.png  full bleed: the launcher or the phone cuts its own shape;
//   icon-monochrome-512.png                      Android's themed icon: the book alone in one colour on nothing, the
//                                                cuts as holes, as small as the maskable one; the launcher paints it;
//   icon.svg                                     the tab's icon, MICRO in moss, light moss in a dark browser;
//   favicon-32.png                               the same, each pixel doubled, for browsers that take no SVG.
// From the repository's root:
//
//   playwright-cli -s=iconos open about:blank
//   playwright-cli -s=iconos --raw run-code --filename=design/logo/render-icons.js
async (page) => {
  const MOSS = '#3b6f30'
  const MOSS_NIGHT = '#98cf8b'
  const WHITE = '#ffffff'
  const BLACK = '#000000'
  const BOOK =
    'M22.7 11.5Q16.49 8.5 6.3 8.5Q3.3 8.5 3.3 11.5V33.5Q3.3 36.5 6.3 36.5Q16.49 36.5 22.7 39.5Z' +
    'M25.3 11.5Q31.51 8.5 41.7 8.5Q44.7 8.5 44.7 11.5V33.5Q44.7 36.5 41.7 36.5Q31.51 36.5 25.3 39.5Z' +
    'M7.7 17H17.9V20.2H7.7ZM7.7 24H14.1V27.2H7.7Z' +
    'M28.1 18.8H31.3V28.8H28.1ZM33.7 14.8H36.9V32.8H33.7ZM39.3 17.8H42.5V29.8H39.3Z'
  // The book on a 16 grid, for 16 px: two pages 7 px wide and 11 px tall with a 1 px spine between them, each 1 px
  // lower for its last 2 px at the spine (the pages' curve), outer corners rounded by 1 px; two text lines (5 and 3 px)
  // and three voice bars (4, 8 and 6 px), each 1 px thick with at least 1 px of page around it, where the big book has
  // them. 15 px wide, it sits half a pixel left of centre: centred, every edge would fall between two pixels.
  const MICRO =
    'M0 3A1 1 0 0 1 1 2H5V3H7V14H5V13H1A1 1 0 0 1 0 12Z' +
    'M15 3A1 1 0 0 0 14 2H10V3H8V14H10V13H14A1 1 0 0 0 15 12Z' +
    'M1 5H6V6H1ZM1 8H4V9H1Z' +
    'M9 6H10V10H9ZM11 4H12V12H11ZM13 5H14V11H13Z'
  // The book on a 48 grid, centred on (24, 24); `scale` of its 41.4 units of width.
  const book = (scale, fill = WHITE) =>
    `<g transform="translate(24 24) scale(${scale}) translate(-24 -24)"><path d="${BOOK}" fill="${fill}" fill-rule="evenodd"/></g>`
  // «any»: in the rounded square, the corners see-through; full bleed: the field to the edges.
  const any = (id, size) =>
    `<svg id="${id}" width="${size}" height="${size}" viewBox="0 0 48 48"><rect width="48" height="48" rx="10.5" fill="${MOSS}"/>${book(0.66)}</svg>`
  const bleed = (id, size, scale) =>
    `<svg id="${id}" width="${size}" height="${size}" viewBox="0 0 48 48"><rect width="48" height="48" fill="${MOSS}"/>${book(scale)}</svg>`
  const mono = (id, size) => `<svg id="${id}" width="${size}" height="${size}" viewBox="0 0 48 48">${book(0.6, BLACK)}</svg>`
  const micro = (id, size) =>
    `<svg id="${id}" width="${size}" height="${size}" viewBox="0 0 16 16"><path d="${MICRO}" fill="${MOSS}" fill-rule="evenodd"/></svg>`
  const tabSvg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><style>path{fill:${MOSS}}` +
    `@media (prefers-color-scheme:dark){path{fill:${MOSS_NIGHT}}}</style>` +
    `<path fill-rule="evenodd" d="${MICRO}"/></svg>\n`
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">` +
      any('any512', 512) + any('any192', 192) + any('fav64', 64) + bleed('mask512', 512, 0.6) + bleed('apple180', 180, 0.66) +
      mono('mono512', 512) + micro('fav32', 32) +
      `<a id="tabsvg" download="icon.svg" href="data:image/svg+xml;charset=utf-8,${encodeURIComponent(tabSvg)}">icon.svg</a>` +
      `</body></html>`
  )
  const shots = [
    ['#any512', 'public/icon-512.png'],
    ['#any192', 'public/icon-192.png'],
    ['#fav64', 'public/favicon-64.png'],
    ['#mask512', 'public/icon-maskable-512.png'],
    ['#apple180', 'public/apple-touch-icon.png'],
    ['#mono512', 'public/icon-monochrome-512.png'],
    ['#fav32', 'public/favicon-32.png'],
  ]
  for (const [selector, path] of shots) await page.locator(selector).screenshot({ path, omitBackground: true })
  // A page cannot write a file, but it can hand one down.
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#tabsvg')])
  await download.saveAs('public/icon.svg')
  return [...shots.map(([, path]) => path), 'public/icon.svg'].join(', ')
}
