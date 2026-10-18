// Servos's icons, drawn from one SVG: the book that speaks (one solid open book, its left page written, two lines cut
// out of it, its right page spoken, three voice bars cut out of it), white on moss. The same path is in
// src/app/frame/BrandMark.tsx: change both.
//
// The icon is not the logo put in a square: it is the book on a full field of moss, about 55-60 % of the icon's width,
// so it sits inside the maskable safe circle (80 % of the width) and reads at 16 px as one silhouette.
//
// Writes public/icon-512.png, icon-192.png, favicon-64.png (in their rounded square, corners see-through),
// icon-maskable-512.png and apple-touch-icon.png (full bleed: the launcher or the phone cuts its own shape). From the
// repository's root:
//
//   playwright-cli -s=iconos open about:blank
//   playwright-cli -s=iconos --raw run-code --filename=design/logo/render-icons.js
async (page) => {
  const MOSS = '#3b6f30'
  const WHITE = '#ffffff'
  const BOOK =
    'M22.7 11.5Q16.49 8.5 6.3 8.5Q3.3 8.5 3.3 11.5V33.5Q3.3 36.5 6.3 36.5Q16.49 36.5 22.7 39.5Z' +
    'M25.3 11.5Q31.51 8.5 41.7 8.5Q44.7 8.5 44.7 11.5V33.5Q44.7 36.5 41.7 36.5Q31.51 36.5 25.3 39.5Z' +
    'M7.7 17H17.9V20.2H7.7ZM7.7 24H14.1V27.2H7.7Z' +
    'M28.1 18.8H31.3V28.8H28.1ZM33.7 14.8H36.9V32.8H33.7ZM39.3 17.8H42.5V29.8H39.3Z'
  // The book on a 48 grid, centred on (24, 24); `scale` of its 41.4 units of width.
  const book = (scale) =>
    `<g transform="translate(24 24) scale(${scale}) translate(-24 -24)"><path d="${BOOK}" fill="${WHITE}" fill-rule="evenodd"/></g>`
  // «any»: in the rounded square, the corners see-through; full bleed: the field to the edges.
  const any = (id, size) =>
    `<svg id="${id}" width="${size}" height="${size}" viewBox="0 0 48 48"><rect width="48" height="48" rx="10.5" fill="${MOSS}"/>${book(0.66)}</svg>`
  const bleed = (id, size, scale) =>
    `<svg id="${id}" width="${size}" height="${size}" viewBox="0 0 48 48"><rect width="48" height="48" fill="${MOSS}"/>${book(scale)}</svg>`
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:transparent;display:flex;flex-wrap:wrap;gap:8px;align-items:flex-start">` +
      any('any512', 512) + any('any192', 192) + any('fav64', 64) + bleed('mask512', 512, 0.6) + bleed('apple180', 180, 0.66) +
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
