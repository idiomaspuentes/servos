/**
 * A project's book brought from the Worker, as the screens ask for it (spec §2): «Crear» in «Add a book» and «Bajar»
 * in a book that is not here. Which books were asked for is kept here, outside the screens, so the book shows its
 * download from the moment it was asked, before the first part comes and whatever screen asked; once it is applied,
 * the book is read first.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { bookDownloadSize, downloadBook } from '../../resources/online/onlineResources'
import { loadBook } from './library'

const asked = new Set<string>()
const listeners = new Set<() => void>()
const keyOf = (language: string, book: string) => `${language}:${book}`
const told = () => listeners.forEach((fn) => fn())

/** Downloads and applies a book's texts and helps; then the book is read before the others. Never rejects. */
export function askForBook(language: string, book: string): Promise<void> {
  const key = keyOf(language, book)
  asked.add(key)
  told()
  return downloadBook(language, book).finally(() => {
    asked.delete(key)
    told()
    // After the apply the library is read anew; the book asked for goes first. Nothing when it did not come.
    void loadBook(book, language)
  })
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Whether a book's download was asked for and has not ended. */
export function useBookAsked(language: string, book: string): boolean {
  return useSyncExternalStore(subscribe, () => asked.has(keyOf(language, book)))
}

/**
 * What downloading a book would bring, in bytes: undefined while it is worked out (or not asked for), null when the
 * Worker has nothing of it. Worked out only while `wanted`; it may wait behind a check, so nothing waits for it.
 */
export function useDownloadSize(language: string, book: string | null, wanted: boolean): number | null | undefined {
  const [size, setSize] = useState<{ of: string; bytes: number | null } | null>(null)
  const of = book ? keyOf(language, book) : ''
  useEffect(() => {
    if (!wanted || !book) return
    let live = true
    void bookDownloadSize(language, book).then((bytes) => live && setSize({ of: keyOf(language, book), bytes }))
    return () => {
      live = false
    }
  }, [language, book, wanted])
  return size && size.of === of ? size.bytes : undefined
}
