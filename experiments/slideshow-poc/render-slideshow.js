const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

const ROOT = __dirname
const INPUT_DIR = path.join(ROOT, 'input')
const IMAGES_DIR = path.join(INPUT_DIR, 'images')
const AUDIO_DIR = path.join(INPUT_DIR, 'audio')
const OUTPUT_DIR = path.join(ROOT, 'output')
const WORK_DIR = path.join(os.tmpdir(), `smartcorretorai-slideshow-poc-${process.pid}`)
const SLIDES_JSON = path.join(INPUT_DIR, 'slides.json')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'output.mp4')

const WIDTH = 1080
const HEIGHT = 1920
const FPS = 30
const SLIDE_SECONDS = 3.8
const CTA_SECONDS = 2.8
const TRANSITION_SECONDS = 0.55
const MIN_REAL_IMAGES = 6
const MAX_REAL_IMAGES = 10

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
      else reject(new Error(`${path.basename(command)} saiu com código ${code}`))
    })
  })
}

function ffPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

function wrapText(text, maxChars = 30) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean)
  const lines = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length > maxChars && current) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) lines.push(current)
  return lines.slice(0, 3).join('\n')
}

function writeTextFile(name, text, maxChars) {
  const filePath = path.join(WORK_DIR, name)
  fs.writeFileSync(filePath, wrapText(text, maxChars), 'utf8')
  return filePath
}

function getFontFile() {
  const candidates = [
    'C:\\Windows\\Fonts\\arialbd.ttf',
    'C:\\Windows\\Fonts\\segoeuib.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  ]

  return candidates.find((candidate) => fs.existsSync(candidate)) || null
}

function encodeSegmentArgs(outputSegment) {
  return [
    '-r', String(FPS),
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputSegment,
  ]
}

async function ensureReferencedImages(slides) {
  if (slides.length < MIN_REAL_IMAGES || slides.length > MAX_REAL_IMAGES) {
    throw new Error(`Adicione entre ${MIN_REAL_IMAGES} e ${MAX_REAL_IMAGES} fotos reais no slides.json. Encontrado: ${slides.length}.`)
  }

  for (let index = 0; index < slides.length; index += 1) {
    const imagePath = path.join(IMAGES_DIR, slides[index].image)
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Imagem não encontrada: ${imagePath}`)
    }

    if (/^foto\d+\.(jpe?g|png|webp)$/i.test(slides[index].image)) {
      throw new Error(`A imagem parece ser placeholder de teste e não deve ser usada: ${imagePath}`)
    }
  }
}

function kenBurnsFilter(index, seconds) {
  const totalFrames = Math.round(seconds * FPS)
  const zoomIn = `min(1.10,1+0.10*on/${totalFrames})`
  const zoomOut = `max(1.0,1.10-0.10*on/${totalFrames})`
  const steady = '1.08'

  const movements = [
    {
      name: 'zoom-in',
      z: zoomIn,
      x: 'iw/2-(iw/zoom/2)',
      y: 'ih/2-(ih/zoom/2)',
    },
    {
      name: 'zoom-out',
      z: zoomOut,
      x: 'iw/2-(iw/zoom/2)',
      y: 'ih/2-(ih/zoom/2)',
    },
    {
      name: 'left-to-right',
      z: steady,
      x: `(iw-iw/zoom)*on/${totalFrames}`,
      y: 'ih/2-(ih/zoom/2)',
    },
    {
      name: 'right-to-left',
      z: steady,
      x: `(iw-iw/zoom)*(1-on/${totalFrames})`,
      y: 'ih/2-(ih/zoom/2)',
    },
    {
      name: 'top-to-bottom',
      z: steady,
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih-ih/zoom)*on/${totalFrames}`,
    },
    {
      name: 'bottom-to-top',
      z: steady,
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih-ih/zoom)*(1-on/${totalFrames})`,
    },
  ]

  const movement = movements[index % movements.length]
  return {
    name: movement.name,
    filter: [
      `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase`,
      `crop=${WIDTH}:${HEIGHT}`,
      `zoompan=z='${movement.z}':x='${movement.x}':y='${movement.y}':d=${totalFrames}:s=${WIDTH}x${HEIGHT}:fps=${FPS}`,
      'setsar=1',
    ].join(','),
  }
}

function captionOverlay(captionFile, font) {
  if (!font) return ''

  return [
    'drawbox=x=80:y=ih-335:w=iw-160:h=160:color=black@0.34:t=fill',
    `drawtext=fontfile='${ffPath(font)}':textfile='${ffPath(captionFile)}':fontcolor=white@0.94:fontsize=44:line_spacing=12:x=(w-text_w)/2:y=h-285`,
  ].join(',')
}

async function createSlideSegment({ image, caption }, index) {
  const inputImage = path.join(IMAGES_DIR, image)
  const captionFile = writeTextFile(`caption-${index}.txt`, caption, 31)
  const outputSegment = path.join(WORK_DIR, `segment-${String(index + 1).padStart(2, '0')}.mp4`)
  const font = getFontFile()
  const movement = kenBurnsFilter(index, SLIDE_SECONDS)

  const filters = [
    movement.filter,
    captionOverlay(captionFile, font),
    'fade=t=in:st=0:d=0.25',
    `fade=t=out:st=${SLIDE_SECONDS - 0.25}:d=0.25`,
    'format=yuv420p',
  ].filter(Boolean).join(',')

  console.log(`Movimento slide ${index + 1}: ${movement.name}`)

  await run(FFMPEG, [
    '-y',
    '-loop', '1',
    '-i', inputImage,
    '-vf', filters,
    '-t', String(SLIDE_SECONDS),
    ...encodeSegmentArgs(outputSegment),
  ])

  return { file: outputSegment, duration: SLIDE_SECONDS }
}

async function createCtaSegment(cta, image, index) {
  const inputImage = path.join(IMAGES_DIR, image)
  const outputSegment = path.join(WORK_DIR, `segment-${String(index + 1).padStart(2, '0')}-cta.mp4`)
  const ctaFile = writeTextFile('cta.txt', cta || 'Agende sua visita', 24)
  const font = getFontFile()
  const movement = kenBurnsFilter(index + 4, CTA_SECONDS)

  const overlayFilter = font
    ? [
        'drawbox=x=0:y=0:w=iw:h=ih:color=black@0.22:t=fill',
        'drawbox=x=110:y=ih-470:w=iw-220:h=210:color=black@0.48:t=fill',
        `drawtext=fontfile='${ffPath(font)}':textfile='${ffPath(ctaFile)}':fontcolor=white:fontsize=62:line_spacing=18:x=(w-text_w)/2:y=h-395`,
        'fade=t=in:st=0:d=0.30',
        `fade=t=out:st=${CTA_SECONDS - 0.30}:d=0.30`,
      ].join(',')
    : ''

  const filters = [movement.filter, overlayFilter, 'format=yuv420p'].filter(Boolean).join(',')

  await run(FFMPEG, [
    '-y',
    '-loop', '1',
    '-i', inputImage,
    '-vf', filters,
    '-t', String(CTA_SECONDS),
    ...encodeSegmentArgs(outputSegment),
  ])

  return { file: outputSegment, duration: CTA_SECONDS }
}

async function crossfadeSegments(segments, targetFile) {
  if (segments.length === 1) {
    fs.copyFileSync(segments[0].file, targetFile)
    return
  }

  const args = ['-y']
  for (const segment of segments) args.push('-i', segment.file)

  const filters = []
  let previousLabel = '[0:v]'
  let currentDuration = segments[0].duration

  for (let index = 1; index < segments.length; index += 1) {
    const outLabel = index === segments.length - 1 ? '[vout]' : `[v${index}]`
    const offset = Math.max(0, currentDuration - TRANSITION_SECONDS)
    filters.push(`${previousLabel}[${index}:v]xfade=transition=fade:duration=${TRANSITION_SECONDS}:offset=${offset.toFixed(2)}${outLabel}`)
    previousLabel = outLabel
    currentDuration = currentDuration + segments[index].duration - TRANSITION_SECONDS
  }

  await run(FFMPEG, [
    ...args,
    '-filter_complex', filters.join(';'),
    '-map', '[vout]',
    ...encodeSegmentArgs(targetFile),
  ])
}

async function addMusicIfAvailable(videoFile, finalFile) {
  const musicFile = path.join(AUDIO_DIR, 'music.mp3')
  if (!fs.existsSync(musicFile)) {
    fs.copyFileSync(videoFile, finalFile)
    console.log('Música não encontrada. Exportando vídeo sem áudio.')
    return
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
    '-b:a', '160k',
    '-af', 'volume=0.72',
    '-movflags', '+faststart',
    finalFile,
  ])
}

async function main() {
  ensureDir(IMAGES_DIR)
  ensureDir(AUDIO_DIR)
  ensureDir(OUTPUT_DIR)
  fs.rmSync(WORK_DIR, { recursive: true, force: true })
  ensureDir(WORK_DIR)

  if (!fs.existsSync(SLIDES_JSON)) {
    throw new Error(`Arquivo não encontrado: ${SLIDES_JSON}`)
  }

  const config = JSON.parse(fs.readFileSync(SLIDES_JSON, 'utf8'))
  const slides = Array.isArray(config.slides) ? config.slides : []
  if (!slides.length) throw new Error('slides.json precisa ter pelo menos um slide.')

  await ensureReferencedImages(slides)

  const segments = []
  for (let index = 0; index < slides.length; index += 1) {
    console.log(`Renderizando foto ${index + 1}/${slides.length}`)
    segments.push(await createSlideSegment(slides[index], index))
  }

  console.log('Renderizando CTA final sobre foto')
  const ctaImage = slides[slides.length - 1]?.image || slides[0].image
  segments.push(await createCtaSegment(config.cta || 'Agende sua visita', ctaImage, slides.length))

  const silentVideo = path.join(WORK_DIR, 'slideshow-no-audio.mp4')
  await crossfadeSegments(segments, silentVideo)
  await addMusicIfAvailable(silentVideo, OUTPUT_FILE)

  const finalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0) - ((segments.length - 1) * TRANSITION_SECONDS)
  fs.rmSync(WORK_DIR, { recursive: true, force: true })
  console.log(`Vídeo gerado: ${OUTPUT_FILE}`)
  console.log(`Duração estimada: ${finalDuration.toFixed(1)}s`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
