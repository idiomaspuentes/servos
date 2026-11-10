/**
 * What the two SQLite plugins (Tauri's `plugin-sql`, `@capacitor-community/sqlite`) have in common, made into the
 * `SqlDriver` the library's `sqlIndex` takes. Both are reached by messages to the native side, so the library's calls
 * are put in one line here:
 * - one call at a time: Tauri's plugin keeps a pool of connections and gives a second one to a call made while another
 *   is running, so the statements of a transaction could land outside it (seen in the spike of task B7);
 * - one transaction at a time: the app can install a book while it opens a reader, and both bring the index up to date.
 * A call made while a transaction is open runs inside it (one connection), which is harmless for the index: its reads
 * see the rows being written and its writes are the same kind. A transaction asked for from inside another one waits for
 * it forever, so `fn` never opens one (`sqlIndex` does not).
 */
import type { SqlDriver } from '@bt-synergy/language-pack-client'

/** One statement at a time, as each plugin runs it. */
export type SqlCalls = {
  exec(statement: string): Promise<void>
  run(sql: string, params: unknown[]): Promise<void>
  all<T>(sql: string, params: unknown[]): Promise<T[]>
  begin(): Promise<void>
  commit(): Promise<void>
  rollback(): Promise<void>
}

/**
 * The statements of a script, without their `;`. A `;` inside quotes ('…', "…") does not end one. Enough for the
 * index's own SQL, which has no comments and no triggers.
 */
export function splitStatements(sql: string): string[] {
  const out: string[] = []
  let quote: string | null = null
  let start = 0
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]!
    if (quote) {
      if (ch === quote) quote = null
    } else if (ch === "'" || ch === '"') quote = ch
    else if (ch === ';') {
      out.push(sql.slice(start, i))
      start = i + 1
    }
  }
  out.push(sql.slice(start))
  return out.map((s) => s.trim()).filter((s) => s !== '')
}

/** A `SqlDriver` over a plugin's calls, opened on the first use (and again after an open that failed). */
export function serialDriver(open: () => Promise<SqlCalls>): SqlDriver {
  let calls: Promise<SqlCalls> | undefined
  let line: Promise<unknown> = Promise.resolve()
  const one = <T>(f: (c: SqlCalls) => Promise<T>): Promise<T> => {
    const next = line.then(async () => {
      const opened = (calls ??= open())
      opened.catch(() => {
        if (calls === opened) calls = undefined
      })
      return f(await opened)
    })
    line = next.catch(() => undefined)
    return next
  }
  let transactions: Promise<unknown> = Promise.resolve()
  return {
    async exec(sql) {
      for (const statement of splitStatements(sql)) await one((c) => c.exec(statement))
    },
    run: (sql, params) => one((c) => c.run(sql, params)),
    all: <T>(sql: string, params: unknown[]) => one((c) => c.all<T>(sql, params)),
    transaction<T>(fn: () => Promise<T>): Promise<T> {
      const next = transactions.then(async () => {
        await one((c) => c.begin())
        try {
          const result = await fn()
          await one((c) => c.commit())
          return result
        } catch (e) {
          // A commit that failed leaves the transaction open in SQLite: it is rolled back too.
          await one((c) => c.rollback()).catch(() => undefined)
          throw e
        }
      })
      transactions = next.catch(() => undefined)
      return next
    },
  }
}
