import { describe, expect, it, vi } from 'vitest'
import { askedBooks } from './askedBooks'

/** A download the test ends by hand. */
function pending() {
  let end!: () => void
  let fail!: (e: unknown) => void
  const promise = new Promise<void>((resolve, reject) => {
    end = resolve
    fail = reject
  })
  return { promise, end, fail }
}

describe('the books asked for', () => {
  it('a book is asked for from the ask until its download ends, and is read after', async () => {
    const download = pending()
    const after = vi.fn()
    const books = askedBooks(() => download.promise, after)
    const told = vi.fn()
    books.subscribe(told)
    const asking = books.ask('es-419', 'tit')
    expect(books.has('es-419', 'tit')).toBe(true)
    expect(books.has('es-419', 'rut')).toBe(false)
    expect(books.has('pt-br', 'tit')).toBe(false)
    expect(told).toHaveBeenCalledTimes(1)
    download.end()
    await asking
    expect(books.has('es-419', 'tit')).toBe(false)
    expect(told).toHaveBeenCalledTimes(2)
    expect(after).toHaveBeenCalledWith('es-419', 'tit')
  })

  it('a download that fails ends the ask too, and the ask never rejects', async () => {
    const download = pending()
    const books = askedBooks(() => download.promise, () => {})
    const asking = books.ask('es-419', 'tit')
    download.fail(new Error('dropped'))
    await expect(asking).resolves.toBeUndefined()
    expect(books.has('es-419', 'tit')).toBe(false)
  })

  it('two asks of one book: it stays asked until both ended', async () => {
    const first = pending()
    const second = pending()
    const runs = [first, second]
    const books = askedBooks(() => runs.shift()!.promise, () => {})
    const a = books.ask('es-419', 'tit')
    const b = books.ask('es-419', 'tit')
    first.end()
    await a
    expect(books.has('es-419', 'tit')).toBe(true)
    second.end()
    await b
    expect(books.has('es-419', 'tit')).toBe(false)
  })

  it('a listener that stops listening is told nothing more', async () => {
    const download = pending()
    const books = askedBooks(() => download.promise, () => {})
    const told = vi.fn()
    const off = books.subscribe(told)
    off()
    const asking = books.ask('es-419', 'tit')
    download.end()
    await asking
    expect(told).not.toHaveBeenCalled()
  })
})
