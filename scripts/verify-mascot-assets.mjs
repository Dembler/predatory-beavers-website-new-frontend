import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const directory = process.argv[2]
  ? pathToFileURL(resolve(process.argv[2]) + sep)
  : new URL('../public/mascot/bobrik/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('animation.json', directory), 'utf8'))
assert.equal(manifest.id, 'bobrik', 'Expected the unified Bobrik character')
const atlas = await readFile(new URL(manifest.image.file, directory))
const launcher = await readFile(new URL('launcher.webp', directory))
const { width, height, frameWidth, frameHeight, columns, rows, sha256 } = manifest.image

function webpDimensions(buffer) {
  assert.equal(buffer.toString('ascii', 0, 4), 'RIFF')
  assert.equal(buffer.toString('ascii', 8, 12), 'WEBP')
  const type = buffer.toString('ascii', 12, 16)
  if (type === 'VP8X') {
    assert(buffer[20] & 0x10, 'WebP must preserve transparency')
    return [buffer.readUIntLE(24, 3) + 1, buffer.readUIntLE(27, 3) + 1]
  }
  assert.equal(type, 'VP8L', 'Expected lossless WebP or an extended WebP header')
  assert.equal(buffer[20], 0x2f, 'Invalid lossless WebP signature')
  const bits = buffer.readUInt32LE(21)
  assert((bits >>> 28) & 1, 'Lossless WebP must preserve transparency')
  return [(bits & 0x3fff) + 1, ((bits >>> 14) & 0x3fff) + 1]
}

assert.deepEqual(webpDimensions(atlas), [width, height])
assert.deepEqual(webpDimensions(launcher), [frameWidth, frameHeight])
assert.deepEqual(
  [width, height, frameWidth, frameHeight, columns, rows],
  [1536, 1872, 192, 208, 8, 9],
)
assert.equal(width, columns * frameWidth)
assert.equal(height, rows * frameHeight)
assert.equal(createHash('sha256').update(atlas).digest('hex'), sha256)
assert.equal(createHash('sha256').update(launcher).digest('hex'), manifest.launcher.sha256)
assert(atlas.length <= 1024 * 1024, 'Web atlas exceeds the 1 MiB target')
assert(launcher.length <= 80 * 1024, 'Launcher exceeds 80 KiB')
assert(width * height * 4 <= 16 * 1024 * 1024, 'Decoded atlas exceeds 16 MiB')
assert(manifest.clips[manifest.defaultClip], 'Missing default clip')
for (const [name, clip] of Object.entries(manifest.clips)) {
  assert(Number.isInteger(clip.row) && clip.row >= 0 && clip.row < rows, name)
  assert(
    Number.isInteger(clip.frameCount) && clip.frameCount > 0 && clip.frameCount <= columns,
    name,
  )
  assert.equal(clip.durationsMs.length, clip.frameCount, name)
  assert(
    clip.durationsMs.every((duration) => Number.isFinite(duration) && duration >= 1000 / 24),
    name,
  )
}
console.log(`Bobrik assets verified: ${atlas.length} B atlas, ${launcher.length} B launcher.`)
