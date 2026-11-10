import { sqlIndex, type SqlDriver } from '@bt-synergy/language-pack-client'
import type { BookModel } from '@bt-synergy/language-pack-v3'
import { DatabaseSync } from 'node:sqlite'
import { describe, expect, test } from 'vitest'
import { capacitorDriver, type CapacitorSqlite } from './capacitorDriver'
import { searchIndexV3, searchPlatform } from './searchIndex'
import { splitStatements } from './serial'
import { tauriDriver, type TauriDb } from './tauriDriver'

/** Every call a fake plugin got, in order: `[method, sql, params]`. */
type Log = [string, string, unknown[]?][]

/** Tauri's `Database` over node's SQLite (built with FTS5, as the plugin's is). */
function fakeTauri(log: Log, db = new DatabaseSync(':memory:')): (path: string) => Promise<TauriDb> {
  return async (path) => {
    log.push(['load', path])
    return {
      async execute(query, values = []) {
        log.push(['execute', query, values])
        if (values.length) db.prepare(query).run(...(values as never[]))
        else db.exec(query)
        return { rowsAffected: 0 }
      },
      async select<T>(query: string, values: unknown[] = []) {
        log.push(['select', query, values])
        return db.prepare(query).all(...(values as never[])) as T
      },
    }
  }
}

/** The Capacitor plugin's calls over node's SQLite. */
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
    async run(o: { statement?: string; values?: unknown[]; transaction?: boolean }) {
      log.push(['run', o.statement!, [...o.values!, o.transaction]])
      db.prepare(o.statement!).run(...(o.values as never[]))
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
    expect(log.some(([m, sql, p]) => sql === 'INSERT INTO a (x, y) VALUES (?, ?)' && m !== 'select' && p?.[0] === 'uno' && p[1] === 2)).toBe(true)
  })

  test('a transaction commits, and rolls back when it throws', async () => {
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
    expect(await driver.all('SELECT x FROM a', [])).toEqual([{ x: 'kept' }])
    const steps = log.map(([m, sql]) => (m === 'execute' || m === 'run' ? sql : m)).filter((s) => /^(BEGIN|COMMIT|ROLLBACK|begin|commit|rollback|INSERT)/.test(s))
    expect(steps.map((s) => s.slice(0, 6).toLowerCase())).toEqual(['begin', 'insert', 'commit', 'begin', 'insert', 'rollba'])
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
    const inserted = log.filter(([, sql]) => sql.startsWith('INSERT')).map(([, , p]) => p![0])
    expect(inserted).toEqual(['a1', 'a2', 'b1', 'b2'])
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
