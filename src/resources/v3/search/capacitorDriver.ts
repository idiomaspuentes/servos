/**
 * The search index's SQLite on a phone: `@capacitor-community/sqlite` (SQLCipher's SQLite, built with FTS5), without
 * encryption. The plugin is reached by its native name, not through the package's entry, which would bring its web
 * version (jeep-sqlite, sql.js) into every build of the app.
 */
import type { SqlDriver } from '@bt-synergy/language-pack-client'
import type { CapacitorSQLitePlugin } from '@capacitor-community/sqlite'
import { registerPlugin } from '@capacitor/core'
import { runsOf, serialDriver, type SqlStep } from './serial'

/** The part of the native plugin used here, so a test can give its own. */
export type CapacitorSqlite = Pick<
  CapacitorSQLitePlugin,
  'createConnection' | 'closeConnection' | 'open' | 'execute' | 'executeSet' | 'query' | 'beginTransaction' | 'commitTransaction' | 'rollbackTransaction'
>

export const CAPACITOR_SEARCH_DB = 'servos-busqueda'

/** Rows sent to the plugin in one `executeSet` (one message to the native side each). */
export const ROWS_PER_SET = 500

/** The steps as `executeSet` sets: consecutive rows of a statement together, at most `ROWS_PER_SET` rows a set. */
export function setsOf(steps: SqlStep[]): { statement: string; values: unknown[][] }[][] {
  const out: { statement: string; values: unknown[][] }[][] = []
  let set: { statement: string; values: unknown[][] }[] = []
  let rows = 0
  for (const run of runsOf(steps)) {
    for (let at = 0; at < run.rows.length; ) {
      if (rows === ROWS_PER_SET) {
        out.push(set)
        set = []
        rows = 0
      }
      const take = run.rows.slice(at, at + ROWS_PER_SET - rows)
      set.push({ statement: run.sql, values: take })
      rows += take.length
      at += take.length
    }
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
