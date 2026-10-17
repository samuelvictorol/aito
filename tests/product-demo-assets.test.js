import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

const assets = [
  ['flow', 840], ['flow', 1440], ['order', 420], ['order', 720],
  ['chats', 840], ['chats', 1440], ['phone', 420], ['phone', 720],
  ['adapt', 840], ['adapt', 1440], ['ai-emblem', null],
]

for (const [name, width] of assets) {
  const basename = width ? `${name}-${width}` : name
  test(`${basename}: WebP has a complete RIFF container and PNG fallback decodes`, () => {
    const webp = readFileSync(new URL(`../public/product-demo/${basename}.webp`, import.meta.url))
    assert.equal(webp.toString('ascii', 0, 4), 'RIFF')
    assert.equal(webp.toString('ascii', 8, 12), 'WEBP')
    assert.equal(webp.readUInt32LE(4), webp.length - 8, 'RIFF length must match the file, including streamed exports')
    let offset = 12
    let hasImage = false
    while (offset < webp.length) {
      assert.ok(offset + 8 <= webp.length, 'Truncated WebP chunk header')
      const type = webp.toString('ascii', offset, offset + 4)
      const size = webp.readUInt32LE(offset + 4)
      offset += 8 + size + (size % 2)
      assert.ok(offset <= webp.length, 'Truncated WebP chunk payload')
      if (type === 'VP8 ' || type === 'VP8L') hasImage = true
    }
    assert.ok(hasImage, 'WebP must contain an image frame')
    assert.equal(offset, webp.length)

    const png = readFileSync(new URL(`../public/product-demo/${basename}.png`, import.meta.url))
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
    assert.equal(png.toString('ascii', 12, 16), 'IHDR')
    if (width) assert.equal(png.readUInt32BE(16), width)
    const height = png.readUInt32BE(20)
    const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[png[25]]
    assert.equal(png[24], 8, 'PNG fallback uses an 8-bit color format')
    assert.ok(channels, 'PNG fallback uses grayscale, RGB, or RGBA')
    assert.equal(png[28], 0, 'PNG fallback uses standard scanlines')
    const compressed = []
    let ended = false
    offset = 8
    while (offset < png.length) {
      assert.ok(offset + 12 <= png.length, 'Truncated PNG chunk header')
      const size = png.readUInt32BE(offset)
      const type = png.toString('ascii', offset + 4, offset + 8)
      assert.ok(offset + size + 12 <= png.length, 'Truncated PNG chunk payload')
      if (type === 'IDAT') compressed.push(png.subarray(offset + 8, offset + 8 + size))
      offset += size + 12
      if (type === 'IEND') { ended = true; break }
    }
    assert.ok(ended, 'PNG must have a complete IEND chunk')
    assert.equal(offset, png.length)
    const decoded = inflateSync(Buffer.concat(compressed))
    assert.equal(decoded.length, (png.readUInt32BE(16) * channels + 1) * height, 'Every PNG scanline must be complete')
  })
}
