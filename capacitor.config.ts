import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Servos on a phone (design, section 11): the same app inside an Android app, built with `vite build --mode telefono`.
 * The identifier is the one the app for computers has: the place of the work on each device, never changed.
 */
const config: CapacitorConfig = {
  appId: 'org.idiomaspuentes.servos',
  appName: 'Servos',
  webDir: 'dist-telefono',
  android: {
    // Nothing is loaded over plain http.
    allowMixedContent: false,
  },
  // The paper the app is drawn on, until its first screen is there.
  backgroundColor: '#f7f2e8',
  plugins: {
    // The app is drawn under the system's bars (edge to edge) and the WebView is shrunk above the keyboard, as Chrome
    // does: the box being written stays in sight (useVisibleBox in MiniAppScreen.tsx).
    Keyboard: { resizeOnFullScreen: true },
  },
}

export default config
