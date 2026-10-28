/**
 * Which books' texts and helps were asked for and are still coming (spec §2): from the ask until its download ends,
 * well or not, so a book shows that they are coming from the moment it was asked, whatever screen asked.
 */

export type AskedBooks = {
  /** Downloads a book's texts and helps; never rejects. */
  ask(language: string, book: string): Promise<void>
  has(language: string, book: string): boolean
  /** Told whenever a book is asked for or stops being. */
  subscribe(fn: () => void): () => void
}

/** `download` brings a book; `after` runs once it ended (the book is read first). */
export function askedBooks(download: (language: string, book: string) => Promise<void>, after: (language: string, book: string) => void): AskedBooks {
  // How many asks of each book are running: asked twice, it is asked until both ended.
  const asked = new Map<string, number>()
  const listeners = new Set<() => void>()
  const keyOf = (language: string, book: string) => `${language} ${book}`
  const told = () => listeners.forEach((fn) => fn())
  return {
    async ask(language, book) {
      const key = keyOf(language, book)
      asked.set(key, (asked.get(key) ?? 0) + 1)
      told()
      try {
        await download(language, book)
      } catch {
        // Why it did not come is the online state's to say.
      } finally {
        const left = (asked.get(key) ?? 1) - 1
        if (left > 0) asked.set(key, left)
        else asked.delete(key)
        told()
        after(language, book)
      }
    },
    has: (language, book) => asked.has(keyOf(language, book)),
    subscribe(fn) {
      listeners.add(fn)
      return () => void listeners.delete(fn)
    },
  }
}
