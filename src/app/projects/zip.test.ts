import { inflateRawSync } from 'node:zlib'
import { expect, it } from 'vitest'
import { crc32, zipStore } from './zip'

/** What a zip reader sees: each entry by the central directory, its bytes read where its local header says. */
function unzip(zip: Uint8Array): Array<{ name: string; bytes: Uint8Array; crc: number }> {
  const v = new DataView(zip.buffer, zip.byteOffset, zip.byteLength)
  const end = zip.length - 22
  expect(v.getUint32(end, true)).toBe(0x06054b50)
  const count = v.getUint16(end + 10, true)
  let at = v.getUint32(end + 16, true)
  const out = []
  for (let i = 0; i < count; i++) {
    expect(v.getUint32(at, true)).toBe(0x02014b50)
    const method = v.getUint16(at + 10, true)
    const crc = v.getUint32(at + 16, true)
    const size = v.getUint32(at + 20, true)
    const nameLength = v.getUint16(at + 28, true)
    const local = v.getUint32(at + 42, true)
    const name = new TextDecoder().decode(zip.subarray(at + 46, at + 46 + nameLength))
    expect(v.getUint32(local, true)).toBe(0x04034b50)
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    const raw = zip.subarray(start, start + size)
    out.push({ name, bytes: method === 0 ? raw : new Uint8Array(inflateRawSync(raw)), crc })
    at += 46 + nameLength + v.getUint16(at + 30, true) + v.getUint16(at + 32, true)
  }
  return out
}

it('el crc32 es el de siempre', () => {
  expect(crc32(new TextEncoder().encode('123456789')).toString(16)).toBe('cbf43926')
})

it('un zip con las grabaciones de un libro se abre con sus nombres y sus bytes tal como eran', () => {
  const files = [
    { name: 'audio/JON/001/001-003.webm', bytes: new Uint8Array([1, 2, 3, 4, 5]) },
    { name: 'audio/JON/002/002-010.webm', bytes: new Uint8Array(1000).map((_, i) => i % 251) },
    { name: 'leeme-ñandú.txt', bytes: new TextEncoder().encode('Tomas de Jonás') },
  ]
  const read = unzip(zipStore(files, new Date(2026, 9, 17, 10, 30)))
  expect(read.map((f) => f.name)).toEqual(files.map((f) => f.name))
  read.forEach((f, i) => {
    expect([...f.bytes]).toEqual([...files[i].bytes])
    expect(f.crc).toBe(crc32(files[i].bytes))
  })
})
