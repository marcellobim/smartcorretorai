import test from 'node:test'
import assert from 'node:assert/strict'
import { validGuestImages } from './guest-input.ts'

test('replays the image-free choice that failed before reservation', () => {
  assert.equal([].length !== 1, true) // Previous backend gate rejected this input.
  assert.equal(validGuestImages([], []), true)
  assert.equal(validGuestImages(undefined, []), true)
})

test('retains a single valid upload and rejects malformed or excessive uploads', () => {
  const image = { contentType: 'image/png', data: 'aGVsbG8=' }
  assert.equal(validGuestImages([image], [image]), true)
  assert.equal(validGuestImages([image, image], [image, image]), false)
  assert.equal(validGuestImages([image], []), false)
  assert.equal(validGuestImages('arbitrary', []), false)
  assert.equal(validGuestImages([{}], [{ ...image, contentType: 'text/html' }]), false)
  assert.equal(validGuestImages([{}], [{ ...image, data: '<script>' }]), false)
  assert.equal(validGuestImages([{}], [{ ...image, data: 'a'.repeat(4 * 1024 * 1024 + 1) }]), false)
})
