import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMusicFinishingArgs } from './video-renderer.ts'

const baseInput = {
  videoFile: 'video.mp4',
  outputFile: 'final.mp4',
  musicFile: 'music.m4a',
  musicVolume: 0.08,
  durationSeconds: 12,
  fadeInSeconds: 1.2,
  fadeOutSeconds: 2.2,
}

test('Smart Video com audio preserva o mix entre voz original e musica', () => {
  const args = buildMusicFinishingArgs({ ...baseInput, hasOriginalAudio: true })
  const filter = args[args.indexOf('-filter_complex') + 1]

  assert.match(filter, /\[0:a\]volume=0\.85/)
  assert.match(filter, /\[voice\]\[music\]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0/)
  assert.match(filter, /alimiter=limit=0\.95/)
  assert.match(filter, /loudnorm=I=-23:LRA=7:TP=-2/)
  assert.match(filter, /volume=0\.450/)
  assert.match(filter, /afade=t=in:st=0:d=1\.200/)
  assert.match(filter, /afade=t=out:st=9\.800:d=2\.200/)
})

test('Smart Video sem audio usa somente a musica sem referenciar 0:a', () => {
  const args = buildMusicFinishingArgs({ ...baseInput, hasOriginalAudio: false })
  const filter = args[args.indexOf('-filter_complex') + 1]

  assert.doesNotMatch(filter, /\[0:a\]/)
  assert.doesNotMatch(filter, /amix=/)
  assert.match(filter, /^\[1:a\]/)
  assert.match(filter, /loudnorm=I=-23:LRA=7:TP=-2/)
  assert.match(filter, /volume=0\.080/)
  assert.match(filter, /afade=t=in:st=0:d=1\.200/)
  assert.match(filter, /afade=t=out:st=9\.800:d=2\.200/)
  assert.match(filter, /aresample=48000/)
  assert.match(filter, /aformat=sample_rates=48000:channel_layouts=stereo\[aout\]$/)
  assert.equal(args[args.indexOf('-c:a') + 1], 'aac')
  assert.equal(args[args.indexOf('-ar') + 1], '48000')
  assert.equal(args[args.indexOf('-ac') + 1], '2')
  assert.equal(args[args.indexOf('-t') + 1], '12.000')
  assert.ok(args.includes('-shortest'))
})
