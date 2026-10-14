/// <reference types="vitest/config" />
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

/**
 * bt-synergy lives next to this repository (`../bt-synergy`, branch `feat/language-pack` or later), as usfm-ast lives
 * next to Taller. Its packages are used from their sources, the way tc-study uses them, so Servos and tc-study read and
 * write resources with the very same code. Their types are declared in `src/resources/btSynergy.d.ts`.
 */
const BT = resolve(dirname(fileURLToPath(import.meta.url)), '../bt-synergy/packages')

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@bt-synergy\/catalog-manager\/core$/, replacement: `${BT}/catalog-manager/src/core.ts` },
      { find: /^@bt-synergy\/([^/]+)\/(.+)$/, replacement: `${BT}/$1/src/$2` },
      { find: /^@bt-synergy\/([^/]+)$/, replacement: `${BT}/$1/src/index.ts` },
    ],
    // Some bt-synergy packages keep old compiled `.js` files beside their `.ts` sources (cache-adapter-indexeddb);
    // the sources must win.
    extensions: ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json'],
  },
  server: { fs: { allow: ['.', BT] } },
  test: {
    environment: 'node',
  },
})
