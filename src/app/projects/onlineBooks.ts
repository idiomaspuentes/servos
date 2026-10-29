/**
 * A project's book brought from the Worker, as the screens ask for it (spec §2): «Crear» in «Add a book» and «Bajar»
 * in a book that is not here. Which books were asked for is kept here, outside the screens (`askedBooks.ts`), so the
 * book shows its download from the moment it was asked; once it ended, the book is read first.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { useOnline } from '../frame/online'
import { bookDownloadSize, downloadBook, useOnlineResources, type BookSize } from '../../resources/online/onlineResources'
import { askedBooks } from './askedBooks'
import { libraryVersion, loadBook, subscribeLibrary } from './library'

// After the apply the library is read anew; the book asked for goes first. Nothing when it did not come.
const books = askedBooks(downloadBook, (language, book) => void loadBook(book, language))

/** Downloads and applies a book's texts and helps. Never rejects. */
export const askForBook = (language: string, book: string): Promise<void> => books.ask(language, book)

/** Whether a book's download was asked for and has not ended. */
export function useBookAsked(language: string, book: string): boolean {
  return useSyncExternalStore(books.subscribe, () => books.has(language, book))
}

/**
 * What downloading a book would bring, in bytes: undefined while it is worked out or cannot be told now, null when the
 * Worker's list names nothing of it. Worked out only while `wanted`, and again whenever what it depends on may have
 * changed (a list, the originals, the projects, a block, an offer, a download, the library, the connection); asking
 * again only reads what is kept unless something is missing, so it does not go round. Nothing waits for it.
 */
export function useDownloadSize(language: string, book: string | null, wanted: boolean): BookSize {
  const net = useOnlineResources()
  const library = useSyncExternalStore(subscribeLibrary, libraryVersion)
  const online = useOnline()
  const moved = [net.version, JSON.stringify(net.blocked), net.offer?.language, net.offer?.key, net.busy?.language, library, online].join('|')
  const [size, setSize] = useState<{ of: string; bytes: BookSize } | null>(null)
  const of = book ? `${language} ${book}` : ''
  useEffect(() => {
    if (!wanted || !book) return
    let live = true
    void bookDownloadSize(language, book).then((bytes) => live && setSize({ of: `${language} ${book}`, bytes }))
    return () => {
      live = false
    }
  }, [language, book, wanted, moved])
  return size && size.of === of ? size.bytes : undefined
}
