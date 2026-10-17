/**
 * Whether the phone says it has internet, and what waits for it (`outbox.ts`), as a screen draws them. The phone may
 * say it is online and still not reach Door43 (a network with no way out): what tries and cannot is kept to wait, too.
 */

import { useEffect, useState } from 'react'
import { onWaiting, waiting, type Errand } from '../projects/outbox'

export const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

export function useOnline(): boolean {
  const [online, setOnline] = useState(isOnline)
  useEffect(() => {
    const on = () => setOnline(isOnline())
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', on)
    }
  }, [])
  return online
}

/** What waits of one person's, kept up to date. */
export function useWaiting(person: string): Errand[] {
  const [list, setList] = useState(() => waiting(person))
  useEffect(() => {
    setList(waiting(person))
    return onWaiting(() => setList(waiting(person)))
  }, [person])
  return list
}

/** Runs something once nothing is being typed: a sheet that comes up must not take the keyboard from a sentence. */
export function whenNotTyping(run: () => void): () => void {
  const typing = () => {
    const el = document.activeElement as HTMLElement | null
    return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))
  }
  if (!typing()) {
    run()
    return () => {}
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const left = () => {
    clearTimeout(timer)
    // Focus may only be moving to the next field.
    timer = setTimeout(() => {
      if (typing()) return
      document.removeEventListener('focusout', left)
      run()
    }, 300)
  }
  document.addEventListener('focusout', left)
  return () => {
    clearTimeout(timer)
    document.removeEventListener('focusout', left)
  }
}
