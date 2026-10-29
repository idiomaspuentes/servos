/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { configDefaults } from 'vitest/config'
import { btSynergyRoot } from './scripts/btSynergy.ts'

/**
 * bt-synergy lives next to this repository (`../bt-synergy`) unless `SERVOS_BT_SYNERGY` names another checkout, as
 * usfm-ast lives next to Taller. Its packages are used from their sources, the way tc-study uses them, so Servos and
 * tc-study read and write resources with the very same code. `bt-synergy.ref` pins the commit Servos was tested with;
 * `scripts/btSynergy.test.ts` fails when the checkout in use does not contain it. Their types are declared in
 * `src/resources/btSynergy.d.ts`.
 */
const BT = join(btSynergyRoot(dirname(fileURLToPath(import.meta.url))), 'packages')

/**
 * usfm-ast lives next to it too (`../usfm-ast`, as for Taller): the alignment is Taller's, its box model and the way
 * it keeps links when a verse's text changes. Only those files are read: `@usfm-tools/editor-core` is a small door
 * (`src/alignment/editorCore.ts`) to them, not the whole editor, which brings git and an XML parser with it.
 */
const USFM_AST = resolve(dirname(fileURLToPath(import.meta.url)), '../usfm-ast/packages')
const HERE = dirname(fileURLToPath(import.meta.url))

/**
 * The app kept whole on the phone (`offline/sw.template.js`): the service worker is written with every file this
 * build made, and a name for the build drawn from them, so a new build is a new worker the phone notices.
 */
function offlineShell(): Plugin {
  const publicDir = resolve(HERE, 'public')
  return {
    name: 'servos-offline-shell',
    apply: 'build',
    enforce: 'post',
    generateBundle(_, bundle) {
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'index.html' && f !== 'sw.js')
      const kept = readdirSync(publicDir)
      const files = ['./', ...built, ...kept].map((f) => (f === './' ? f : `./${f}`))
      const hash = createHash('sha1')
      for (const f of built.sort()) hash.update(f)
      for (const f of kept.sort()) hash.update(f).update(readFileSync(resolve(publicDir, f)))
      const build = hash.digest('hex').slice(0, 12)
      const source = readFileSync(resolve(HERE, 'offline/sw.template.js'), 'utf8')
        .replace('__BUILD__', build)
        .replace('__FILES__', JSON.stringify(files, null, 2))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

/**
 * The app for phones is not drawn under Android's bars: without `viewport-fit=cover`, Capacitor keeps the page between
 * the status bar and the buttons (or the keyboard) itself, on every screen, whatever the WebView's version. With it, a
 * WebView from 140 on draws the page under them and every footer would have to leave the room by itself.
 */
/**
 * The language packs inside the apps for phones and computers (`src/app/projects/packsInside.ts` opens them the first
 * time the app starts): every `*.langpack.zip` of `SERVOS_PAQUETES_DENTRO`, or of `paquetes-dentro/` beside this file
 * (not in the repository: the packs are made with bt-synergy's `prepare-language`). They go in `paquetes/`, the
 * originals first, with an index naming each by what it holds. Without packs the app is built as before, and says so.
 */
function packsInside(): Plugin {
  const folder = resolve(process.env.SERVOS_PAQUETES_DENTRO || join(HERE, 'paquetes-dentro'))
  return {
    name: 'servos-packs-inside',
    apply: 'build',
    generateBundle() {
      const files = existsSync(folder)
        ? readdirSync(folder)
            .filter((f) => f.endsWith('.langpack.zip'))
            .sort((a, b) => Number(!a.startsWith('originals')) - Number(!b.startsWith('originals')) || a.localeCompare(b))
        : []
      if (!files.length) this.warn(`No language packs in ${folder}: the app is built without texts and helps inside it`)
      const packs = files.map((file) => {
        const bytes = readFileSync(join(folder, file))
        this.emitFile({ type: 'asset', fileName: `paquetes/${file}`, source: bytes })
        return { file, id: createHash('sha1').update(bytes).digest('hex').slice(0, 16) }
      })
      this.emitFile({ type: 'asset', fileName: 'paquetes/index.json', source: JSON.stringify({ packs }) })
    },
  }
}

function insideTheBars(): Plugin {
  return {
    name: 'servos-inside-the-bars',
    transformIndexHtml: (html) => html.replace(', viewport-fit=cover', ''),
  }
}

/** The commit the app is built from, with a mark when there were changes not yet committed. */
function buildOf(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { cwd: HERE }).toString().trim()
    const dirty = execSync('git status --porcelain --untracked-files=no', { cwd: HERE }).toString().trim() !== ''
    return dirty ? `${sha}+` : sha
  } catch {
    return 'sin-git'
  }
}
const VERSION = (JSON.parse(readFileSync(resolve(HERE, 'package.json'), 'utf8')) as { version: string }).version

// `vite build --mode pagina`: one self-contained HTML file, to share the prototype as a single page.
// `vite build --mode escritorio`: the app for computers (Tauri, `src-tauri`). It is kept whole inside the program, so it
// opens without internet from the first time and has no service worker; it is built in a folder of its own, so that it
// is never put online as the web app, which without its worker would not open offline.
// `vite build --mode telefono`: the app for phones (Capacitor, `android/`), kept whole inside the app in the same way.
// The web app is put online under `/app/`, beside the site that presents it (`sitio/`, built into `dist/` around it by
// `scripts/sitio.mjs`), and `vite preview` serves it there; the apps for computers and phones, and the dev server
// (Tauri's `devUrl`), keep it at the root.
const INSIDE: Record<string, string> = { escritorio: 'dist-escritorio', telefono: 'dist-telefono' }
export default defineConfig(({ command, isPreview, mode }) => ({
  base: (command === 'build' || isPreview) && !(mode in INSIDE) && mode !== 'pagina' ? '/app/' : '/',
  define: { __APP_VERSION__: JSON.stringify(VERSION), __APP_BUILD__: JSON.stringify(buildOf()) },
  plugins:
    mode === 'pagina'
      ? [react(), viteSingleFile()]
      : mode === 'telefono'
        ? [react(), insideTheBars(), packsInside()]
        : mode in INSIDE
          ? [react(), packsInside()]
          : [react(), offlineShell()],
  // The single page carries its letters inside it (it has no files beside it).
  build:
    mode === 'pagina'
      ? { assetsInlineLimit: 1_000_000 }
      : mode in INSIDE
        ? { outDir: INSIDE[mode] }
        : { outDir: 'dist/app' },
  resolve: {
    alias: [
      { find: /^@bt-synergy\/catalog-manager\/core$/, replacement: `${BT}/catalog-manager/src/core.ts` },
      { find: /^@bt-synergy\/([^/]+)\/(.+)$/, replacement: `${BT}/$1/src/$2` },
      { find: /^@bt-synergy\/([^/]+)$/, replacement: `${BT}/$1/src/index.ts` },
      { find: /^@usfm-ast\/alignment-box-model$/, replacement: `${USFM_AST}/usfm-editor-app/src/hooks/useAlignmentBoxModel.ts` },
      { find: /^@usfm-tools\/editor-core$/, replacement: `${HERE}/src/alignment/editorCore.ts` },
      { find: /^@usfm-tools\/types$/, replacement: `${USFM_AST}/shared-types/src/index.ts` },
      { find: /^@usfm-tools\/usj-core$/, replacement: `${USFM_AST}/usfm-usj-core/src/index.ts` },
      { find: /^usfm-ast\/(.+)$/, replacement: `${USFM_AST}/$1` },
    ],
    // Some bt-synergy packages keep old compiled `.js` files beside their `.ts` sources (cache-adapter-indexeddb);
    // the sources must win.
    extensions: ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json'],
  },
  // Other sessions' working copies (.claude/worktrees) are not this app: watched or scanned, they hung Taller's dev
  // servers (its commit a6874a0).
  server: { fs: { allow: ['.', BT, USFM_AST] }, watch: { ignored: ['**/.claude/**'] } },
  optimizeDeps: { entries: ['index.html'] },
  test: {
    environment: 'node',
    // Other sessions' working copies have their own tests (one of them writes files).
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
}))
