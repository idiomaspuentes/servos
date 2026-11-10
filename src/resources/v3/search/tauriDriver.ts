/**
 * The search index's SQLite on a computer: Tauri's `plugin-sql` (feature `sqlite`, whose bundled SQLite has FTS5), in
 * the app's configuration folder. The window may load, read and write it (`src-tauri/capabilities/default.json`).
 *
 * The plugin keeps a pool of connections and closes one that has lived 30 minutes when it is given back, so a `BEGIN`
 * sent alone can be left on a closed connection while the writes after it land on another. A transaction is therefore
 * sent as ONE `execute`: `BEGIN; …; COMMIT` with every value in order (SQLite through sqlx binds the values across the
 * statements of one query). Rows of the same INSERT go as one multi-row INSERT.
 */
import type { SqlDriver } from '@bt-synergy/language-pack-client'
import Database from '@tauri-apps/plugin-sql'
import { runsOf, serialDriver, type SqlStep } from './serial'

/** The part of the plugin's `Database` used here, so a test can give its own. */
export type TauriDb = {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>
  select<T>(query: string, bindValues?: unknown[]): Promise<T>
}

export const TAURI_SEARCH_DB = 'sqlite:servos-busqueda.db'

/** SQLite's most `?` in one statement (SQLITE_MAX_VARIABLE_NUMBER since 3.32). */
const MAX_PARAMS = 32766
/** Rows in one multi-row INSERT, at most. */
const MAX_ROWS = 4000

const INSERT = /^(INSERT INTO [^]*? VALUES )(\(\s*\?(?:\s*,\s*\?)*\s*\))$/i

/** The steps as statements to send in one query, and their values in order. */
export function scriptOf(steps: SqlStep[]): { sql: string[]; params: unknown[] } {
  const sql: string[] = []
  const params: unknown[] = []
  for (const run of runsOf(steps)) {
    const insert = INSERT.exec(run.sql.trim())
    const perRow = run.rows[0]!.length
    if (!insert || run.rows.length === 1 || perRow === 0) {
      for (const row of run.rows) {
        sql.push(run.sql)
        params.push(...row)
      }
      continue
    }
    const size = Math.max(1, Math.min(MAX_ROWS, Math.floor(MAX_PARAMS / perRow)))
    for (let at = 0; at < run.rows.length; at += size) {
      const chunk = run.rows.slice(at, at + size)
      sql.push(insert[1] + chunk.map(() => insert[2]).join(', '))
      for (const row of chunk) params.push(...row)
    }
  }
  return { sql, params }
}

export function tauriDriver(load: (path: string) => Promise<TauriDb> = (path) => Database.load(path), path = TAURI_SEARCH_DB): SqlDriver {
  return serialDriver(async () => {
    const db = await load(path)
    return {
      exec: async (statement) => void (await db.execute(statement)),
      all: <T>(sql: string, params: unknown[]) => db.select<T[]>(sql, params),
      async write(steps) {
        const { sql, params } = scriptOf(steps)
        await db.execute(sql.join(';\n'), params)
      },
      async atomic(steps) {
        const { sql, params } = scriptOf(steps)
        try {
          await db.execute(['BEGIN', ...sql, 'COMMIT'].join(';\n'), params)
        } catch (e) {
          // The query stopped inside its transaction: left open on that connection, it is rolled back. A connection
          // with none open answers with an error, which says nothing more.
          await db.execute('ROLLBACK').catch(() => undefined)
          throw e
        }
      },
    }
  })
}
