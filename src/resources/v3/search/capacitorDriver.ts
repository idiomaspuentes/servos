/**
 * The search index's SQLite on a phone: `@capacitor-community/sqlite` (SQLCipher's SQLite, built with FTS5), without
 * encryption. The plugin is reached by its native name, not through the package's entry, which would bring its web
 * version (jeep-sqlite, sql.js) into every build of the app.
 */
import type { SqlDriver } from '@bt-synergy/language-pack-client'
import type { CapacitorSQLitePlugin } from '@capacitor-community/sqlite'
import { registerPlugin } from '@capacitor/core'
import { serialDriver } from './serial'

/** The part of the native plugin used here, so a test can give its own. */
export type CapacitorSqlite = Pick<
  CapacitorSQLitePlugin,
  'createConnection' | 'closeConnection' | 'open' | 'execute' | 'run' | 'query' | 'beginTransaction' | 'commitTransaction' | 'rollbackTransaction'
>

export const CAPACITOR_SEARCH_DB = 'servos-busqueda'

let registered: CapacitorSqlite | undefined
const nativePlugin = (): CapacitorSqlite => (registered ??= registerPlugin<CapacitorSQLitePlugin>('CapacitorSQLite'))

export function capacitorDriver(plugin: () => CapacitorSqlite = nativePlugin, database = CAPACITOR_SEARCH_DB): SqlDriver {
  return serialDriver(async () => {
    const p = plugin()
    // The native connection outlives a reload of the page: the one left is closed (an open transaction with it).
    await p.closeConnection({ database }).catch(() => undefined)
    await p.createConnection({ database, version: 1, encrypted: false, mode: 'no-encryption', readonly: false })
    await p.open({ database, readonly: false })
    // Each call runs alone (`transaction: false`): the transactions are the driver's, begun and ended below.
    return {
      exec: async (statements) => void (await p.execute({ database, statements, transaction: false, readonly: false })),
      run: async (statement, values) => void (await p.run({ database, statement, values, transaction: false, readonly: false, returnMode: 'no' })),
      all: async <T>(statement: string, values: unknown[]) => ((await p.query({ database, statement, values, readonly: false })).values ?? []) as T[],
      begin: async () => void (await p.beginTransaction({ database })),
      commit: async () => void (await p.commitTransaction({ database })),
      rollback: async () => void (await p.rollbackTransaction({ database })),
    }
  })
}
