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

/** What `whenNotTyping` looks at: the page's document unless given (tests). */
type TypingDoc = Pick<Document, 'addEventListener' | 'removeEventListener' | 'activeElement' | 'visibilityState'>

/** Whether something is being typed: a field or an editable text has the focus. */
export function isTyping(doc: Pick<Document, 'activeElement'> = document): boolean {
  const el = doc.activeElement as HTMLElement | null
  return Boolean(el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)))
}

/** How often it looks again by itself: a field taken out of the page sends no `focusout`. */
const LOOK_AGAIN_MS = 2000

/**
 * Runs something once nothing is being typed: a sheet that comes up must not take the keyboard from a sentence. It
 * looks again when the focus leaves a field, when the app comes back into view, and every two seconds meanwhile: a
 * focused field the page removes sends no `focusout`, and would otherwise hold it for ever.
 */
export function whenNotTyping(run: () => void, doc: TypingDoc = document): () => void {
  if (!isTyping(doc)) {
    run()
    return () => {}
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  let finished = false
  const stop = () => {
    finished = true
    clearTimeout(timer)
    clearInterval(every)
    doc.removeEventListener('focusout', left)
    doc.removeEventListener('visibilitychange', look)
  }
  const look = () => {
    if (finished || isTyping(doc)) return
    stop()
    run()
  }
  const left = () => {
    clearTimeout(timer)
    // Focus may only be moving to the next field.
    timer = setTimeout(look, 300)
  }
  const every = setInterval(look, LOOK_AGAIN_MS)
  doc.addEventListener('focusout', left)
  doc.addEventListener('visibilitychange', look)
  return stop
}
