import { sqlIndex, type SqlDriver } from '@bt-synergy/language-pack-client'
import type { BookModel } from '@bt-synergy/language-pack-v3'
import { describe, expect, test } from 'vitest'
import { capacitorDriver, ROWS_PER_SET, setsOf, type CapacitorSqlite } from './capacitorDriver'
import { searchIndexV3, searchPlatform } from './searchIndex'
import { splitStatements, type SqlStep } from './serial'
import { scriptOf, tauriDriver, type TauriDb } from './tauriDriver'

// node's SQLite (it has FTS5, as the plugins' have) says once that it is experimental; the test run stays quiet.
const warn = process.emitWarning
process.emitWarning = ((w: string | Error, ...rest: never[]) =>
  String(typeof w === 'string' ? w : w.message).includes('SQLite') ? undefined : warn.call(process, w, ...rest)) as typeof process.emitWarning
const { DatabaseSync } = await import('node:sqlite')
type DatabaseSync = InstanceType<typeof DatabaseSync>

/** Every call a fake plugin got, in order: `[method, sql, params]`. */
type Log = [string, string, unknown[]?][]

const questionsIn = (sql: string) => (sql.match(/\?/g) ?? []).length

/**
 * Tauri's `Database` over node's SQLite (built with FTS5, as the plugin's is). Like sqlx, one query may hold several
 * statements, the values bound across them in order. Like the plugin's pool after a connection's 30 minutes, every call
 * may end on a connection that is then closed: a transaction it leaves open is rolled back (`closeAfterEachCall`).
 */
function fakeTauri(log: Log, o: { db?: DatabaseSync; closeAfterEachCall?: boolean } = {}): (path: string) => Promise<TauriDb> {
  const db = o.db ?? new DatabaseSync(':memory:')
  const closed = () => {
    if (!o.closeAfterEachCall) return
    try {
      db.exec('ROLLBACK')
    } catch {
      // no transaction was open
    }
  }
  return async (path) => {
    log.push(['load', path])
    return {
      async execute(query, values = []) {
        log.push(['execute', query, values])
        try {
          let at = 0
          for (const statement of splitStatements(query)) {
            const n = questionsIn(statement)
            const mine = values.slice(at, at + n)
            at += n
            if (n) db.prepare(statement).run(...(mine as never[]))
            else db.exec(statement)
          }
        } finally {
          closed()
        }
        return { rowsAffected: 0 }
      },
      async select<T>(query: string, values: unknown[] = []) {
        log.push(['select', query, values])
        try {
          return db.prepare(query).all(...(values as never[])) as T
        } finally {
          closed()
        }
      },
    }
  }
}

/** The Capacitor plugin's calls over node's SQLite; `executeSet` takes a statement's rows of values. */
function fakeCapacitor(log: Log, db = new DatabaseSync(':memory:')): () => CapacitorSqlite {
  const plugin = {
    async closeConnection(o: { database?: string }) {
      log.push(['closeConnection', o.database ?? ''])
      throw new Error('no connection')
    },
    async createConnection(o: { database?: string; encrypted?: boolean }) {
      log.push(['createConnection', o.database ?? '', [o.encrypted]])
    },
    async open(o: { database?: string }) {
      log.push(['open', o.database ?? ''])
    },
    async execute(o: { statements?: string; transaction?: boolean }) {
      log.push(['execute', o.statements!, [o.transaction]])
      db.exec(o.statements!)
      return { changes: { changes: 0 } }
    },
    async executeSet(o: { set?: { statement?: string; values?: unknown[][] }[]; transaction?: boolean }) {
      for (const s of o.set!) {
        log.push(['executeSet', s.statement!, s.values!.flat()])
        for (const row of s.values!) db.prepare(s.statement!).run(...(row as never[]))
      }
      return { changes: { changes: 1 } }
    },
    async query(o: { statement?: string; values?: unknown[] }) {
      log.push(['query', o.statement!, o.values])
      return { values: db.prepare(o.statement!).all(...(o.values as never[])) }
    },
    async beginTransaction() {
      log.push(['begin', ''])
      db.exec('BEGIN')
      return {}
    },
    async commitTransaction() {
      log.push(['commit', ''])
      db.exec('COMMIT')
      return {}
    },
    async rollbackTransaction() {
      log.push(['rollback', ''])
      db.exec('ROLLBACK')
      return {}
    },
  }
  return () => plugin as unknown as CapacitorSqlite
}

const drivers: [string, (log: Log) => SqlDriver][] = [
  ['tauriDriver', (log) => tauriDriver(fakeTauri(log))],
  ['capacitorDriver', (log) => capacitorDriver(fakeCapacitor(log))],
]

/** The values the plugin was sent for INSERTs, in order. */
const inserted = (log: Log) => log.filter(([m, sql]) => m !== 'select' && m !== 'query' && /INSERT/.test(sql)).flatMap(([, , p]) => p ?? [])

/** Titus 3:7 in a bridge text and a note on it whose word has its accent. */
const book: BookModel = {
  lang: 'es-419',
  book: 'tit',
  orig: ['el-x-koine/ugnt', 'v1'],
  res: [],
  texts: [
    {
      res: 'es-419/glt',
      pieces: [
        ['justificados', true],
        [' ', false],
        ['por', true],
        [' ', false],
        ['su', true],
        [' ', false],
        ['gracia', true],
      ],
      events: [
        [0, 'chapter', '3'],
        [0, 'verse', '7'],
      ],
    },
  ],
  notes: { res: 'es-419/tn', rows: [{ id: 'ab12', ref: '3:7', from: 0, to: 0, cols: { note: 'La palabra «gracía» aquí es el favor de Dios.' } }] },
}

describe.each(drivers)('%s', (_, make) => {
  test('splits the statements of exec', async () => {
    const log: Log = []
    const driver = make(log)
    await driver.exec(`CREATE TABLE a (x TEXT DEFAULT ';');\n   CREATE TABLE b (y);`)
    const sent = log.filter(([m]) => m === 'execute').map(([, sql]) => sql)
    expect(sent).toEqual(["CREATE TABLE a (x TEXT DEFAULT ';')", 'CREATE TABLE b (y)'])
  })

  test('passes the params', async () => {
    const log: Log = []
    const driver = make(log)
    await driver.exec('CREATE TABLE a (x, y)')
    await driver.run('INSERT INTO a (x, y) VALUES (?, ?)', ['uno', 2])
    expect(await driver.all('SELECT x, y FROM a WHERE y = ?', [2])).toEqual([{ x: 'uno', y: 2 }])
    expect(inserted(log)).toEqual(['uno', 2])
  })

  test('a transaction commits, and rolls back when it throws or a write fails', async () => {
    const log: Log = []
    const driver = make(log)
    await driver.exec('CREATE TABLE a (x)')
    expect(await driver.transaction(async () => (await driver.run('INSERT INTO a (x) VALUES (?)', ['kept']), 'done'))).toBe('done')
    await expect(
      driver.transaction(async () => {
        await driver.run('INSERT INTO a (x) VALUES (?)', ['lost'])
        throw new Error('stop')
      })
    ).rejects.toThrow('stop')
    await expect(
      driver.transaction(async () => {
        await driver.run('INSERT INTO a (x) VALUES (?)', ['also lost'])
        await driver.run('INSERT INTO nowhere (x) VALUES (?)', ['fails'])
      })
    ).rejects.toThrow(/nowhere/)
    expect(await driver.all('SELECT x FROM a', [])).toEqual([{ x: 'kept' }])
    // A transaction that threw sent nothing.
    expect(inserted(log)).not.toContain('lost')
  })

  test('two transactions at once run one after the other', async () => {
    const log: Log = []
    const driver = make(log)
    await driver.exec('CREATE TABLE a (x)')
    const fill = (x: string) =>
      driver.transaction(async () => {
        await driver.run('INSERT INTO a (x) VALUES (?)', [`${x}1`])
        await driver.run('INSERT INTO a (x) VALUES (?)', [`${x}2`])
      })
    await Promise.all([fill('a'), fill('b')])
    expect(inserted(log)).toEqual(['a1', 'a2', 'b1', 'b2'])
    expect((await driver.all<{ x: string }>('SELECT x FROM a', [])).map((r) => r.x)).toEqual(['a1', 'a2', 'b1', 'b2'])
  })

  test('a read inside a transaction sees its writes, in order', async () => {
    const driver = make([])
    await driver.exec('CREATE TABLE a (x)')
    const seen = await driver.transaction(async () => {
      await driver.run('INSERT INTO a (x) VALUES (?)', ['one'])
      const rows = await driver.all<{ n: number }>('SELECT count(*) AS n FROM a', [])
      await driver.run('INSERT INTO a (x) VALUES (?)', ['two'])
      return rows[0]!.n
    })
    expect(seen).toBe(1)
    expect(await driver.all('SELECT x FROM a', [])).toEqual([{ x: 'one' }, { x: 'two' }])
  })

  test('search finds a note by a word without its accent', async () => {
    const index = sqlIndex(make([]))
    await index.init()
    await index.addBook('es-419', book, 'seg-tit')
    expect(await index.has('seg-tit')).toBe(true)
    const hits = await index.search('es-419', 'gracia', { limit: 10 })
    expect(hits.map((h) => `${h.kind} ${h.ref}`).sort()).toEqual(['note 3:7', 'text 3:7'])
    const note = hits.find((h) => h.kind === 'note')!
    expect(note).toMatchObject({ book: 'tit', res: 'es-419/tn', id: 'ab12' })
    expect(note.snippet).toContain('«gracía»')
    await index.removeSegment('seg-tit')
    expect(await index.search('es-419', 'gracia')).toEqual([])
  })
})

describe('tauriDriver', () => {
  test('a transaction is one execute, which a connection closed after each call cannot split', async () => {
    const log: Log = []
    const index = sqlIndex(tauriDriver(fakeTauri(log, { closeAfterEachCall: true })))
    await index.init()
    log.length = 0
    await index.addBook('es-419', book, 'seg-tit')
    const sent = log.filter(([m]) => m === 'execute')
    expect(sent.length).toBe(1)
    expect(splitStatements(sent[0]![1])[0]).toBe('BEGIN')
    expect(splitStatements(sent[0]![1]).at(-1)).toBe('COMMIT')
    expect((await index.search('es-419', 'gracia')).length).toBe(2)
  })

  test('rows of the same INSERT go as multi-row INSERTs, under SQLite’s limit of values', () => {
    const insert = 'INSERT INTO pieces (body, kind, lang, book, ref, res, rid, seg) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    const steps: SqlStep[] = [
      { sql: 'DELETE FROM pieces WHERE seg = ?', params: ['s'] },
      ...Array.from({ length: 5000 }, (_, i) => ({ sql: insert, params: [`b${i}`, 'text', 'es', 'tit', '1:1', 'r', '', 's'] })),
      { sql: 'INSERT INTO indexed (seg, lang, book) VALUES (?, ?, ?)', params: ['s', 'es', 'tit'] },
    ]
    const { sql, params } = scriptOf(steps)
    expect(sql.length).toBe(4)
    expect(sql.map(questionsIn)).toEqual([1, 4000 * 8, 1000 * 8, 3])
    expect(params.length).toBe(1 + 5000 * 8 + 3)
    expect(params.slice(1, 3)).toEqual(['b0', 'text'])
    expect(sql.every((s) => questionsIn(s) <= 32766)).toBe(true)
  })
})

describe('capacitorDriver', () => {
  test('a transaction is begin, its rows in sets of at most 500, commit', async () => {
    const log: Log = []
    const driver = capacitorDriver(fakeCapacitor(log))
    await driver.exec('CREATE TABLE a (x)')
    log.length = 0
    await driver.transaction(async () => {
      for (let i = 0; i < 1200; i++) await driver.run('INSERT INTO a (x) VALUES (?)', [i])
    })
    expect(log.map(([m]) => m)).toEqual(['begin', 'executeSet', 'executeSet', 'executeSet', 'commit'])
    expect(log.filter(([m]) => m === 'executeSet').map(([, , p]) => p!.length)).toEqual([500, 500, 200])
    expect((await driver.all<{ n: number }>('SELECT count(*) AS n FROM a', []))[0]!.n).toBe(1200)
  })

  test('sets keep the order of different statements', () => {
    const steps: SqlStep[] = [
      { sql: 'DELETE FROM t WHERE s = ?', params: ['x'] },
      ...Array.from({ length: ROWS_PER_SET }, (_, i) => ({ sql: 'INSERT INTO t (v) VALUES (?)', params: [i] })),
      { sql: 'INSERT INTO u (v) VALUES (?)', params: ['last'] },
    ]
    const sets = setsOf(steps)
    expect(sets.map((set) => set.map((s) => [s.statement.slice(0, 13), s.values.length]))).toEqual([
      [
        ['DELETE FROM t', 1],
        ['INSERT INTO t', 499],
      ],
      [
        ['INSERT INTO t', 1],
        ['INSERT INTO u', 1],
      ],
    ])
  })
})

test('the plugins are opened once, the Capacitor one without encryption', async () => {
  const log: Log = []
  const driver = capacitorDriver(fakeCapacitor(log))
  await Promise.all([driver.all('SELECT 1 AS one', []), driver.all('SELECT 2 AS two', [])])
  expect(log.filter(([m]) => m === 'createConnection')).toEqual([['createConnection', 'servos-busqueda', [false]]])
  const tlog: Log = []
  const t = tauriDriver(fakeTauri(tlog))
  await Promise.all([t.all('SELECT 1 AS one', []), t.all('SELECT 2 AS two', [])])
  expect(tlog.filter(([m]) => m === 'load')).toEqual([['load', 'sqlite:servos-busqueda.db']])
})

test('a plugin that could not open is tried again on the next call', async () => {
  let tries = 0
  const driver = tauriDriver(async (path) => {
    if (++tries === 1) throw new Error('busy')
    return fakeTauri([])(path)
  })
  await expect(driver.all('SELECT 1 AS one', [])).rejects.toThrow('busy')
  expect(await driver.all('SELECT 1 AS one', [])).toEqual([{ one: 1 }])
})

test('splitStatements keeps a ; inside quotes', () => {
  expect(splitStatements(`A 'x;y'; B "p;q" ;;  `)).toEqual([`A 'x;y'`, `B "p;q"`])
})

test('the index is SQLite in the apps and none on the web', () => {
  expect(searchPlatform({ __TAURI_INTERNALS__: {} })).toBe('computadora')
  expect(searchPlatform({ Capacitor: { isNativePlatform: () => true } })).toBe('telefono')
  expect(searchPlatform({ Capacitor: { isNativePlatform: () => false } })).toBe('web')
  expect(searchPlatform(undefined)).toBe('web')
  expect(searchIndexV3('web')).toBeUndefined()
  expect(searchIndexV3('computadora')).toBeDefined()
  expect(searchIndexV3('telefono')).toBeDefined()
})
