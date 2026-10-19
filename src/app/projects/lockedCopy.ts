/**
 * A copy of the work that only its password opens (philosophy, principle 9: the work is not lost and not exposed).
 * Some teams translate where the Bible is banned: a copy on a memory card that anyone can read could cost them their
 * freedom or their life. So the copy says nothing to whoever finds it: no name, no words, not even that it is Servos's.
 * It is the work as «Share» makes it (`share.ts`), compressed, then encrypted with AES-256-GCM under a key drawn from
 * the password (PBKDF2, SHA-256), all on the device, without internet; and written as plain letters (base64), so
 * every way a file comes in (opened with Servos, chosen in «Receive», pasted) can carry it.
 *
 * The key is drawn once, when the person chooses the password, and kept on the device unable to leave it (a
 * non-extractable key): the copies made after need no password, and nobody can read the key out of the app. The
 * password itself is not kept anywhere: forgotten, the copies cannot be opened, by anyone.
 *
 * Its letters, decoded: four bytes that mark it (`SVc1`), the salt (16), the nonce (12), and the sealed text.
 */

const MARK = [0x53, 0x56, 0x63, 0x31]
const SALT = 16
const NONCE = 12
/** The rounds that make guessing a password slow (OWASP's figure for PBKDF2-SHA256, 2023). */
export const ROUNDS = 600_000

/** A key to seal copies with, and the salt it was drawn with (written in each copy, to draw it again from the password). */
export interface CopyKey {
  key: CryptoKey
  salt: Uint8Array
}

const subtle = () => globalThis.crypto.subtle

/** Draws the key from a password: once when it is chosen, and again to open a copy. */
export async function keyFrom(password: string, salt: Uint8Array = globalThis.crypto.getRandomValues(new Uint8Array(SALT)), rounds = ROUNDS): Promise<CopyKey> {
  const base = await subtle().importKey('raw', new TextEncoder().encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveKey'])
  const key = await subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: rounds },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
  return { key, salt }
}

/** The work, sealed: letters that say nothing. */
export async function lock(text: string, { key, salt }: CopyKey): Promise<string> {
  const nonce = globalThis.crypto.getRandomValues(new Uint8Array(NONCE))
  const sealed = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: nonce }, key, (await squeeze(text)) as BufferSource))
  const all = new Uint8Array(MARK.length + SALT + NONCE + sealed.length)
  all.set(MARK, 0)
  all.set(salt, MARK.length)
  all.set(nonce, MARK.length + SALT)
  all.set(sealed, MARK.length + SALT + NONCE)
  return toLetters(all)
}

/** Whether a text is a sealed copy (it is told by its first letters, which are the same in every copy). */
export function isLocked(text: string): boolean {
  const head = fromLetters(text.trim().slice(0, 8))
  return head !== null && MARK.every((b, i) => head[i] === b)
}

/** Opens a sealed copy with its password: the work's text, or null when the password is not the one it was sealed with. */
export async function unlock(text: string, password: string, rounds = ROUNDS): Promise<string | null> {
  const all = fromLetters(text.trim())
  if (!all || !isLocked(text)) return null
  const salt = all.slice(MARK.length, MARK.length + SALT)
  const nonce = all.slice(MARK.length + SALT, MARK.length + SALT + NONCE)
  const sealed = all.slice(MARK.length + SALT + NONCE)
  const { key } = await keyFrom(password, salt, rounds)
  try {
    const open = new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: nonce }, key, sealed))
    return await unsqueeze(open)
  } catch {
    return null
  }
}

async function squeeze(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function unsqueeze(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Response(stream).text()
}

function toLetters(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

function fromLetters(text: string): Uint8Array | null {
  try {
    const s = atob(text)
    const bytes = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
    return bytes
  } catch {
    return null
  }
}
