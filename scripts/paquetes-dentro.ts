/**
 * Makes the language packs the apps carry inside (`paquetes-dentro/`, see the README), with bt-synergy's own pipeline:
 *
 *   bun scripts/paquetes-dentro.ts --taller <Taller checkout>/public [--lang es-419] [--out paquetes-dentro]
 *
 * It is bt-synergy's `prepare-language` with one difference: MACULA's rows are stamped as production's parts lists
 * stamp them, with the last Taller commit that touched `trees/` and `referents/` and that commit's date
 * (`maculaIdentity`, as `publish-language` does). `prepare-language` stamps them with the build date instead, so every
 * app that opened its packs saw MACULA as changed and offered to download it again (10.1 MB in rc.2). Once
 * `prepare-language` stamps MACULA itself (handoff task T-046), this script can go.
 *
 * Run with bun (the pipeline is TypeScript), from this repository, with bt-synergy where `scripts/btSynergy.ts` finds
 * it and its packages built (`cli/freshBuilds.ts` says which, if not).
 */
import { join, resolve } from 'node:path'
import { btSynergyRoot } from './btSynergy'

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}
const taller = arg('taller')
if (!taller) {
  console.error('Uso: bun scripts/paquetes-dentro.ts --taller <Taller>/public [--lang es-419] [--out paquetes-dentro]')
  process.exit(2)
}
const language = arg('lang') ?? 'es-419'
const outDir = resolve(arg('out') ?? 'paquetes-dentro')

const pipeline = join(btSynergyRoot(resolve(import.meta.dir, '..')), 'packages', 'resource-pipeline')
// The pipeline keeps its stores in IndexedDB; fake-indexeddb is its own dependency.
await import(join(pipeline, 'node_modules', 'fake-indexeddb', 'auto', 'index.mjs'))
const { requireFreshBuilds } = await import(join(pipeline, 'cli', 'freshBuilds.ts'))
const { maculaIdentity } = await import(join(pipeline, 'cli', 'maculaIdentity.ts'))
const { prepareAndPack } = await import(join(pipeline, 'src', 'language', 'prepareAndPack.ts'))

requireFreshBuilds(['@bt-synergy/resource-pipeline', '@bt-synergy/language-pack', '@bt-synergy/cache-adapter-indexeddb', '@bt-synergy/catalog-adapter-indexeddb'])
const macula = resolve(taller)
const id = maculaIdentity(macula, {})
// As publishLanguage.ts stamps it.
const maculaStamp = { version: id.commit.slice(0, 10), publishedAt: new Date(id.date).toISOString() }
console.log(`MACULA: ${id.commit} (${maculaStamp.publishedAt})`)

await prepareAndPack({ language, outDir, originals: true, macula, maculaStamp, lexicons: { ref: 'master' }, obs: false, log: console.log })
