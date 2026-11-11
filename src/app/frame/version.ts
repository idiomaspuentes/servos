/**
 * Which Servos this is: its version and the commit it was built from (written in by the build, `vite.config.ts`).
 * Read with care: the screen that says something failed shows it, and must not fail itself where it is missing.
 */
import { packsFormat } from '../../resources/online/packsServer'

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
export const APP_BUILD = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : ''
/**
 * Servos on the staging packs server (format 3) says so, so nobody takes it for the real app. It follows the server in
 * use, not the build: a test build whose person chose production in «Acerca de» is format 2 and says nothing.
 */
export const appLabel = (format: () => 2 | 3 = packsFormat) => {
  let staging = false
  try {
    staging = format() === 3
  } catch {
    /* the screen that says something failed must not fail here */
  }
  return `Servos ${APP_VERSION}${APP_BUILD ? ` · ${APP_BUILD}` : ''}${staging ? ' · staging' : ''}`
}
