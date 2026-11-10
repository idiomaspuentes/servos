/**
 * Which Servos this is: its version and the commit it was built from (written in by the build, `vite.config.ts`).
 * Read with care: the screen that says something failed shows it, and must not fail itself where it is missing.
 */
import { stagingBuild } from '../../resources/online/packsServer'

export const APP_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : 'dev'
export const APP_BUILD = typeof __APP_BUILD__ === 'string' ? __APP_BUILD__ : ''
/** A test build that starts on the staging packs server says so, so nobody takes it for the real app. */
export const appLabel = () => `Servos ${APP_VERSION}${APP_BUILD ? ` · ${APP_BUILD}` : ''}${stagingBuild() ? ' · staging' : ''}`
