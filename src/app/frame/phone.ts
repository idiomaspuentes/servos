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

/** The app's word that files were opened (`android/…/FilesPlugin.java`). */
const OPENED = 'archivos-abiertos'

/** Files between Servos and the rest of the phone (`android/…/FilesPlugin.java`). */
interface Files {
  opened(): Promise<{ files: Arrived[] }>
  /** Writes a piece of a file to share (`append` false: the first, which starts it anew). */
  write(piece: { name: string; base64: string; append: boolean }): Promise<void>
  /** Deletes a file to share that could not be written whole. */
  discard(file: { name: string }): Promise<void>
  /** Shares the file written under `name`. */
  share(file: { name: string; type: string; keepHere: string }): Promise<{ saved?: string }>
  shareText(options: { text: string }): Promise<void>
  addListener(event: string, listener: () => void): Promise<unknown>
}

// Registered once. Handed back inside an object: the plugin answers to any method name, `then` too, so a promise that
// resolved to it would take it for another promise and call it.
let plugin: Files | undefined
const files = async (): Promise<{ plugin: Files }> => {
  plugin ??= (await import('@capacitor/core')).registerPlugin<Files>('ServosFiles')
  return { plugin }
}

/** Files opened with Servos go to be received: the one it was started with, and each opened or shared later. */
export function receiveArrivingFiles() {
  if (!onPhone()) return
  void (async () => {
    const { plugin: arrivals } = await files()
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

/** Whether a CSS colour (`rgb(…)`) is light enough to want dark writing on it. */
export function isLight(colour: string): boolean {
  const [r, g, b] = (colour.match(/\d+(\.\d+)?/g) ?? []).map(Number)
  if (r === undefined || g === undefined || b === undefined) return true
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 140
}

/** A CSS colour (`rgb(…)`) as Android takes it, `#rrggbb`; null when it is not one. */
export function hexOf(colour: string): string | null {
  const [r, g, b] = (colour.match(/\d+(\.\d+)?/g) ?? []).map(Number)
  if (r === undefined || g === undefined || b === undefined) return null
  return `#${[r, g, b].map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')}`
}

/**
 * The phone's bars (the clock above, the buttons below) sit on strips of the window around the page: the strips take
 * the app's own ground, and the bars' writing the colour that reads on it, whatever theme the person chose apart from
 * the phone's (light on a dark phone, «modo sol»).
 */
export function followTheme() {
  if (!onPhone()) return
  void import('@capacitor/core')
    .then(({ SystemBars, SystemBarsStyle, registerPlugin }) => {
      const window_ = registerPlugin<{ setBackground(o: { color: string }): Promise<void> }>('ServosWindow')
      let was = ''
      const follow = () => {
        const ground = getComputedStyle(document.body).backgroundColor
        if (ground === was) return
        was = ground
        const hex = hexOf(ground)
        // The style first: Capacitor's sets the window back to the theme's ground each time.
        void SystemBars.setStyle({ style: isLight(ground) ? SystemBarsStyle.Light : SystemBarsStyle.Dark })
          .then(() => (hex ? window_.setBackground({ color: hex }) : undefined))
          .catch(() => {})
      }
      follow()
      new MutationObserver(follow).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', follow)
    })
    .catch(() => {})
}

/** A few words out by the phone's share sheet, to a message. */
export async function shareTextOnPhone(text: string): Promise<void> {
  await (await files()).plugin.shareText({ text })
}

/** The share before, settled or not; the next starts after it. */
let sharing: Promise<unknown> = Promise.resolve()

/**
 * Sends a file out by the phone's share sheet, under the name given and with its type (an app refuses a file whose type
 * it is not told): to WhatsApp, Bluetooth, or kept on the phone itself, in a folder the person chooses, the first place
 * on the sheet, named `keepHere`. Gives back the name it was kept under on the phone; elsewhere, nothing: Android does
 * not say where it went, nor whether the sheet was left without choosing.
 */
export function shareOnPhone(name: string, text: string | Uint8Array, type: string, keepHere: string): Promise<string | null> {
  // One at a time: two of the same name at once (a double touch) would cut and mix each other's pieces in one file.
  const turn = sharing.then(() => shareNow(name, text, type, keepHere))
  sharing = turn.catch(() => {})
  return turn
}

async function shareNow(name: string, text: string | Uint8Array, type: string, keepHere: string): Promise<string | null> {
  const { plugin } = await files()
  await writeInPieces(plugin, name, typeof text === 'string' ? new TextEncoder().encode(text) : text)
  // Only the name crosses with the call that opens the sheet: Android keeps that call in the activity's saved state
  // while the sheet is up, and a file in it (megabytes) is over what it lets through, which closed the app.
  const { saved } = await plugin.share({ name, type, keepHere })
  return saved ?? null
}

/** The bytes of one piece: a multiple of 3, so each piece is base64 by itself (256 KB of it). */
export const PIECE = 196_608

/**
 * Writes a file for the share sheet into the app's cache, a piece per call: a whole file in one call is held several
 * times over as text on both sides of the bridge. A file that could not be written whole is deleted.
 */
export async function writeInPieces(plugin: Pick<Files, 'write' | 'discard'>, name: string, bytes: Uint8Array, piece = PIECE): Promise<void> {
  try {
    let at = 0
    do {
      await plugin.write({ name, base64: base64Of(bytes.subarray(at, at + piece)), append: at > 0 })
      at += piece
    } while (at < bytes.length)
  } catch (e) {
    await plugin.discard({ name }).catch(() => {})
    throw e
  }
}

/** Bytes as base64, a piece at a time (a whole megabyte spread into one call would overflow the stack). */
export function base64Of(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(out)
}
