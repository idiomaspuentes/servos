/**
 * What the two SQLite plugins (Tauri's `plugin-sql`, `@capacitor-community/sqlite`) have in common, made into the
 * `SqlDriver` the library's `sqlIndex` takes. Both are reached by messages to the native side, so:
 * - one call at a time: Tauri's plugin keeps a pool of connections and gives a second one to a call made while another
 *   is running (seen in the spike of task B7);
 * - one transaction at a time: the app can install a book while it opens a reader, and both bring the index up to date;
 * - a transaction's writes are not sent one by one (a book is hundreds of rows, a message each took 40 s for Titus on
 *   a phone): `run` inside a transaction only keeps the write, and they go together, in order, as one atomic call to
 *   the plugin (`SqlCalls.atomic`) when `fn` ends. A transaction whose `fn` throws sends nothing.
 * A read or `exec` made while a transaction is open sends the writes kept so far first, as their own atomic call, so
 * it sees them; `sqlIndex` never reads inside a transaction, so its transactions stay whole. A transaction asked for from
 * inside another one waits for it forever, so `fn` never opens one (`sqlIndex` does not).
 */
import type { SqlDriver } from '@bt-synergy/language-pack-client'

/** One write: a statement and its `?` values. */
export type SqlStep = { sql: string; params: unknown[] }

/** What a plugin does for the driver. */
export type SqlCalls = {
  exec(statement: string): Promise<void>
  all<T>(sql: string, params: unknown[]): Promise<T[]>
  /** Writes outside any transaction, in order. */
  write(steps: SqlStep[]): Promise<void>
  /** Writes in order as one transaction: all of them or, when one fails, none. */
  atomic(steps: SqlStep[]): Promise<void>
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

/** Consecutive steps with the same statement, as one statement and its rows of values. */
export function runsOf(steps: SqlStep[]): { sql: string; rows: unknown[][] }[] {
  const out: { sql: string; rows: unknown[][] }[] = []
  for (const s of steps) {
    const last = out[out.length - 1]
    if (last && last.sql === s.sql) last.rows.push(s.params)
    else out.push({ sql: s.sql, rows: [s.params] })
  }
  return out
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
  /** The writes of the transaction running now; none outside one. */
  let kept: SqlStep[] | null = null
  const flush = async (): Promise<void> => {
    if (!kept?.length) return
    const steps = kept.splice(0)
    await one((c) => c.atomic(steps))
  }
  let transactions: Promise<unknown> = Promise.resolve()
  return {
    async exec(sql) {
      await flush()
      for (const statement of splitStatements(sql)) await one((c) => c.exec(statement))
    },
    async run(sql, params) {
      if (kept) kept.push({ sql, params })
      else await one((c) => c.write([{ sql, params }]))
    },
    async all<T>(sql: string, params: unknown[]) {
      await flush()
      return one((c) => c.all<T>(sql, params))
    },
    transaction<T>(fn: () => Promise<T>): Promise<T> {
      const next = transactions.then(async () => {
        kept = []
        try {
          const result = await fn()
          await flush()
          return result
        } finally {
          kept = null
        }
      })
      transactions = next.catch(() => undefined)
      return next
    },
  }
}
