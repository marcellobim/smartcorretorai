import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/pages/HeroNext.jsx', import.meta.url), 'utf8')

test('official Banner and guest share a single sequential question flow', () => {
  assert.match(source, /HeroNext\(\{ guestMode = false/)
  assert.match(source, /currentQuestion\.question/)
  assert.match(source, /setChatIndex\(nextMissingIndex\)/)
  assert.match(source, /Uma pergunta por vez/)
  assert.doesNotMatch(source, /questionDrafts|briefingReady|data-banner-question|Preencha as informações abaixo/)
  assert.match(source, /updatedAnswers\.contactPhoneChoice === 'Sim, quero divulgar'/)
  assert.match(source, /onRequireAccount=\{guestMode \? requireGuestAccount/)
})

test('upload handler reads a real JPEG and preserves the single guest-image limit', async () => {
  const block = source.slice(source.indexOf('  const handleFiles = async'), source.indexOf('  const pollGeneration = async'))
  let uploaded = [], missing = ['old'], error = 'old'
  const readImage = async () => 'data:image/jpeg;base64,' + readFileSync(new URL('../public/virtual-staging/virtual-staging-before.jpg', import.meta.url)).toString('base64')
  const handler = new Function('guestMode', 'MAX_HERO_NEXT_IMAGES', 'fileToDataUrl', 'setUploadedImages', 'setMissingImageMetadata', 'setGenerationError', 'getSmartTokenErrorMessage', block + ';return handleFiles')(
    true, 4, readImage, x => uploaded = x, x => missing = x, x => error = x, () => 'read_failed',
  )
  const file = { name: 'upload-test.jpg', type: 'image/jpeg', size: 100, lastModified: 1 }
  await handler([{ name: 'ignored.txt', type: 'text/plain' }, file, { ...file, name: 'second.jpg' }])
  assert.equal(uploaded.length, 1)
  assert.equal(uploaded[0].name, file.name)
  assert.match(uploaded[0].data, /^data:image\/jpeg;base64,/)
  assert.deepEqual(missing, [])
  assert.equal(error, '')
  assert.match(source, /onChange=\{\(event\) => handleFiles\(event.target.files\)\}/)
})
