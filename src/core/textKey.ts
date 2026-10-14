const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = (1n << 64n) - 1n;

/**
 * The key of a verse's text: two texts with the same key are the same text. 64-bit FNV-1a over the UTF-16 code
 * units, in hex. It only has to tell the verses of one book apart, synchronously and the same on every device.
 */
export function textKey(text: string): string {
  if (!text) return "";
  let hash = OFFSET;
  for (let i = 0; i < text.length; i++) {
    hash ^= BigInt(text.charCodeAt(i));
    hash = (hash * PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, "0");
}
