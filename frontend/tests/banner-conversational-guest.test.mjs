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

test('shared upload keeps zero, one and four images; rejects a fifth without losing the principal', async () => {
  const block = source.slice(source.indexOf('  const handleFiles = async'), source.indexOf('  const pollGeneration = async'))
  for (const guestMode of [false, true]) {
    let uploaded = [], missing = ['old'], error = 'old'
    const readImage = async () => 'data:image/jpeg;base64,' + readFileSync(new URL('../public/virtual-staging/virtual-staging-before.jpg', import.meta.url)).toString('base64')
    const run = files => new Function('uploadedImages', 'guestMode', 'MAX_HERO_NEXT_IMAGES', 'fileToDataUrl', 'setUploadedImages', 'setMissingImageMetadata', 'setGenerationError', 'getSmartTokenErrorMessage', block + ';return handleFiles')(
      uploaded, guestMode, 4, readImage, x => uploaded = x, x => missing = x, x => error = x, () => 'read_failed',
    )(files)
    const files = Array.from({length:5}, (_, i) => ({name:`image-${i}.jpg`,type:'image/jpeg',size:100,lastModified:i}))
    await run([])
    assert.equal(uploaded.length, 0)
    await run(files.slice(0,1))
    assert.equal(uploaded.length, 1)
    await run(files.slice(1,4))
    assert.deepEqual(uploaded.map(i => i.name), files.slice(0,4).map(i => i.name))
    assert.match(uploaded[0].data, /^data:image\/jpeg;base64,/)
    assert.deepEqual(missing, [])
    assert.equal(error, '')
    await run(files.slice(4))
    assert.equal(uploaded.length, 4)
    assert.match(error, /4 imagens/)
    assert.equal(uploaded[0].name, files[0].name)
  }
  assert.match(source, /uploadedImages.map\(\(item, index\)/)
  assert.match(source, /index === 0 \? 'Principal' : 'Apoio'/)
})
