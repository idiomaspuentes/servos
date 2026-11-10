/**
 * What the two SQLite plugins (Tauri's `plugin-sql`, `@capacitor-community/sqlite`) have in common, made into the
 * `SqlDriver` the library's `sqlIndex` takes. Both are reached by messages to the native side, so:
 * - one call at a time: Tauri's plugin keeps a pool of connections and gives a second one to a call made while another
 *   is running (seen in the spike of task B7);
 * - one transaction at a time: the app can install a book while it opens a reader, and both bring the index up to date;
 * - a transaction's writes are not sent one by one (a book is hundreds of rows, a message each took 40 s for Titus on
 *   a phone): `run` inside a transaction only keeps the write, and they go together, in order, as one atomic call to
 *   the plugin (`SqlCalls.atomic`) when `fn` ends. A transaction whose `fn` throws sends nothing.
 * A read or `exec` made while a transaction is open does not send them: it sees the state before the transaction, so
 * another caller's read never commits half of one, and `fn` cannot read its own writes (`sqlIndex` never does). A
 * transaction asked for from inside another one waits for it forever, so `fn` never opens one (`sqlIndex` does not).
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

const INSERT = /^(INSERT INTO [^]*? VALUES )(\(\s*\?(?:\s*,\s*\?)*\s*\))$/i

/**
 * The steps as statements with their values bound by `?`: rows of the same INSERT become multi-row INSERTs of at most
 * `maxParams` values and `maxRows` rows each; any other statement stays one per row.
 */
export function statementsOf(steps: SqlStep[], maxParams: number, maxRows = Infinity): SqlStep[] {
  const out: SqlStep[] = []
  for (const run of runsOf(steps)) {
    const insert = INSERT.exec(run.sql.trim())
    const perRow = run.rows[0]!.length
    if (!insert || run.rows.length === 1 || perRow === 0) {
      for (const row of run.rows) out.push({ sql: run.sql, params: row })
      continue
    }
    const size = Math.max(1, Math.min(maxRows, Math.floor(maxParams / perRow)))
    for (let at = 0; at < run.rows.length; at += size) {
      const chunk = run.rows.slice(at, at + size)
      out.push({ sql: insert[1] + chunk.map(() => insert[2]).join(', '), params: chunk.flat() })
    }
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
  let transactions: Promise<unknown> = Promise.resolve()
  return {
    async exec(sql) {
      for (const statement of splitStatements(sql)) await one((c) => c.exec(statement))
    },
    async run(sql, params) {
      if (kept) kept.push({ sql, params })
      else await one((c) => c.write([{ sql, params }]))
    },
    all: <T>(sql: string, params: unknown[]) => one((c) => c.all<T>(sql, params)),
    transaction<T>(fn: () => Promise<T>): Promise<T> {
      const next = transactions.then(async () => {
        const steps: SqlStep[] = (kept = [])
        try {
          const result = await fn()
          kept = null
          if (steps.length) await one((c) => c.atomic(steps))
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
