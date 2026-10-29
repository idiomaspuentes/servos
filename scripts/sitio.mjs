/**
 * The site around the web app (`npm run build`, after `vite build` has put the app in `dist/app/`): the page that says
 * what Servos is, at `/`, and the guide, at `/docs/`, written in `sitio/<idioma>/`. Spanish is at the root; another
 * language is built under `/<idioma>/` as soon as its folder exists, with the same pages (`sitio/README.md`).
 *
 * A worker at the root keeps the site for reading without internet, as the app's own worker keeps the app under
 * `/app/`; it also takes the place of the app's old worker, from when the app was at the root (`sitio/sw.template.js`).
 *
 * No libraries: the guide is written in a small part of Markdown (headings, paragraphs, lists, bold, links, notes and
 * pictures), read here, so that translating it is writing text files.
 *
 * A language whose own pictures of the app are not taken yet shows the Spanish ones, and its chapters say so: taking
 * them again in every language is left until the app settles (decided with Abel, 28 October 2026). Its links to other
 * chapters are written as in Spanish (`/docs/otro/`) and lead to the same language.
 */

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SITE = join(HERE, 'sitio')
const OUT = join(HERE, 'dist')
const PUBLIC = join(HERE, 'public')
const FIRST = 'es'

if (!existsSync(join(OUT, 'app', 'index.html'))) {
  console.error('Falta la app en dist/app: primero `vite build`.')
  process.exit(1)
}

const written = []
function write(path, text) {
  const file = join(OUT, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, text)
  written.push(path)
}
function copy(from, path) {
  const file = join(OUT, path)
  mkdirSync(dirname(file), { recursive: true })
  copyFileSync(from, file)
  written.push(path)
}

// ── The site's own files: its sheet, its letters (only the Latin ones: the site is read, not typed in) and the mark ──

const FONTS = {
  'onest-latin.woff2': '@fontsource-variable/onest/files/onest-latin-wght-normal.woff2',
  'onest-latin-ext.woff2': '@fontsource-variable/onest/files/onest-latin-ext-wght-normal.woff2',
  'charis-latin-400.woff2': '@fontsource/charis-sil/files/charis-sil-latin-400-normal.woff2',
  'charis-latin-400-italic.woff2': '@fontsource/charis-sil/files/charis-sil-latin-400-italic.woff2',
  'charis-latin-700.woff2': '@fontsource/charis-sil/files/charis-sil-latin-700-normal.woff2',
}
for (const [name, from] of Object.entries(FONTS)) copy(join(HERE, 'node_modules', from), `sitio/letras/${name}`)
for (const f of ['icon.svg', 'favicon-32.png', 'apple-touch-icon.png']) copy(join(PUBLIC, f), `sitio/${f}`)
const sheet = readFileSync(join(SITE, 'estilo.css'), 'utf8')
const sheetName = `sitio/estilo-${hash(sheet)}.css`
write(sheetName, sheet)

// The mark, drawn in the page so it takes the colour of the theme: the book that speaks as the app draws it beside its
// name (`BrandMark.tsx`, its one source), not the tab's icon, which is the same book redrawn for 16 pixels.
const BOOK = [...readFileSync(join(HERE, 'src', 'app', 'frame', 'BrandMark.tsx'), 'utf8')
  .split('const BOOK_THAT_SPEAKS =')[1]
  .split('\n\n')[0]
  .matchAll(/'([^']+)'/g)]
  .map((m) => m[1])
  .join('')
if (!BOOK.startsWith('M')) throw new Error('No se encontró el dibujo de la marca en src/app/frame/BrandMark.tsx')
const MARK = `<svg class="marca" viewBox="3 8 42 32" aria-hidden="true"><path fill-rule="evenodd" d="${BOOK}"/></svg>`

// ── The languages ──

const languages = readdirSync(SITE).filter((d) => existsSync(join(SITE, d, 'sitio.json')))
languages.sort((a, b) => (a === FIRST ? -1 : b === FIRST ? 1 : a.localeCompare(b)))
const downloads = JSON.parse(readFileSync(join(SITE, 'descargas.json'), 'utf8'))

for (const lang of languages) {
  const root = lang === FIRST ? '/' : `/${lang}/`
  const t = JSON.parse(readFileSync(join(SITE, lang, 'sitio.json'), 'utf8'))
  const chapters = readdirSync(join(SITE, lang, 'docs'))
    .filter((f) => f.endsWith('.md'))
    .sort()
    .map((f) => readChapter(join(SITE, lang, 'docs', f), f.replace(/^\d+-/, '').replace(/\.md$/, '')))

  // The pictures of the guide, each language with its own (the app speaks it in them); one not taken yet in this
  // language is the Spanish one.
  const shots = join(SITE, lang, 'capturas')
  const own = new Set(existsSync(shots) ? readdirSync(shots) : [])
  for (const f of own) copy(join(shots, f), `${root.slice(1)}docs/capturas/${f}`)
  const shot = (name) => (own.has(name) ? `${root}docs/capturas/${name}` : `/docs/capturas/${name}`)

  const page = (path, title, body, { home = false } = {}) =>
    write(
      `${root.slice(1)}${path}index.html`,
      frame({ lang, t, root, path, title, body, home, languages })
    )

  page('', t.titulo, landing(t, root, chapters, shot), { home: true })
  page('docs/', t.guia.titulo, guideIndex(t, root, chapters))
  chapters.forEach((c, i) =>
    page(`docs/${c.slug}/`, `${c.title} · Servos`, chapter(t, root, chapters, i, shot, own))
  )
  if (lang === FIRST) {
    write('404.html', frame({ lang, t, root, path: '404', title: 'Servos', body: notFound(t, root), languages }))
  }
}

// ── The worker that keeps the site for reading offline ──

const kept = ['/', ...written.filter((p) => p !== '404.html').map((p) => '/' + p.replace(/index\.html$/, ''))]
const build = hash(
  kept
    .sort()
    .map((p) => p + hash(readFileSync(join(OUT, p.endsWith('/') ? p + 'index.html' : p))))
    .join('\n')
)
write(
  'sw.js',
  readFileSync(join(SITE, 'sw.template.js'), 'utf8')
    .replace('__BUILD__', build)
    .replace('__FILES__', JSON.stringify([...new Set(kept)], null, 2))
)

const size = written.reduce((n, p) => n + statSync(join(OUT, p)).size, 0)
console.log(`Sitio: ${written.length} archivos (${(size / 1e6).toFixed(1)} MB), idiomas: ${languages.join(', ')}`)

// ── Pages ──

function frame({ lang, t, root, path, title, body, home, languages: langs }) {
  // On a Spanish page, someone whose browser speaks another language the site has is told so in that language, with a
  // link to the same page there; nothing moves by itself.
  const offered =
    lang === FIRST && path !== '404'
      ? langs
          .filter((l) => l !== FIRST)
          .map((l) => {
            const said = JSON.parse(readFileSync(join(SITE, l, 'sitio.json'), 'utf8')).tambienEnSuIdioma
            return said ? `<p class="otro-idioma" lang="${l}" data-idioma="${l}" hidden><a href="/${l}/${path}">${said} →</a></p>` : ''
          })
          .join('')
      : ''
  const offer = offered
    ? `${offered}
<script>
for (const l of navigator.languages || [navigator.language]) {
  const code = String(l).slice(0, 2).toLowerCase()
  if (code === '${FIRST}') break
  const p = document.querySelector('.otro-idioma[data-idioma="' + code + '"]')
  if (p) { p.hidden = false; break }
}
</script>
`
    : ''
  const others = langs.length > 1
    ? `<nav class="idiomas" aria-label="${t.idiomas}">${langs
        .map((l) => {
          const r = l === FIRST ? '/' : `/${l}/`
          const name = JSON.parse(readFileSync(join(SITE, l, 'sitio.json'), 'utf8')).idioma
          return l === lang
            ? `<span aria-current="true">${name}</span>`
            : `<a href="${r}${path === '404' ? '' : path}" hreflang="${l}" lang="${l}">${name}</a>`
        })
        .join('')}</nav>`
    : ''
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(t.descripcion)}">
${path === '404' ? '' : langs.map((l) => `<link rel="alternate" hreflang="${l}" href="${l === FIRST ? '/' : `/${l}/`}${path}">\n`).join('')}<meta name="theme-color" content="#f7f2e8" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0c1316" media="(prefers-color-scheme: dark)">
<link rel="icon" type="image/png" sizes="32x32" href="/sitio/favicon-32.png">
<link rel="icon" type="image/svg+xml" href="/sitio/icon.svg">
<link rel="apple-touch-icon" href="/sitio/apple-touch-icon.png">
<link rel="preload" href="/sitio/letras/onest-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/${sheetName}">
${home ? `<script>
// Servos installed from here when the app lived at the root opens here: it goes on to the app.
if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) location.replace('/app/')
</script>
` : ''}<script>
if ('serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}))
</script>
</head>
<body${home ? ' class="inicio"' : ''}>
<header class="barra">
  <a class="nombre" href="${root}">${MARK}<span>Servos</span></a>
  <nav class="enlaces">
    <a href="${root}docs/"${path.startsWith('docs/') ? ' aria-current="page"' : ''}>${t.nav.guia}</a>
    <a class="abrir" href="/app/">${t.nav.abrir}</a>
  </nav>
</header>
${offer}<main>
${body}
</main>
<footer class="pie">
  ${others}
  <p>${t.pie}</p>
</footer>
</body>
</html>
`
}

function landing(t, root, chapters, shot) {
  const i = t.inicio
  const d = downloads.archivos
  const file = (key) => `${downloads.base}${d[key].archivo}`
  const pic = (name, alt, cls = '') => `<img class="${cls}" src="${shot(name)}" alt="${esc(alt)}" loading="lazy">`
  return `
<section class="portada">
  <div class="portada-texto">
    <h1>${i.titulo}</h1>
    <p class="entrada">${i.entrada}</p>
    <div class="acciones">
      <a class="boton lleno" href="/app/">${i.abrir} →</a>
      <a class="boton" href="#descargar">${i.descargar}</a>
    </div>
    <p class="nota-chica">${i.abrirNota}</p>
  </div>
  <figure class="telefono">${pic('estudio-palabra.webp', i.capturaAlt)}</figure>
</section>

<section class="tres">
  ${i.puntos.map((p) => `<div><h2>${p.titulo}</h2><p>${p.texto}</p></div>`).join('\n  ')}
</section>

<section class="pasos">
  <h2>${i.pasosTitulo}</h2>
  <p class="entrada-chica">${i.pasosEntrada}</p>
  <ol>
    ${i.pasos.map((p) => `<li><strong>${p.titulo}</strong> ${p.texto}</li>`).join('\n    ')}
  </ol>
  <figure class="ancha">${pic('computadora-editor.webp', i.capturaAnchaAlt)}<figcaption>${i.capturaAnchaPie}</figcaption></figure>
</section>

<section class="descargas" id="descargar">
  <h2>${i.descargasTitulo}</h2>
  <p class="entrada-chica">${i.descargasEntrada.replace('{version}', downloads.version)}</p>
  <div class="tarjetas">
    ${i.descargas
      .map(
        (x) => `<div class="tarjeta">
      <h3>${x.titulo}</h3>
      <p>${x.texto}</p>
      ${x.archivos
        .map((k) => `<a class="boton" href="${file(k)}" download>${i.archivo[k]} <span>${d[k].tamano}</span></a><small class="archivo">${d[k].archivo}</small>`)
        .join('\n      ')}
      ${x.guia ? `<a class="seguir" href="${root}docs/${x.guia}/">${x.guiaTexto} →</a>` : ''}
    </div>`
      )
      .join('\n    ')}
  </div>
  <p class="nota-chica">${i.libros}</p>
</section>

<section class="guia-corta">
  <h2>${t.guia.titulo}</h2>
  <p class="entrada-chica">${t.guia.entrada}</p>
  ${chapterList(root, chapters)}
</section>
`
}

function guideIndex(t, root, chapters) {
  return `
<article class="texto">
  <h1>${t.guia.titulo}</h1>
  <p class="entrada">${t.guia.entrada}</p>
  ${chapterList(root, chapters)}
</article>
`
}

function chapterList(root, chapters) {
  return `<ol class="capitulos">
    ${chapters
      .map((c) => `<li><a href="${root}docs/${c.slug}/"><strong>${c.title}</strong><span>${c.summary}</span></a></li>`)
      .join('\n    ')}
  </ol>`
}

function chapter(t, root, chapters, i, shot, own) {
  const c = chapters[i]
  const prev = chapters[i - 1]
  const next = chapters[i + 1]
  const html = markdown(c.body, shot, root)
  // Its pictures show the app in another language: said once, before them.
  const borrowed = [...c.body.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)].some((m) => !own.has(m[1]))
  const note = borrowed && t.guia.capturasDeOtroIdioma ? `<p class="nota-chica">${t.guia.capturasDeOtroIdioma}</p>` : ''
  const toc = c.sections.length > 2
    ? `<nav class="indice" aria-label="${t.guia.enEsta}"><p>${t.guia.enEsta}</p><ul>${c.sections
        .map((s) => `<li><a href="#${s.id}">${s.text}</a></li>`)
        .join('')}</ul></nav>`
    : ''
  return `
<div class="guia">
  <nav class="lado" aria-label="${t.guia.titulo}">
    <a class="lado-titulo" href="${root}docs/">${t.guia.titulo}</a>
    <ol>${chapters
      .map((x) => `<li><a href="${root}docs/${x.slug}/"${x === c ? ' aria-current="page"' : ''}>${x.title}</a></li>`)
      .join('')}</ol>
  </nav>
  <article class="texto">
    <p class="miga"><a href="${root}docs/">${t.guia.titulo}</a> · ${t.guia.capitulo.replace('{n}', i + 1).replace('{total}', chapters.length)}</p>
    <h1>${c.title}</h1>
    <p class="entrada">${c.summary}</p>
    ${toc}
    ${note}
    ${html}
    <nav class="seguir-leyendo">
      ${prev ? `<a class="boton" href="${root}docs/${prev.slug}/">← ${prev.title}</a>` : '<span></span>'}
      ${next ? `<a class="boton lleno" href="${root}docs/${next.slug}/">${next.title} →</a>` : `<a class="boton lleno" href="/app/">${t.nav.abrir} →</a>`}
    </nav>
  </article>
</div>
`
}

function notFound(t, root) {
  return `
<article class="texto">
  <h1>${t.noEsta.titulo}</h1>
  <p class="entrada">${t.noEsta.texto}</p>
  <p><a class="boton lleno" href="${root}">${t.noEsta.inicio}</a> <a class="boton" href="/app/">${t.nav.abrir}</a></p>
</article>
`
}

// ── The guide's chapters: a title, a summary, and Markdown ──

function readChapter(file, slug) {
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n')
  const m = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!m) throw new Error(`${relative(HERE, file)}: falta el encabezado (---)`)
  const meta = Object.fromEntries(
    m[1].split('\n').map((l) => [l.slice(0, l.indexOf(':')).trim(), l.slice(l.indexOf(':') + 1).trim()])
  )
  const body = text.slice(m[0].length)
  const sections = [...body.matchAll(/^## (.+)$/gm)].map((h) => ({ text: inline(h[1]), id: anchor(h[1]) }))
  return { slug, title: meta.titulo, summary: inline(meta.resumen ?? ''), body, sections }
}

/**
 * The part of Markdown the guide uses. Pictures alone in a paragraph become figures, side by side when several; `shot`
 * says where each picture is. Links to the guide (`/docs/…`) go to the guide in the page's language (`root`).
 */
function markdown(text, shot, root = '/') {
  const out = []
  const blocks = text.trim().split(/\n{2,}/)
  for (const block of blocks) {
    const lines = block.split('\n')
    if (/^#{2,3} /.test(block)) {
      const level = block.startsWith('### ') ? 3 : 2
      const title = block.replace(/^#+ /, '')
      out.push(`<h${level} id="${anchor(title)}">${inline(title, root)}</h${level}>`)
    } else if (lines.every((l) => /^\s*!\[/.test(l))) {
      const figs = lines.map((l) => {
        const [, alt, src, caption] = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/.exec(l)
        const wide = src.startsWith('computadora-')
        return `<figure class="${wide ? 'ancha' : 'telefono'}"><img src="${shot(src)}" alt="${esc(alt)}" loading="lazy">${caption ? `<figcaption>${inline(caption, root)}</figcaption>` : ''}</figure>`
      })
      out.push(figs.length > 1 ? `<div class="tira">${figs.join('')}</div>` : figs[0])
    } else if (lines.every((l) => /^- /.test(l) || /^ {2}/.test(l))) {
      out.push(`<ul>${items(lines, /^- /, root)}</ul>`)
    } else if (/^\d+\. /.test(lines[0])) {
      out.push(`<ol>${items(lines, /^\d+\. /, root)}</ol>`)
    } else if (lines.every((l) => l.startsWith('>'))) {
      out.push(`<aside class="aviso">${markdown(lines.map((l) => l.replace(/^> ?/, '')).join('\n'), shot, root)}</aside>`)
    } else {
      out.push(`<p>${inline(lines.join(' '), root)}</p>`)
    }
  }
  return out.join('\n')
}

function items(lines, marker, root) {
  const list = []
  for (const l of lines) {
    if (marker.test(l)) list.push(l.replace(marker, ''))
    else list[list.length - 1] += ' ' + l.trim()
  }
  return list.map((x) => `<li>${inline(x, root)}</li>`).join('')
}

function inline(s, root = '/') {
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => `<a href="${href.startsWith('/docs/') ? root + href.slice(1) : href}">${label}</a>`)
}

function anchor(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function hash(text) {
  return createHash('sha1').update(text).digest('hex').slice(0, 10)
}
