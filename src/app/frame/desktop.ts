/**
 * Servos on a computer (design, section 11): the same app in a window of its own (Tauri, `src-tauri`), where it does
 * what a browser cannot. A `.servos` file opened on the computer (a double click on it, Servos open or not) arrives to
 * be received (`arriving.ts`); a file the app makes is saved where the person chooses, in the system's save dialog;
 * and the browser's own menu (Back, Reload, Print…) does not come up over the app. Elsewhere none of it runs.
 */

import { arrive, type Arrived } from './arriving'

/** Whether this is the app for computers: Tauri puts itself in the window. */
export const onDesktop = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** The program's word that files were opened (`src-tauri/src/lib.rs`). */
const OPENED = 'archivos-abiertos'

/** Files opened on the computer go to be received: the one Servos was started with, and each opened later. */
export function receiveOpenedFiles() {
  if (!onDesktop()) return
  void (async () => {
    const { invoke } = await import('@tauri-apps/api/core')
    const { listen } = await import('@tauri-apps/api/event')
    // Each is taken once, whether it was said or was already waiting.
    const take = async () => (await invoke<Arrived[]>('opened_files')).forEach(arrive)
    await listen(OPENED, () => void take())
    await take()
  })().catch(() => {})
}

/** Saves a file in the system's save dialog, under the name given; the name it got, or null when the dialog was closed. */
export async function saveOnDesktop(name: string, text: string): Promise<string | null> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<string | null>('save_file', { name, text })
}

/**
 * The browser's own menu is not the app's: on a computer it comes up only where it serves, to cut, copy and paste in a
 * box, or to copy what was selected (a verse of the bridge text, say).
 */
export function keepBrowserMenuToText() {
  if (!onDesktop()) return
  window.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement | null
    if (target?.closest?.('input, textarea, [contenteditable]') || window.getSelection()?.toString()) return
    e.preventDefault()
  })
}
