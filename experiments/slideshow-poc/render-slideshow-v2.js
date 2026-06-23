const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

const ROOT = __dirname
const INPUT_DIR = path.join(ROOT, 'input')
const IMAGES_DIR = path.join(INPUT_DIR, 'images')
const AUDIO_DIR = path.join(INPUT_DIR, 'audio')
const OUTPUT_DIR = path.join(ROOT, 'output')
const WORK_DIR = path.join(os.tmpdir(), `smartcorretorai-slideshow-poc-v2-${process.pid}`)
const SLIDES_JSON = path.join(INPUT_DIR, 'slides.json')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'output-v2.mp4')

const WIDTH = 1080
const HEIGHT = 1920
const FPS = 30
const SLIDE_SECONDS = 3.45
const CTA_SECONDS = 3.2
const TRANSITION_SECONDS = 0.62
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
      else reject(new Error(`${path.basename(command)} exited with code ${code}`))
    })
  })
}

function ffPath(filePath) {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'")
}

function wrapText(text, maxChars = 23) {
  const clean = String(text || '')
    .replace(/\s+/g, ' ')
    .trim()

  const words = clean.split(' ').filter(Boolean)
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
  return lines.slice(0, 2).join('\n')
}

function writeTextFile(name, text, maxChars) {
  const filePath = path.join(WORK_DIR, name)
  fs.writeFileSync(filePath, wrapText(text, maxChars), 'utf8')
  return filePath
}

function getFontFiles() {
  const boldCandidates = [
    'C:\\Windows\\Fonts\\segoeuib.ttf',
    'C:\\Windows\\Fonts\\arialbd.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  ]

  const regularCandidates = [
    'C:\\Windows\\Fonts\\segoeui.ttf',
    'C:\\Windows\\Fonts\\arial.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    '/System/Library/Fonts/Supplemental/Arial.ttf',
  ]

  return {
    bold: boldCandidates.find((candidate) => fs.existsSync(candidate)) || null,
    regular: regularCandidates.find((candidate) => fs.existsSync(candidate)) || null,
  }
}

function encodeSegmentArgs(outputSegment) {
  return [
    '-r', String(FPS),
    '-c:v', 'libx264',
    '-preset', 'slow',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    outputSegment,
  ]
}

async function ensureReferencedImages(slides) {
  if (slides.length < MIN_REAL_IMAGES || slides.length > MAX_REAL_IMAGES) {
    throw new Error(`Add between ${MIN_REAL_IMAGES} and ${MAX_REAL_IMAGES} real photos. Found: ${slides.length}.`)
  }

  for (let index = 0; index < slides.length; index += 1) {
    const imagePath = path.join(IMAGES_DIR, slides[index].image)
    if (!fs.existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`)
    if (/^foto\d+\.(jpe?g|png|webp)$/i.test(slides[index].image)) {
      throw new Error(`Placeholder-like image should not be used: ${imagePath}`)
    }
  }
}

function classifyScene(slide, index) {
  const text = `${slide.image || ''} ${slide.caption || ''}`.toLowerCase()

  if (/fachada|portaria|entrada|externa|frente/.test(text)) return 'facade'
  if (/sala|ambiente|living|integrado/.test(text)) return 'living'
  if (/suite|quarto|dormitorio/.test(text)) return 'suite'
  if (/lazer|piscina|academia|varanda|churrasqueira/.test(text)) return 'amenity'
  if (/vista|bairro|localizacao|cidade/.test(text)) return 'location'

  return ['facade', 'living', 'suite', 'amenity', 'location', 'detail'][index % 6]
}

function captionEnvironmentFor(slide) {
  if (slide.environment) return slide.environment

  const text = `${slide.image || ''} ${slide.caption || ''}`.toLowerCase()

  if (/cozinha|gourmet|copa/.test(text)) return 'kitchen'
  if (/sala|living|ambiente|integrado/.test(text)) return 'living'
  if (/suite|su[ií]te/.test(text)) return 'suite'
  if (/quarto|dormitorio|dormit[oó]rio/.test(text)) return 'bedroom'
  if (/lazer|piscina|academia|churrasqueira|condominio|condom[ií]nio/.test(text)) return 'amenity'
  if (/vista|bairro|localizacao|localiza[cç][aã]o/.test(text)) return 'location'
  if (/varanda|sacada/.test(text)) return 'balcony'
  if (/banheiro|lavabo/.test(text)) return 'bathroom'

  return null
}

function isGenericCaption(caption) {
  return /ambientes que valorizam|detalhes pensados|fotos reais|apresentado com clareza|diferenciais em evid[eê]ncia|divulga[cç][aã]o mais profissional/i.test(String(caption || ''))
}

function captionForSlide(slide) {
  if (slide.caption && !isGenericCaption(slide.caption)) return slide.caption

  const captions = {
    living: 'LIVING INTEGRADO',
    kitchen: 'COZINHA PLANEJADA',
    suite: 'SUITE MASTER',
    bedroom: 'DORMITORIO AMPLO',
    amenity: 'LAZER COM VISTA',
    location: 'LOCALIZACAO PRIVILEGIADA',
    balcony: 'VARANDA GOURMET',
    bathroom: 'ACABAMENTO PREMIUM',
  }

  return captions[captionEnvironmentFor(slide)] || cleanCaptionFallback(slide.caption)
}

function eyebrowForSlide(slide) {
  const labels = {
    living: 'AMBIENTE',
    kitchen: 'COZINHA',
    suite: 'SUITE',
    bedroom: 'DORMITORIO',
    amenity: 'LAZER',
    location: 'LOCALIZACAO',
    balcony: 'VARANDA',
    bathroom: 'DETALHE',
  }

  return labels[captionEnvironmentFor(slide)] || 'IMOVEL'
}

function cleanCaptionFallback(caption) {
  return String(caption || 'IMOVEL EM DESTAQUE').toUpperCase()
}

function movementForScene(scene, index, seconds) {
  const totalFrames = Math.round(seconds * FPS)
  const progress = `on/${totalFrames}`

  const options = {
    facade: {
      name: 'slow-push-in',
      z: `min(1.135,1+0.135*${progress})`,
      x: 'iw/2-(iw/zoom/2)',
      y: 'ih/2-(ih/zoom/2)',
    },
    living: {
      name: 'travelling-left-to-right',
      z: '1.105',
      x: `(iw-iw/zoom)*${progress}`,
      y: 'ih/2-(ih/zoom/2)',
    },
    suite: {
      name: 'gentle-pull-out',
      z: `max(1.015,1.13-0.115*${progress})`,
      x: 'iw/2-(iw/zoom/2)',
      y: 'ih/2-(ih/zoom/2)',
    },
    amenity: {
      name: 'diagonal-travel',
      z: '1.12',
      x: `(iw-iw/zoom)*${progress}`,
      y: `(ih-ih/zoom)*(1-${progress})`,
    },
    location: {
      name: 'vertical-rise',
      z: '1.09',
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih-ih/zoom)*(1-${progress})`,
    },
    detail: {
      name: index % 2 === 0 ? 'right-to-left-detail' : 'left-to-right-detail',
      z: '1.12',
      x: index % 2 === 0 ? `(iw-iw/zoom)*(1-${progress})` : `(iw-iw/zoom)*${progress}`,
      y: 'ih/2-(ih/zoom/2)',
    },
  }

  const movement = options[scene] || options.detail
  return {
    name: movement.name,
    filter: [
      `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos`,
      `crop=${WIDTH}:${HEIGHT}`,
      `zoompan=z='${movement.z}':x='${movement.x}':y='${movement.y}':d=${totalFrames}:s=${WIDTH}x${HEIGHT}:fps=${FPS}`,
      'eq=contrast=1.055:saturation=1.075:brightness=0.005',
      'vignette=angle=PI/5:mode=backward',
      'setsar=1',
    ].join(','),
  }
}

function premiumCaptionOverlay({ captionFile, fonts }) {
  if (!fonts.bold) return ''

  return [
    'drawbox=x=124:y=ih-420:w=iw-248:h=204:color=black@0.40:t=fill',
    'drawbox=x=164:y=ih-270:w=138:h=5:color=white@0.84:t=fill',
    `drawtext=fontfile='${ffPath(fonts.bold)}':textfile='${ffPath(captionFile)}':fontcolor=white@0.97:fontsize=48:line_spacing=12:x=164:y=h-360`,
  ].join(',')
}

function cinematicTreatment(index, seconds) {
  return [
    'fade=t=in:st=0:d=0.18',
    `fade=t=out:st=${Math.max(0.1, seconds - 0.22)}:d=0.22`,
  ].filter(Boolean).join(',')
}

async function createSlideSegment(slide, index) {
  const inputImage = path.join(IMAGES_DIR, slide.image)
  const scene = classifyScene(slide, index)
  const movement = movementForScene(scene, index, SLIDE_SECONDS)
  const fonts = getFontFiles()
  const captionFile = writeTextFile(`caption-${index}.txt`, captionForSlide(slide), 18)
  const outputSegment = path.join(WORK_DIR, `segment-${String(index + 1).padStart(2, '0')}.mp4`)

  const filters = [
    movement.filter,
    premiumCaptionOverlay({ captionFile, fonts }),
    cinematicTreatment(index, SLIDE_SECONDS),
    'format=yuv420p',
  ].filter(Boolean).join(',')

  console.log(`V2 slide ${index + 1}: ${scene} / ${movement.name}`)

  await run(FFMPEG, [
    '-y',
    '-loop', '1',
    '-i', inputImage,
    '-vf', filters,
    '-t', String(SLIDE_SECONDS),
    ...encodeSegmentArgs(outputSegment),
  ])

  return { file: outputSegment, duration: SLIDE_SECONDS, transition: transitionFor(index) }
}

function transitionFor(index) {
  const transitions = ['fade', 'smoothleft', 'fadeblack', 'smoothup', 'distance']
  return transitions[index % transitions.length]
}

async function createCtaSegment({ cta, image, index }) {
  const inputImage = path.join(IMAGES_DIR, image)
  const fonts = getFontFiles()
  const outputSegment = path.join(WORK_DIR, `segment-${String(index + 1).padStart(2, '0')}-cta.mp4`)
  const ctaFile = writeTextFile('cta.txt', cta || 'Agende sua visita', 18)
  const supportFile = writeTextFile('cta-support.txt', 'WhatsApp do corretor', 22)
  const movement = movementForScene('detail', index + 2, CTA_SECONDS)

  const overlayFilter = fonts.bold
    ? [
        'drawbox=x=0:y=0:w=iw:h=ih:color=black@0.34:t=fill',
        'drawbox=x=86:y=ih-610:w=iw-172:h=330:color=black@0.50:t=fill',
        'drawbox=x=86:y=ih-610:w=iw-172:h=6:color=white@0.86:t=fill',
        `drawtext=fontfile='${ffPath(fonts.bold)}':textfile='${ffPath(ctaFile)}':fontcolor=white:fontsize=72:line_spacing=16:x=(w-text_w)/2:y=h-535`,
        `drawtext=fontfile='${ffPath(fonts.regular || fonts.bold)}':textfile='${ffPath(supportFile)}':fontcolor=white@0.72:fontsize=34:x=(w-text_w)/2:y=h-350`,
        'drawbox=x=250:y=ih-255:w=iw-500:h=78:color=white@0.92:t=fill',
        `drawtext=fontfile='${ffPath(fonts.bold)}':text='SMARTCORRETORAI':fontcolor=black@0.90:fontsize=28:x=(w-text_w)/2:y=h-232`,
        'fade=t=in:st=0:d=0.25',
        `fade=t=out:st=${CTA_SECONDS - 0.28}:d=0.28`,
      ].join(',')
    : ''

  const filters = [movement.filter, overlayFilter, 'format=yuv420p'].filter(Boolean).join(',')

  console.log(`V2 CTA: ${movement.name}`)

  await run(FFMPEG, [
    '-y',
    '-loop', '1',
    '-i', inputImage,
    '-vf', filters,
    '-t', String(CTA_SECONDS),
    ...encodeSegmentArgs(outputSegment),
  ])

  return { file: outputSegment, duration: CTA_SECONDS, transition: 'fadeblack' }
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
    const transition = segments[index - 1].transition || 'fade'
    filters.push(`${previousLabel}[${index}:v]xfade=transition=${transition}:duration=${TRANSITION_SECONDS}:offset=${offset.toFixed(2)}${outLabel}`)
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
    console.log('No music found. Exporting V2 without audio.')
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
    '-b:a', '192k',
    '-af', 'volume=0.64,afade=t=in:st=0:d=1.0,afade=t=out:st=20:d=1.5',
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

  if (!fs.existsSync(SLIDES_JSON)) throw new Error(`Missing file: ${SLIDES_JSON}`)

  const config = JSON.parse(fs.readFileSync(SLIDES_JSON, 'utf8'))
  const slides = Array.isArray(config.slides) ? config.slides : []
  if (!slides.length) throw new Error('slides.json needs at least one slide.')

  await ensureReferencedImages(slides)

  const segments = []
  for (let index = 0; index < slides.length; index += 1) {
    segments.push(await createSlideSegment(slides[index], index))
  }

  const ctaImage = slides[slides.length - 1]?.image || slides[0].image
  segments.push(await createCtaSegment({ cta: config.cta || 'Agende sua visita', image: ctaImage, index: slides.length }))

  const silentVideo = path.join(WORK_DIR, 'slideshow-v2-no-audio.mp4')
  await crossfadeSegments(segments, silentVideo)
  await addMusicIfAvailable(silentVideo, OUTPUT_FILE)

  const finalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0) - ((segments.length - 1) * TRANSITION_SECONDS)
  fs.rmSync(WORK_DIR, { recursive: true, force: true })
  console.log(`V2 video generated: ${OUTPUT_FILE}`)
  console.log(`Estimated duration: ${finalDuration.toFixed(1)}s`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
