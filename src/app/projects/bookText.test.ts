import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/** Every source file of the app, tests aside. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return sources(path)
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : []
  })
}

describe('the book text has one door', () => {
  it('lets no file but bookText.ts touch where verses, writers, joins, versions and conflicts are kept', () => {
    const app = join(__dirname, '..')
    const kept = /[.'`](borrador|autor|union|otra|estructura)\./
    const others = sources(app)
      .filter((f) => !f.endsWith('bookText.ts'))
      .filter((f) => kept.test(readFileSync(f, 'utf8')))
      .map((f) => relative(app, f))
    expect(others).toEqual([])
  })
})
