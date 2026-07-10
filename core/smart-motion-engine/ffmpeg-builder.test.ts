import assert from 'node:assert/strict'
import test from 'node:test'
import { buildMusicArgs } from './ffmpeg-builder.ts'

test('merge musical exporta AAC 48 kHz estéreo com duração e fades', () => {
  const args = buildMusicArgs({
    videoFile: 'video.mp4',
    musicFile: 'music.m4a',
    outputFile: 'final.mp4',
    durationSeconds: 29.5,
  })
  const filter = args[args.indexOf('-filter_complex') + 1]

  assert.deepEqual(args.slice(0, 6), ['-y', '-i', 'video.mp4', '-stream_loop', '-1', '-i'])
  assert.equal(args[args.indexOf('-c:a') + 1], 'aac')
  assert.equal(args[args.indexOf('-ar') + 1], '48000')
  assert.equal(args[args.indexOf('-ac') + 1], '2')
  assert.equal(args[args.indexOf('-t') + 1], '29.500')
  assert.match(filter, /atrim=0:29\.500/)
  assert.match(filter, /loudnorm=I=-23:LRA=7:TP=-2/)
  assert.match(filter, /afade=t=in:st=0:d=1\.200/)
  assert.match(filter, /afade=t=out:st=27\.500:d=2\.000/)
  assert.match(filter, /aformat=sample_rates=48000:channel_layouts=stereo/)
})
