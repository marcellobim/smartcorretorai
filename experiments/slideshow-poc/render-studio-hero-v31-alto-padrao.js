const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

const ROOT = __dirname
const INPUT_DIR = path.join(ROOT, 'input', 'alto-padrao-01')
const IMAGES_DIR = path.join(INPUT_DIR, 'images')
const AUDIO_DIR = path.join(ROOT, 'input', 'audio')
const OUTPUT_DIR = path.join(ROOT, 'output')
const WORK_DIR = path.join(os.tmpdir(), `smartcorretorai-studio-hero-v31-alto-${process.pid}`)
const SLIDES_JSON = path.join(INPUT_DIR, 'slides.json')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'output-v31-alto-padrao-01.mp4')

const WIDTH = 1080
const HEIGHT = 1920
const FPS = 30
const SLIDE_SECONDS = 3.4
const CTA_SECONDS = 3.2
const TRANSITION_SECONDS = 0.62

function getFfmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH
  try {
    return require('ffmpeg-static')
  } catch {
    return 'ffmpeg'
  }
}

const FFMPEG = getFfmpegPath()

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'] })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${path.basename(command)} exited with code ${code}`))
    })
  })
}

function ffPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

function textFile(name, text) {
  const filePath = path.join(WORK_DIR, name)
  fs.writeFileSync(filePath, String(text || '').trim(), 'utf8')
  return filePath
}

function getFontFiles() {
  const boldCandidates = [
    'C:\\Windows\\Fonts\\segoeuib.ttf',
    'C:\\Windows\\Fonts\\arialbd.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
  ]
  const regularCandidates = [
    'C:\\Windows\\Fonts\\segoeui.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  ]

  return {
    bold: boldCandidates.find((candidate) => fs.existsSync(candidate)) || null,
    regular: regularCandidates.find((candidate) => fs.existsSync(candidate)) || null,
  }
}

function encodeArgs(outputSegment) {
  return [
    '-r', String(FPS),
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '17',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputSegment,
  ]
}

function sceneMotion(type, seconds) {
  const frames = Math.round(seconds * FPS)
  const p = `on/${frames}`
  const t = `t/${seconds}`

  const motions = {
    facade: {
      name: 'cinematic-approach',
      z: `min(1.075,1+0.075*${p})`,
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih-ih/zoom)*(0.58-0.10*${p})`,
      fgX: `18+18*${t}`,
      fgY: `54-16*${t}`,
    },
    pool: {
      name: 'aspirational-wide-pan',
      z: '1.055',
      x: `(iw-iw/zoom)*(0.10+0.55*${p})`,
      y: `(ih-ih/zoom)*0.48`,
      fgX: `-18+36*${t}`,
      fgY: '58',
    },
    amenity: {
      name: 'open-amenity-pan',
      z: '1.055',
      x: `(iw-iw/zoom)*(0.16+0.50*${p})`,
      y: `(ih-ih/zoom)*0.50`,
      fgX: `-16+32*${t}`,
      fgY: '60',
    },
    gourmet: {
      name: 'diagonal-gourmet-travel',
      z: '1.06',
      x: `(iw-iw/zoom)*(0.18+0.42*${p})`,
      y: `(ih-ih/zoom)*(0.62-0.20*${p})`,
      fgX: `-14+28*${t}`,
      fgY: `64-18*${t}`,
    },
    living: {
      name: 'soft-lateral-living',
      z: '1.052',
      x: `(iw-iw/zoom)*(0.12+0.58*${p})`,
      y: 'ih/2-(ih/zoom/2)',
      fgX: `-22+44*${t}`,
      fgY: '62',
    },
    kitchen: {
      name: 'elegant-kitchen-pan',
      z: '1.052',
      x: `(iw-iw/zoom)*(0.62-0.48*${p})`,
      y: 'ih/2-(ih/zoom/2)',
      fgX: `20-38*${t}`,
      fgY: '64',
    },
    suite: {
      name: 'premium-suite-push',
      z: `min(1.075,1+0.075*${p})`,
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih-ih/zoom)*(0.48-0.05*${p})`,
      fgX: '8',
      fgY: `62-18*${t}`,
    },
    bedroom: {
      name: 'quiet-bedroom-drift',
      z: `min(1.06,1+0.06*${p})`,
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih-ih/zoom)*(0.45+0.08*${p})`,
      fgX: `12+14*${t}`,
      fgY: '62',
    },
    balcony: {
      name: 'depth-balcony-move',
      z: '1.06',
      x: `(iw-iw/zoom)*(0.18+0.42*${p})`,
      y: `(ih-ih/zoom)*(0.65-0.32*${p})`,
      fgX: `-18+34*${t}`,
      fgY: `72-26*${t}`,
    },
    view: {
      name: 'depth-view-move',
      z: '1.052',
      x: `(iw-iw/zoom)*(0.08+0.44*${p})`,
      y: `(ih-ih/zoom)*(0.55-0.20*${p})`,
      fgX: `-16+26*${t}`,
      fgY: `66-20*${t}`,
    },
    bathroom: {
      name: 'short-detail-bathroom',
      z: `min(1.045,1+0.045*${p})`,
      x: 'iw/2-(iw/zoom/2)',
      y: 'ih/2-(ih/zoom/2)',
      fgX: '0',
      fgY: '58',
    },
    detail: {
      name: 'controlled-detail-move',
      z: `min(1.045,1+0.045*${p})`,
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih-ih/zoom)*(0.48+0.06*${p})`,
      fgX: `6+10*${t}`,
      fgY: '60',
    },
  }

  return motions[type] || motions.detail
}

function transitionFor(type, index) {
  const byType = {
    pool: 'fadeblack',
    amenity: 'smoothleft',
    gourmet: 'smoothup',
    living: 'fade',
    kitchen: 'smoothleft',
    suite: 'fadeblack',
    bedroom: 'fade',
    balcony: 'smoothup',
    view: 'smoothup',
    bathroom: 'fade',
    detail: 'fade',
  }
  return byType[type] || (index % 2 ? 'fade' : 'smoothleft')
}

function slideFilter({ type, captionFile, fonts, seconds }) {
  const motion = sceneMotion(type, seconds)
  const frames = Math.round(seconds * FPS)
  const font = fonts.bold
  const regular = fonts.regular || fonts.bold

  const treatment = 'eq=contrast=1.055:saturation=1.02:brightness=-0.004'

  if (!font) {
    return {
      name: motion.name,
      args: [
        '-filter_complex',
        `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${WIDTH}:${HEIGHT},zoompan=z='${motion.z}':x='${motion.x}':y='${motion.y}':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},${treatment},fade=t=in:st=0:d=0.18,fade=t=out:st=${seconds - 0.22}:d=0.22,format=yuv420p[vout]`,
        '-map', '[vout]',
      ],
    }
  }

  const filter = [
    `[0:v]split=2[bgsrc][fgsrc]`,
    `[bgsrc]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${WIDTH}:${HEIGHT},zoompan=z='${motion.z}':x='${motion.x}':y='${motion.y}':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},boxblur=12:1,${treatment},vignette=angle=PI/6:mode=backward[bg]`,
    `[fgsrc]scale=${WIDTH + 96}:${HEIGHT + 170}:force_original_aspect_ratio=increase:flags=lanczos,crop=${WIDTH + 96}:${HEIGHT + 170},zoompan=z='${motion.z}':x='${motion.x}':y='${motion.y}':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},${treatment},format=rgba,colorchannelmixer=aa=0.94[fg]`,
    `[bg][fg]overlay=x='${motion.fgX}':y='${motion.fgY}':shortest=1,drawbox=x=0:y=0:w=iw:h=ih:color=black@0.04:t=fill[base]`,
    `[base]drawbox=x=118:y=h-470:w=iw-236:h=126:color=black@0.30:t=fill,drawbox=x=118:y=h-470:w=iw-236:h=3:color=white@0.72:t=fill,drawtext=fontfile='${ffPath(font)}':textfile='${ffPath(captionFile)}':fontcolor=white:fontsize=54:x=(w-text_w)/2:y=h-424,drawtext=fontfile='${ffPath(regular)}':text='STUDIO HERO IA':fontcolor=white@0.52:fontsize=21:x=(w-text_w)/2:y=h-318,fade=t=in:st=0:d=0.18,fade=t=out:st=${seconds - 0.22}:d=0.22,format=yuv420p[vout]`,
  ].join(';')

  return {
    name: motion.name,
    args: ['-filter_complex', filter, '-map', '[vout]'],
  }
}

async function createSlideSegment(slide, index) {
  const inputImage = path.join(IMAGES_DIR, slide.image)
  const fonts = getFontFiles()
  const captionFile = textFile(`caption-${index}.txt`, slide.caption)
  const outputSegment = path.join(WORK_DIR, `segment-${String(index + 1).padStart(2, '0')}.mp4`)
  const seconds = SLIDE_SECONDS
  const filter = slideFilter({ type: slide.type, captionFile, fonts, seconds })

  console.log(`V3.1 slide ${index + 1}: ${slide.type} / ${filter.name} / ${slide.caption}`)

  await run(FFMPEG, [
    '-y',
    '-loop', '1',
    '-i', inputImage,
    ...filter.args,
    '-t', String(seconds),
    ...encodeArgs(outputSegment),
  ])

  return {
    file: outputSegment,
    duration: seconds,
    transition: transitionFor(slide.type, index),
    movement: filter.name,
  }
}

async function createCtaSegment(config, lastImage, index) {
  const inputImage = path.join(IMAGES_DIR, lastImage)
  const fonts = getFontFiles()
  const outputSegment = path.join(WORK_DIR, `segment-${String(index + 1).padStart(2, '0')}-cta.mp4`)
  const ctaFile = textFile('cta.txt', String(config.cta || 'Agende sua visita').toUpperCase())
  const supportFile = textFile('support.txt', 'Apartamento alto padrao | Visita com hora marcada')
  const font = fonts.bold
  const regular = fonts.regular || fonts.bold
  const seconds = CTA_SECONDS
  const frames = Math.round(seconds * FPS)

  const filter = font
    ? [
        `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${WIDTH}:${HEIGHT},zoompan=z='1.035':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},eq=contrast=1.05:saturation=1.0:brightness=-0.01,boxblur=2:1,vignette=angle=PI/4:mode=backward[bg]`,
        `[bg]drawbox=x=0:y=0:w=iw:h=ih:color=black@0.30:t=fill,drawbox=x=92:y=ih-650:w=iw-184:h=360:color=black@0.58:t=fill,drawbox=x=92:y=ih-650:w=iw-184:h=4:color=white@0.88:t=fill,drawtext=fontfile='${ffPath(font)}':textfile='${ffPath(ctaFile)}':fontcolor=white:fontsize=76:x=(w-text_w)/2:y=h-565,drawtext=fontfile='${ffPath(regular)}':textfile='${ffPath(supportFile)}':fontcolor=white@0.74:fontsize=29:x=(w-text_w)/2:y=h-408,drawbox=x=238:y=ih-270:w=iw-476:h=82:color=white@0.94:t=fill,drawtext=fontfile='${ffPath(font)}':text='SMARTCORRETORAI':fontcolor=black@0.90:fontsize=30:x=(w-text_w)/2:y=h-244,fade=t=in:st=0:d=0.24,fade=t=out:st=${seconds - 0.25}:d=0.25,format=yuv420p[vout]`,
      ].join(';')
    : `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},format=yuv420p[vout]`

  console.log(`V3.1 CTA: ${config.cta}`)

  await run(FFMPEG, [
    '-y',
    '-loop', '1',
    '-i', inputImage,
    '-filter_complex', filter,
    '-map', '[vout]',
    '-t', String(seconds),
    ...encodeArgs(outputSegment),
  ])

  return {
    file: outputSegment,
    duration: seconds,
    transition: 'fadeblack',
    movement: 'stable-cta-frame',
  }
}

async function crossfadeSegments(segments, targetFile) {
  const args = ['-y']
  for (const segment of segments) args.push('-i', segment.file)

  const filters = []
  let previousLabel = '[0:v]'
  let currentDuration = segments[0].duration

  for (let index = 1; index < segments.length; index += 1) {
    const outLabel = index === segments.length - 1 ? '[vout]' : `[v${index}]`
    const offset = Math.max(0, currentDuration - TRANSITION_SECONDS)
    const transition = segments[index - 1].transition || 'fade'
    filters.push(`${previousLabel}[${index}:v]xfade=transition=${transition}:duration=${TRANSITION_SECONDS}:offset=${offset.toFixed(2)}${outLabel}`)
    previousLabel = outLabel
    currentDuration = currentDuration + segments[index].duration - TRANSITION_SECONDS
  }

  await run(FFMPEG, [
    ...args,
    '-filter_complex', filters.join(';'),
    '-map', '[vout]',
    ...encodeArgs(targetFile),
  ])
}

async function addMusicIfAvailable(videoFile, finalFile) {
  const musicFile = path.join(AUDIO_DIR, 'music.mp3')
  if (!fs.existsSync(musicFile)) {
    fs.copyFileSync(videoFile, finalFile)
    console.log('No music found. Exporting V3.1 test without audio.')
    return false
  }

  await run(FFMPEG, [
    '-y',
    '-i', videoFile,
    '-stream_loop', '-1',
    '-i', musicFile,
    '-shortest',
    '-map', '0:v:0',
    '-map', '1:a:0',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '192k',
    '-af', 'volume=0.54,afade=t=in:st=0:d=1.0,afade=t=out:st=24:d=1.6',
    '-movflags', '+faststart',
    finalFile,
  ])
  return true
}

async function main() {
  ensureDir(OUTPUT_DIR)
  fs.rmSync(WORK_DIR, { recursive: true, force: true })
  ensureDir(WORK_DIR)

  const config = JSON.parse(fs.readFileSync(SLIDES_JSON, 'utf8'))
  const slides = Array.isArray(config.slides) ? config.slides : []
  if (slides.length < 6) throw new Error('V3.1 test needs at least 6 images.')

  for (const slide of slides) {
    const imagePath = path.join(IMAGES_DIR, slide.image)
    if (!fs.existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`)
  }

  const segments = []
  for (let index = 0; index < slides.length; index += 1) {
    segments.push(await createSlideSegment(slides[index], index))
  }
  segments.push(await createCtaSegment(config, slides[slides.length - 1].image, slides.length))

  const silentVideo = path.join(WORK_DIR, 'studio-hero-v31-alto-no-audio.mp4')
  await crossfadeSegments(segments, silentVideo)
  const hasMusic = await addMusicIfAvailable(silentVideo, OUTPUT_FILE)

  const finalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0) - ((segments.length - 1) * TRANSITION_SECONDS)
  const summary = {
    output: OUTPUT_FILE,
    durationSeconds: Number(finalDuration.toFixed(2)),
    music: hasMusic,
    slides: slides.map((slide, index) => ({
      order: index + 1,
      image: slide.image,
      type: slide.type,
      caption: slide.caption,
      movement: segments[index].movement,
      transition: segments[index].transition,
    })),
    cta: {
      caption: config.cta,
      movement: segments[segments.length - 1].movement,
      transition: segments[segments.length - 1].transition,
    },
  }
  fs.writeFileSync(path.join(OUTPUT_DIR, 'output-v31-alto-padrao-01-summary.json'), JSON.stringify(summary, null, 2), 'utf8')

  fs.rmSync(WORK_DIR, { recursive: true, force: true })
  console.log(`V3.1 test generated: ${OUTPUT_FILE}`)
  console.log(`Estimated duration: ${finalDuration.toFixed(1)}s`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
