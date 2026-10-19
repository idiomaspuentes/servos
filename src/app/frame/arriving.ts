/**
 * Work that comes from outside the app, to be received (design, section 7): a `.servos` file opened on the computer
 * (a double click on it, `desktop.ts`) or dropped on the window, in the app for computers or in a browser. The app
 * opens «Receive» with it, read; nothing is gathered before the person says so there.
 *
 * What arrives before the app can take it (the file Servos was started with, while the person is still choosing who
 * they are) waits here, the newest only: it is what the person just opened.
 */

import { useEffect, useState } from 'react'

/** A file that came from outside: its name and its text (empty when it is not one the app could read). */
export interface Arrived {
  name: string
  text: string
}

let kept: Arrived | null = null
const takers = new Set<(file: Arrived) => void>()

/** A file came: to the app, if it is listening, or else kept for it. */
export function arrive(file: Arrived) {
  if (takers.size) takers.forEach((take) => take(file))
  else kept = file
}

/** Hands each file that arrives to `take`, first the one that waited; gives back how to stop. */
export function onArrived(take: (file: Arrived) => void): () => void {
  takers.add(take)
  if (kept) {
    const file = kept
    kept = null
    take(file)
  }
  return () => void takers.delete(take)
}

/** Whether a file's name is one of the copies kept on a memory card (`copies.ts`): sealed ones say nothing more. */
const isCopy = (name: string) => /^copia-[0-9a-f]{6}-\d{8}-\d{4}\.dat$/i.test(name)

/**
 * Whether a file's name says it is work shared from Servos (`.servos`, or `.servos.json` as a page inside Claude saves
 * it), or a copy of it.
 */
export const isShared = (name: string) => /\.servos(\.json)?$/i.test(name) || isCopy(name)

/** Whether a file is worth reading as text to see if it is shared work: a shared one, or JSON or text by its name. */
const readable = (name: string) => isShared(name) || /\.(json|txt)$/i.test(name)

/** The file to receive among those dropped together: the first shared from Servos, or else the first. */
export function fileToReceive<T extends { name: string }>(files: T[]): T | undefined {
  return files.find((f) => isShared(f.name)) ?? files[0]
}

const carriesFiles = (e: DragEvent) => Boolean(e.dataTransfer?.types?.includes('Files'))

/**
 * Files dropped on the window go to «Receive»; while they are dragged over it, gives back true, for the window to say
 * where they will go. Another kind of file is not read (a recording, a picture): «Receive» says it is not shared work.
 */
export function useDroppedFiles(): boolean {
  const [over, setOver] = useState(false)
  useEffect(() => {
    // Entering and leaving each element inside the window are told too: it is over the window until as many leaves.
    let depth = 0
    const enter = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      depth += 1
      setOver(true)
    }
    const leave = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setOver(false)
    }
    // A file dropped is the app's to take, not the browser's to open in place of the app.
    const move = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
    }
    // The mouse moves on its own only when nothing is dragged: a drag ended without a word (cancelled) is over.
    const free = () => {
      if (depth === 0) return
      depth = 0
      setOver(false)
    }
    const drop = (e: DragEvent) => {
      if (!carriesFiles(e)) return
      e.preventDefault()
      depth = 0
      setOver(false)
      const file = fileToReceive([...(e.dataTransfer?.files ?? [])])
      if (!file) return
      if (!readable(file.name)) return arrive({ name: file.name, text: '' })
      file.text().then(
        (text) => arrive({ name: file.name, text }),
        () => arrive({ name: file.name, text: '' })
      )
    }
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragover', move)
    window.addEventListener('drop', drop)
    window.addEventListener('mousemove', free)
    return () => {
      window.removeEventListener('mousemove', free)
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragover', move)
      window.removeEventListener('drop', drop)
    }
  }, [])
  return over
}
