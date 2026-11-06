import keys from 'virtual:servos-v3-keys'

/**
 * The Ed25519 public keys Servos trusts for format 3 catalogs: the `*.pub` files of bt-synergy's
 * `language-pack-v3/keys/`, read when the app is built (`trustedKeysV3` in vite.config.ts). The key id is the file name.
 * Nothing is kept in this repository and nothing is fetched. The map is always passed as `trustedKeys`, even if empty:
 * an empty map still demands signatures, so a build without keys trusts nothing.
 */
export function trustedKeys(): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = {}
  for (const [id, text] of Object.entries(keys)) {
    if (!/^[0-9a-f]{64}$/.test(text)) throw new Error(`bt-synergy key ${id}.pub is not 64 hex characters`)
    out[id] = Uint8Array.from(text.match(/../g)!, (h) => parseInt(h, 16))
  }
  return out
}
