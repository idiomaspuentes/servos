/**
 * Servos on a phone (design, section 11): the same app inside an Android app (Capacitor, `android/`), where it does
 * what a browser cannot. A `.servos` file opened with Servos («Abrir con») or shared to it from WhatsApp or Bluetooth
 * arrives to be received (`arriving.ts`), as on a computer (`desktop.ts`); and a file the app makes goes out by the
 * phone's own share sheet, to a message, Bluetooth, or a folder where the person keeps it. Elsewhere none of it runs.
 *
 * The phone's back button goes back in the page's history, which the app keeps so that it closes the sheet on top
 * before going back (App.tsx); with nothing left to go back to, on home, the app goes behind the others, as any app
 * does, and is found as it was when it comes back.
 */

import { arrive, type Arrived } from './arriving'

type Native = { isNativePlatform?(): boolean; getPlatform?(): string }

/** Whether this is the app for phones: Capacitor puts itself in the page. */
export const onPhone = () =>
  typeof window !== 'undefined' && Boolean((window as unknown as { Capacitor?: Native }).Capacitor?.isNativePlatform?.())

/** The app's word that files were opened (`android/…/ArrivalsPlugin.java`). */
const OPENED = 'archivos-abiertos'

interface Arrivals {
  opened(): Promise<{ files: Arrived[] }>
  addListener(event: string, listener: () => void): Promise<unknown>
}

/** Files opened with Servos go to be received: the one it was started with, and each opened or shared later. */
export function receiveArrivingFiles() {
  if (!onPhone()) return
  void (async () => {
    const { registerPlugin } = await import('@capacitor/core')
    const arrivals = registerPlugin<Arrivals>('ServosArrivals')
    // Each is taken once, whether it was said or was already waiting.
    const take = async () => (await arrivals.opened()).files.forEach(arrive)
    await arrivals.addListener(OPENED, () => void take())
    await take()
  })().catch(() => {})
}

/**
 * The phone's back button: back in the app while there is somewhere to go back to, or else out of the way. Where to go
 * back to is the app's own entries in the history (App.tsx), not the WebView's word: an entry the app set without a
 * touch (a file that arrived and opened «Recibir») does not count for the WebView, which would leave the app. With the
 * keyboard up, the keyboard takes the button first and only goes down, as in Chrome.
 */
export function keepBackButton() {
  if (!onPhone()) return
  void import('@capacitor/app')
    .then(({ App }) =>
      App.addListener('backButton', () => {
        if ((history.state as { servos?: boolean } | null)?.servos) history.back()
        else void App.minimizeApp()
      })
    )
    .catch(() => {})
}

/**
 * Sends a file out by the phone's share sheet, under the name given: to WhatsApp, Bluetooth, or «Guardar en…» a
 * folder. Gives back whether the sheet was left without choosing; Android does not say where the file went.
 */
export async function shareOnPhone(name: string, text: string): Promise<'shared' | 'declined'> {
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  // Written where the app keeps what it lets go of; the next file of the same name takes its place.
  const { uri } = await Filesystem.writeFile({ path: `compartir/${name}`, data: text, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true })
  try {
    await Share.share({ files: [uri], title: name })
    return 'shared'
  } catch (e) {
    if (/cancel/i.test(String((e as { message?: string }).message ?? e))) return 'declined'
    throw e
  }
}
