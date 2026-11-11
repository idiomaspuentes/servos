/**
 * The search index's SQLite on a phone: `@capacitor-community/sqlite` (SQLCipher's SQLite, built with FTS5), without
 * encryption. The plugin is reached by its native name, not through the package's entry, which would bring its web
 * version (jeep-sqlite, sql.js) into every build of the app.
 */
import type { SqlDriver } from '@bt-synergy/language-pack-client'
import type { CapacitorSQLitePlugin } from '@capacitor-community/sqlite'
import { registerPlugin } from '@capacitor/core'
import { serialDriver, statementsOf, type SqlStep } from './serial'

/** The part of the native plugin used here, so a test can give its own. */
export type CapacitorSqlite = Pick<
  CapacitorSQLitePlugin,
  'createConnection' | 'closeConnection' | 'open' | 'execute' | 'executeSet' | 'query' | 'beginTransaction' | 'commitTransaction' | 'rollbackTransaction'
>

export const CAPACITOR_SEARCH_DB = 'servos-busqueda'

/** SQLite's most `?` in one statement on Android's older builds (SQLITE_MAX_VARIABLE_NUMBER before 3.32). */
export const MAX_PARAMS = 999
/** Values sent to the plugin in one `executeSet` (one message to the native side each), at most. */
export const VALUES_PER_SET = 8000

/**
 * The steps as `executeSet` sets. Each statement goes in the plugin's one-row form (`values` flat), which binds them
 * by `?`: the plugin's form with a list of rows writes the values into the SQL itself and fills only a `VALUES (…)`, so
 * a `DELETE … WHERE seg = ?` would run with nothing bound and delete nothing. Rows of an INSERT are made multi-row
 * INSERTs here instead.
 */
export function setsOf(steps: SqlStep[]): { statement: string; values: unknown[] }[][] {
  const out: { statement: string; values: unknown[] }[][] = []
  let set: { statement: string; values: unknown[] }[] = []
  let size = 0
  for (const s of statementsOf(steps, MAX_PARAMS)) {
    if (set.length && size + s.params.length > VALUES_PER_SET) {
      out.push(set)
      set = []
      size = 0
    }
    set.push({ statement: s.sql, values: s.params })
    size += s.params.length
  }
  if (set.length) out.push(set)
  return out
}

let registered: CapacitorSqlite | undefined
const nativePlugin = (): CapacitorSqlite => (registered ??= registerPlugin<CapacitorSQLitePlugin>('CapacitorSQLite'))

export function capacitorDriver(plugin: () => CapacitorSqlite = nativePlugin, database = CAPACITOR_SEARCH_DB): SqlDriver {
  return serialDriver(async () => {
    const p = plugin()
    // The native connection outlives a reload of the page: the one left is closed (an open transaction with it).
    await p.closeConnection({ database }).catch(() => undefined)
    await p.createConnection({ database, version: 1, encrypted: false, mode: 'no-encryption', readonly: false })
    await p.open({ database, readonly: false })
    // Each call runs alone (`transaction: false`): the transactions are the driver's, begun and ended here.
    const write = async (steps: SqlStep[]) => {
      for (const set of setsOf(steps)) await p.executeSet({ database, set, transaction: false, readonly: false, returnMode: 'no' })
    }
    return {
      exec: async (statements) => void (await p.execute({ database, statements, transaction: false, readonly: false })),
      all: async <T>(statement: string, values: unknown[]) => ((await p.query({ database, statement, values, readonly: false })).values ?? []) as T[],
      write,
      async atomic(steps) {
        await p.beginTransaction({ database })
        try {
          await write(steps)
          await p.commitTransaction({ database })
        } catch (e) {
          await p.rollbackTransaction({ database }).catch(() => undefined)
          throw e
        }
      },
    }
  })
}
