/**
 * The guide's pictures (`sitio/<idioma>/capturas/`), taken from the app itself as the guide walks through it: on a
 * phone (375 px) and on a computer (1280 × 800). Run again when a screen changes, or for another language:
 *
 *   npm run build && npx vite preview --port 4173 --strictPort
 *   SERVOS_PAQUETES=<carpeta con originals.langpack.zip y es-419.langpack.zip> \
 *     npx -y -p playwright@1.62.1 node scripts/capturas-guia.mjs [es|pt|en]
 *
 * (`npx playwright install chromium` once, if Playwright has no browser yet.) Each run starts from an empty app, so it
 * shows what a person sees the first time; the example team («Ver el ejemplo como Ana») gives the screens with work.
 * Pictures are written as WebP by the browser itself, so no other tool is needed.
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(join(process.cwd(), 'package.json'))
const { chromium } = require('playwright')

const HERE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LANG = process.argv[2] ?? 'es'
const APP = process.env.SERVOS_URL ?? 'http://localhost:4173/app/'
const PACKS = process.env.SERVOS_PAQUETES
if (!PACKS) throw new Error('Falta SERVOS_PAQUETES: la carpeta con originals.langpack.zip y es-419.langpack.zip')
const OUT = join(HERE, 'sitio', LANG, 'capturas')
mkdirSync(OUT, { recursive: true })

// What the app says, in each language, where the walk has to find a button by its words.
const SAYS = {
  es: {
    idioma: 'Español', empezar: /Empezar/, menu: 'Recibir textos y ayudas', abrirPaquete: 'Abrir el paquete',
    listo: /^Listo\./, volver: /Volver/, agregarProyecto: /Agregar un proyecto/, nuevaBiblia: 'Nueva Biblia',
    crearBiblia: 'Crear la Biblia', agregarLibro: /Agregar un libro/, enBlanco: 'Empezar un libro en blanco',
    jonas: 'Jonás', crearJonas: 'Crear Jonás', siguiente: 'Sección siguiente', seccion1: /sección 1 de/,
    palabra: 'palabra', volverA: /Volver a/, traduccion: 'Traducción', pasarA: /Pasar a Traducción/,
    empezarOContinuar: /Empezar|Continuar/, ejemplo: /Ver el ejemplo/, tito: 'Tito', mas: 'Más',
    recibirTrabajo: /Recibir trabajo/, trabajoDe: (n) => `Trabajo de ${n}: Tito`, recibir: /^Recibir$/,
    juntar: /^Juntar/, tpl: 'TPL', ayudas: 'Ayudas', revision: 'Revisión', yaLoLei: /Ya lo leí/,
    compartir: 'Compartir este libro', publicar: 'Publicar', vincular: /Vincular mi cuenta/,
  },
}
const s = SAYS[LANG]
if (!s) throw new Error(`Faltan las palabras de la app en «${LANG}» (SAYS)`)

const ONLY = process.env.SERVOS_SOLO // «primera», «ejemplo» or «computadora»: only that part
const part = (name) => !ONLY || ONLY === name
const browser = await chromium.launch()

async function open(wide) {
  const context = await browser.newContext({
    viewport: wide ? { width: 1280, height: 800 } : { width: 375, height: 760 },
    deviceScaleFactor: wide ? 1.5 : 2,
    isMobile: !wide,
    hasTouch: !wide,
    colorScheme: 'light',
    locale: LANG,
  })
  const page = await context.newPage()
  page.on('pageerror', (e) => console.log('Error en la página:', e.message))
  await page.goto(APP)
  await page.waitForLoadState('networkidle')
  return page
}

async function shot(page, name) {
  await page.waitForTimeout(500)
  const png = (await page.screenshot()).toString('base64')
  // The browser writes the WebP: a page of its own draws the picture and encodes it.
  const webp = await page.evaluate(async (data) => {
    const img = new Image()
    img.src = `data:image/png;base64,${data}`
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d').drawImage(img, 0, 0)
    return canvas.toDataURL('image/webp', 0.86).split(',')[1]
  }, png)
  writeFileSync(join(OUT, `${name}.webp`), Buffer.from(webp, 'base64'))
  console.log(`  ${name}.webp`)
}

const click = async (page, locator, wait = 800) => {
  await locator.first().click()
  await page.waitForTimeout(wait)
}
const button = (page, name) => page.getByRole('button', { name })
const text = (page, words) => page.getByText(words, { exact: true })

async function receivePacks(page, who, pictures) {
  for (const pack of ['originals', 'es-419']) {
    await click(page, button(page, new RegExp(who)), 400)
    if (pictures && pack === 'originals') await shot(page, 'menu')
    await click(page, page.getByText(s.menu))
    await page.locator('input[type=file]').setInputFiles(join(PACKS, `${pack}.langpack.zip`))
    await button(page, s.abrirPaquete).waitFor({ timeout: 60_000 })
    if (pictures && pack === 'es-419') await shot(page, 'paquete-es')
    await click(page, button(page, s.abrirPaquete))
    await page.getByText(s.listo).waitFor({ timeout: 300_000 })
    if (pictures && pack === 'es-419') await shot(page, 'paquete-listo')
    await click(page, button(page, s.volver))
  }
}

async function openBook(page, book) {
  await page.goto(APP)
  await page.waitForTimeout(1500)
  await click(page, text(page, book), 2000)
}

async function receiveWork(page, who) {
  await openBook(page, s.tito)
  await click(page, button(page, s.mas), 500)
  await click(page, page.getByText(s.recibirTrabajo))
  await click(page, page.getByText(s.trabajoDe(who)), 1500)
}

// ── A new team, the first time ──
console.log('La primera vez')
if (part('primera')) {
  const page = await open(false)
  await click(page, text(page, s.idioma), 300)
  await page.getByRole('textbox').first().fill('Rosa')
  await shot(page, 'bienvenida')
  await click(page, button(page, s.empezar), 1500)
  await receivePacks(page, 'Rosa', true)
  await click(page, button(page, s.agregarProyecto), 600)
  await shot(page, 'agregar-proyecto')
  await click(page, page.getByText(s.nuevaBiblia))
  await page.locator('input[type=search]').fill('ayacucho')
  await page.waitForTimeout(800)
  await click(page, page.getByText('Ayacucho Quechua'))
  await shot(page, 'nueva-biblia')
  await click(page, button(page, s.crearBiblia), 1200)
  await click(page, page.getByText(s.enBlanco))
  await click(page, text(page, s.jonas))
  await shot(page, 'elegir-libro')
  await click(page, button(page, s.crearJonas), 4000)
  await shot(page, 'libro')
  await click(page, button(page, s.empezarOContinuar), 3000)
  for (let i = 0; i < 4 && !(await page.getByText(s.seccion1).count()); i++) await click(page, button(page, s.siguiente), 1500)
  await shot(page, 'estudio-seccion')
  await click(page, button(page, s.palabra).filter({ hasText: new RegExp(`^${s.palabra}$`) }), 1500)
  await shot(page, 'estudio-palabra')
  await click(page, button(page, s.volverA), 1500)
  await click(page, text(page, s.traduccion), 1000)
  await click(page, button(page, s.pasarA), 1500)
  await click(page, button(page, s.empezarOContinuar), 3500)
  await shot(page, 'editor-vacio')
  await page.context().close()
}

// ── The example team, with work done ──
console.log('El equipo del ejemplo')
if (part('ejemplo')) {
  const page = await open(false)
  await click(page, button(page, s.ejemplo), 3000)
  await receivePacks(page, 'Ana', false)
  await receiveWork(page, 'Bea')
  await click(page, button(page, s.recibir), 2000)
  await receiveWork(page, 'Carlos')
  await shot(page, 'recibir')
  await click(page, button(page, s.recibir), 2000)
  await shot(page, 'recibido')
  await openBook(page, s.tito)
  await click(page, button(page, s.juntar), 2000)
  await shot(page, 'juntar')
  await openBook(page, s.tito)
  await click(page, button(page, s.empezarOContinuar), 3500)
  await shot(page, 'editor-con-texto')
  await click(page, text(page, s.tpl), 1200)
  await shot(page, 'editor-tpl')
  await click(page, text(page, s.ayudas), 1200)
  await shot(page, 'editor-ayudas')
  await openBook(page, s.tito)
  await click(page, text(page, s.revision), 1500)
  await shot(page, 'revision')
  await click(page, button(page, s.empezarOContinuar), 3500)
  await shot(page, 'revisar-leer')
  await click(page, button(page, s.yaLoLei), 1500)
  await shot(page, 'revisar-entender')
  await openBook(page, s.tito)
  await click(page, button(page, s.mas), 500)
  await click(page, page.getByText(s.compartir), 1200)
  await shot(page, 'compartir')
  await openBook(page, s.tito)
  await click(page, text(page, s.publicar), 1200)
  await click(page, button(page, s.empezarOContinuar), 2500)
  await shot(page, 'door43')
  await click(page, button(page, s.vincular), 1500)
  await shot(page, 'door43-cuenta')
  await page.context().close()
}

// ── On a computer ──
console.log('En la computadora')
if (part('computadora')) {
  const page = await open(true)
  await click(page, button(page, s.ejemplo), 3000)
  await receivePacks(page, 'Ana', false)
  for (const who of ['Bea', 'Carlos']) {
    await receiveWork(page, who)
    await click(page, button(page, s.recibir), 2000)
  }
  await openBook(page, s.tito)
  await click(page, button(page, s.empezarOContinuar), 3500)
  await shot(page, 'computadora-editor')
  await page.context().close()
}

await browser.close()
