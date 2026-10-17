/// <reference types="vitest/config" />
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

/**
 * bt-synergy lives next to this repository (`../bt-synergy`, branch `feat/language-pack` or later), as usfm-ast lives
 * next to Taller. Its packages are used from their sources, the way tc-study uses them, so Servos and tc-study read and
 * write resources with the very same code. Their types are declared in `src/resources/btSynergy.d.ts`.
 */
const BT = resolve(dirname(fileURLToPath(import.meta.url)), '../bt-synergy/packages')

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

// `vite build --mode pagina`: one self-contained HTML file, to share the prototype as a single page.
export default defineConfig(({ mode }) => ({
  plugins: mode === 'pagina' ? [react(), viteSingleFile()] : [react(), offlineShell()],
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
  server: { fs: { allow: ['.', BT, USFM_AST] } },
  test: {
    environment: 'node',
  },
}))
