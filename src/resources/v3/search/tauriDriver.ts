/**
 * The search index's SQLite on a computer: Tauri's `plugin-sql` (feature `sqlite`, whose bundled SQLite has FTS5), in
 * the app's configuration folder. The window may load, read and write it (`src-tauri/capabilities/default.json`).
 */
import type { SqlDriver } from '@bt-synergy/language-pack-client'
import Database from '@tauri-apps/plugin-sql'
import { serialDriver } from './serial'

/** The part of the plugin's `Database` used here, so a test can give its own. */
export type TauriDb = {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>
  select<T>(query: string, bindValues?: unknown[]): Promise<T>
}

export const TAURI_SEARCH_DB = 'sqlite:servos-busqueda.db'

export function tauriDriver(load: (path: string) => Promise<TauriDb> = (path) => Database.load(path), path = TAURI_SEARCH_DB): SqlDriver {
  return serialDriver(async () => {
    const db = await load(path)
    return {
      exec: async (statement) => void (await db.execute(statement)),
      run: async (sql, params) => void (await db.execute(sql, params)),
      all: <T>(sql: string, params: unknown[]) => db.select<T[]>(sql, params),
      begin: async () => void (await db.execute('BEGIN')),
      commit: async () => void (await db.execute('COMMIT')),
      rollback: async () => void (await db.execute('ROLLBACK')),
    }
  })
}
