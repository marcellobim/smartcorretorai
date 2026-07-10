import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const outputDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(outputDirectory, '..', '..', '..', '..')
const durationSeconds = 60
const ffmpeg = process.env.FFMPEG_PATH || path.join(
  repositoryRoot,
  'experiments',
  'slideshow-poc',
  'node_modules',
  'ffmpeg-static',
  process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg',
)

const tracks = [
  { file: 'moderna.m4a', frequencies: [220, 261.63, 329.63, 440], pulseHz: 2, bassHz: 2, brightness: 12000 },
  { file: 'calma.m4a', frequencies: [130.81, 164.81, 196, 261.63], pulseHz: 0.25, bassHz: 0.5, brightness: 8500 },
  { file: 'sofisticada.m4a', frequencies: [146.83, 174.61, 220, 261.63], pulseHz: 0.5, bassHz: 1, brightness: 10000 },
  { file: 'animada.m4a', frequencies: [196, 246.94, 293.66, 392], pulseHz: 4, bassHz: 4, brightness: 13500 },
  { file: 'instrumental.m4a', frequencies: [164.81, 196, 246.94, 329.63], pulseHz: 1, bassHz: 1.5, brightness: 10500 },
]

function channelExpression(frequencies, pulseHz, bassHz, detune) {
  const voices = frequencies
    .map((frequency, index) => `${(0.045 - index * 0.005).toFixed(3)}*sin(2*PI*${(frequency * detune).toFixed(3)}*t)`)
    .join('+')
  const pulse = `(0.72+0.28*sin(2*PI*${pulseHz}*t)*sin(2*PI*${pulseHz}*t))`
  const bass = `0.035*sin(2*PI*${(frequencies[0] / 2 * detune).toFixed(3)}*t)*(0.55+0.45*sin(2*PI*${bassHz}*t))`
  return `${pulse}*(${voices})+${bass}`
}

for (const track of tracks) {
  const expression = [
    channelExpression(track.frequencies, track.pulseHz, track.bassHz, 1),
    channelExpression(track.frequencies, track.pulseHz, track.bassHz, 1.003),
  ].join('|')
  const result = spawnSync(ffmpeg, [
    '-y',
    '-f', 'lavfi',
    '-i', `aevalsrc=${expression}:s=48000:d=${durationSeconds}`,
    '-t', String(durationSeconds),
    '-af', `highpass=f=45,lowpass=f=${track.brightness},aecho=0.8:0.25:60:0.12,acompressor=threshold=0.12:ratio=2.5:attack=30:release=250`,
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '48000',
    '-ac', '2',
    path.join(outputDirectory, track.file),
  ], { stdio: 'inherit' })

  if (result.status !== 0) process.exit(result.status || 1)
}
