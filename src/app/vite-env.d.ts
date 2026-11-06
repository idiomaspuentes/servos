/// <reference types="vite/client" />

/** The app's version (package.json) and the commit it was built from: said in the person's menu, for reports. */
declare const __APP_VERSION__: string
declare const __APP_BUILD__: string

/** The trusted public keys of format 3 packs: key id to 64 hex chars (`trustedKeysV3` in vite.config.ts). */
declare module 'virtual:servos-v3-keys' {
  const keys: Record<string, string>
  export default keys
}
