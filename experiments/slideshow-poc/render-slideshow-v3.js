const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

const ROOT = __dirname
const INPUT_DIR = path.join(ROOT, 'input')
const IMAGES_DIR = path.join(INPUT_DIR, 'images')
const AUDIO_DIR = path.join(INPUT_DIR, 'audio')
const OUTPUT_DIR = path.join(ROOT, 'output')
const WORK_DIR = path.join(os.tmpdir(), `smartcorretorai-slideshow-poc-v3-${process.pid}`)
const SLIDES_JSON = path.join(INPUT_DIR, 'slides.json')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'output-v3.mp4')

const WIDTH = 1080
const HEIGHT = 1920
const FPS = 30
const SLIDE_SECONDS = 3.15
const CTA_SECONDS = 3.35
const TRANSITION_SECONDS = 0.58
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

function cleanText(text) {
  return String(text || '').replace(/\s+/g, ' ').trim()
}

function writeTextFile(name, text) {
  const filePath = path.join(WORK_DIR, name)
  fs.writeFileSync(filePath, cleanText(text), 'utf8')
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

function encodeSegmentArgs(outputSegment) {
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

async function ensureReferencedImages(slides) {
  if (slides.length < MIN_REAL_IMAGES || slides.length > MAX_REAL_IMAGES) {
    throw new Error(`Add between ${MIN_REAL_IMAGES} and ${MAX_REAL_IMAGES} real photos. Found: ${slides.length}.`)
  }

  for (const slide of slides) {
    const imagePath = path.join(IMAGES_DIR, slide.image)
    if (!fs.existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`)
  }
}

function sceneFor(slide) {
  const text = `${slide.image || ''} ${slide.caption || ''}`.toLowerCase()

  if (/fachada|portaria|entrada|externa|frente|edificio|prédio|predio/.test(text)) return 'facade'
  if (/sala|ambiente|living|integrado/.test(text)) return 'living'
  if (/varanda|vista|sacada/.test(text)) return 'balcony'
  if (/suite|suíte|quarto|dormitorio|dormitório/.test(text)) return 'suite'
  if (/lazer|piscina|academia|churrasqueira|condominio|condomínio/.test(text)) return 'amenity'
  if (/comercial|sala comercial|corporativo|escritorio|escritório/.test(text)) return 'commercial'
  return 'detail'
}

function captionEnvironmentFor(slide) {
  if (slide.environment) return slide.environment

  const text = `${slide.image || ''} ${slide.caption || ''}`.toLowerCase()

  if (/cozinha|gourmet|copa/.test(text)) return 'kitchen'
  if (/sala|living|ambiente|integrado/.test(text)) return 'living'
  if (/suite|su[ií]te|suÃ­te/.test(text)) return 'suite'
  if (/quarto|dormitorio|dormit[oó]rio|dormitÃ³rio/.test(text)) return 'bedroom'
  if (/lazer|piscina|academia|churrasqueira|condominio|condom[ií]nio|condomÃ­nio/.test(text)) return 'amenity'
  if (/vista|bairro|localizacao|localiza[cç][aã]o/.test(text)) return 'location'
  if (/varanda|sacada/.test(text)) return 'balcony'
  if (/banheiro|lavabo/.test(text)) return 'bathroom'

  return null
}

function sortNarrative(slides) {
  const rank = {
    facade: 1,
    living: 2,
    balcony: 3,
    suite: 4,
    amenity: 5,
    commercial: 3,
    detail: 6,
  }

  return [...slides]
    .map((slide, index) => ({ ...slide, originalIndex: index, scene: sceneFor(slide) }))
    .sort((a, b) => (rank[a.scene] || 9) - (rank[b.scene] || 9) || a.originalIndex - b.originalIndex)
}

function detectProfile(config, slides) {
  const text = `${config.profile || ''} ${config.headline || ''} ${config.cta || ''} ${slides.map((s) => s.caption).join(' ')}`.toLowerCase()

  if (/comercial|corporativo|escritório|escritorio|sala comercial/.test(text)) return 'commercial'
  if (/alto padrão|alto padrao|luxo|premium|sofisticado/.test(text)) return 'luxury'
  if (/pronto para morar|acolhedor|familia|família/.test(text)) return 'ready'
  if (/mcmv|econômico|economico|subsídio|subsidio/.test(text)) return 'economic'
  return 'ready'
}

function styleForProfile(profile) {
  const styles = {
    economic: {
      seconds: 2.75,
      label: 'OPORTUNIDADE',
      treatment: 'eq=contrast=1.04:saturation=1.05:brightness=0.01',
      textSize: 56,
      transitionSet: ['smoothleft', 'fade', 'smoothup', 'distance'],
    },
    ready: {
      seconds: 3.2,
      label: 'PRONTO PARA MORAR',
      treatment: 'eq=contrast=1.045:saturation=1.045:brightness=0.002',
      textSize: 52,
      transitionSet: ['fade', 'smoothleft', 'fadeblack', 'smoothup'],
    },
    luxury: {
      seconds: 3.65,
      label: 'ALTO PADRAO',
      treatment: 'eq=contrast=1.065:saturation=0.98:brightness=-0.01',
      textSize: 48,
      transitionSet: ['fadeblack', 'fade', 'distance', 'smoothleft'],
    },
    commercial: {
      seconds: 3.05,
      label: 'COMERCIAL',
      treatment: 'eq=contrast=1.05:saturation=0.94:brightness=-0.005',
      textSize: 50,
      transitionSet: ['smoothleft', 'fadeblack', 'fade', 'smoothup'],
    },
  }

  return styles[profile] || styles.ready
}

function shortCaption(slide, scene, profileStyle) {
  const caption = cleanText(slide.caption)
  const lower = caption.toLowerCase()
  const environmentCaption = {
    living: 'LIVING INTEGRADO',
    kitchen: 'COZINHA PLANEJADA',
    suite: 'SUITE MASTER',
    bedroom: 'DORMITORIO AMPLO',
    amenity: 'LAZER COM VISTA',
    location: 'LOCALIZACAO PRIVILEGIADA',
    balcony: 'VARANDA GOURMET',
    bathroom: 'ACABAMENTO PREMIUM',
  }[captionEnvironmentFor(slide)]

  if (environmentCaption) return environmentCaption

  if (/moema/.test(lower)) return 'MOEMA'
  if (/4 suítes|4 suites/.test(lower)) return '4 SUITES'
  if (/234m|234 m/.test(lower)) return '234M2'
  if (/pronto/.test(lower)) return 'PRONTO PARA MORAR'
  if (/vista/.test(lower)) return 'VISTA LIVRE'
  if (/lazer|piscina|academia/.test(lower)) return 'LAZER COMPLETO'
  if (/sala|ambiente|living/.test(lower)) return 'AMBIENTES INTEGRADOS'
  if (/confian/.test(lower)) return 'FOTOS REAIS'
  if (/diferenciais/.test(lower)) return 'DIFERENCIAIS'

  const fallback = {
    facade: profileStyle.label,
    living: 'AMBIENTES INTEGRADOS',
    balcony: 'VISTA E VARANDA',
    suite: 'CONFORTO PRIVATIVO',
    amenity: 'LAZER EM DESTAQUE',
    commercial: 'ENDERECO ESTRATEGICO',
    detail: 'DETALHES QUE VALORIZAM',
  }

  return fallback[scene] || profileStyle.label
}

function movementFor(scene, seconds) {
  const frames = Math.round(seconds * FPS)
  const p = `on/${frames}`
  const t = `t/${seconds}`
  const base = {
    facade: {
      name: 'virtual-drone-push',
      z: `min(1.16,1+0.16*${p})`,
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih-ih/zoom)*(0.70-0.20*${p})`,
      fgX: `36+34*${t}`,
      fgY: `78-28*${t}`,
    },
    living: {
      name: 'lateral-travelling',
      z: '1.10',
      x: `(iw-iw/zoom)*${p}`,
      y: 'ih/2-(ih/zoom/2)',
      fgX: `-42+84*${t}`,
      fgY: '80',
    },
    balcony: {
      name: 'diagonal-travelling',
      z: '1.13',
      x: `(iw-iw/zoom)*${p}`,
      y: `(ih-ih/zoom)*(1-${p})`,
      fgX: `-34+70*${t}`,
      fgY: `110-42*${t}`,
    },
    suite: {
      name: 'soft-push-in',
      z: `min(1.13,1+0.13*${p})`,
      x: 'iw/2-(iw/zoom/2)',
      y: 'ih/2-(ih/zoom/2)',
      fgX: '18',
      fgY: `96-30*${t}`,
    },
    amenity: {
      name: 'wide-open-move',
      z: '1.08',
      x: `(iw-iw/zoom)*(0.15+0.70*${p})`,
      y: 'ih/2-(ih/zoom/2)',
      fgX: `20-44*${t}`,
      fgY: '90',
    },
    commercial: {
      name: 'institutional-pan',
      z: '1.07',
      x: `(iw-iw/zoom)*${p}`,
      y: 'ih/2-(ih/zoom/2)',
      fgX: `-28+54*${t}`,
      fgY: '82',
    },
    detail: {
      name: 'slow-detail-drift',
      z: `max(1.02,1.12-0.10*${p})`,
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih-ih/zoom)*(0.35+0.22*${p})`,
      fgX: `22+26*${t}`,
      fgY: `84+16*${t}`,
    },
  }

  return base[scene] || base.detail
}

function createFilter({ scene, captionFile, fonts, profileStyle, seconds, index }) {
  const movement = movementFor(scene, seconds)
  const frames = Math.round(seconds * FPS)
  const font = fonts.bold
  const regular = fonts.regular || fonts.bold
  const textSize = profileStyle.textSize
  const shadowY = scene === 'facade' ? 'h-525' : 'h-500'
  const textY = scene === 'facade' ? 'h-455' : 'h-430'

  if (!font) {
    return {
      name: movement.name,
      args: [
        '-filter_complex',
        `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${WIDTH}:${HEIGHT},zoompan=z='${movement.z}':x='${movement.x}':y='${movement.y}':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},${profileStyle.treatment},vignette=angle=PI/6:mode=backward,fade=t=in:st=0:d=0.16,fade=t=out:st=${Math.max(0.1, seconds - 0.20)}:d=0.20,format=yuv420p[vout]`,
        '-map', '[vout]',
      ],
    }
  }

  const filter = [
    `[0:v]split=2[bgsrc][fgsrc]`,
    `[bgsrc]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${WIDTH}:${HEIGHT},zoompan=z='${movement.z}':x='${movement.x}':y='${movement.y}':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},boxblur=16:2,${profileStyle.treatment},vignette=angle=PI/5:mode=backward[bg]`,
    `[fgsrc]scale=${WIDTH + 150}:${HEIGHT + 266}:force_original_aspect_ratio=increase:flags=lanczos,crop=${WIDTH + 150}:${HEIGHT + 266},zoompan=z='${movement.z}':x='${movement.x}':y='${movement.y}':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},${profileStyle.treatment},format=rgba,colorchannelmixer=aa=0.92[fg]`,
    `[bg][fg]overlay=x='${movement.fgX}':y='${movement.fgY}':shortest=1,drawbox=x=0:y=0:w=iw:h=ih:color=black@0.06:t=fill[base]`,
    `[base]drawbox=x=124:y=${shadowY}:w=iw-248:h=172:color=black@0.32:t=fill,drawbox=x=124:y=${shadowY}:w=iw-248:h=3:color=white@0.76:t=fill,drawtext=fontfile='${ffPath(font)}':textfile='${ffPath(captionFile)}':fontcolor=white:fontsize=${Math.max(42, textSize - 2)}:x=(w-text_w)/2:y=${textY},drawtext=fontfile='${ffPath(regular)}':text='SMARTCORRETORAI':fontcolor=white@0.55:fontsize=22:x=(w-text_w)/2:y=h-320,fade=t=in:st=0:d=0.16,fade=t=out:st=${Math.max(0.1, seconds - 0.20)}:d=0.20,format=yuv420p[vout]`,
  ].join(';')

  return {
    name: movement.name,
    args: ['-filter_complex', filter, '-map', '[vout]'],
  }
}

function transitionFor(index, profileStyle) {
  return profileStyle.transitionSet[index % profileStyle.transitionSet.length]
}

async function createSlideSegment(slide, index, profileStyle) {
  const inputImage = path.join(IMAGES_DIR, slide.image)
  const scene = slide.scene || sceneFor(slide)
  const seconds = profileStyle.seconds
  const fonts = getFontFiles()
  const caption = shortCaption(slide, scene, profileStyle)
  const captionFile = writeTextFile(`caption-v3-${index}.txt`, caption)
  const outputSegment = path.join(WORK_DIR, `segment-${String(index + 1).padStart(2, '0')}.mp4`)
  const filter = createFilter({ scene, captionFile, fonts, profileStyle, seconds, index })

  console.log(`V3 slide ${index + 1}: ${scene} / ${filter.name} / ${caption}`)

  await run(FFMPEG, [
    '-y',
    '-loop', '1',
    '-i', inputImage,
    ...filter.args,
    '-t', String(seconds),
    ...encodeSegmentArgs(outputSegment),
  ])

  return { file: outputSegment, duration: seconds, transition: transitionFor(index, profileStyle) }
}

async function createCtaSegment({ cta, image, index, profileStyle }) {
  const inputImage = path.join(IMAGES_DIR, image)
  const fonts = getFontFiles()
  const outputSegment = path.join(WORK_DIR, `segment-${String(index + 1).padStart(2, '0')}-cta.mp4`)
  const ctaText = cleanText(cta || 'Agende sua visita').toUpperCase()
  const ctaFile = writeTextFile('cta-v3.txt', ctaText)
  const supportFile = writeTextFile('cta-support-v3.txt', 'WhatsApp | Telefone | Logo')
  const seconds = CTA_SECONDS
  const movement = movementFor('detail', seconds)
  const frames = Math.round(seconds * FPS)

  const font = fonts.bold
  const regular = fonts.regular || fonts.bold
  const filter = font
    ? [
        `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${WIDTH}:${HEIGHT},zoompan=z='max(1.02,1.13-0.10*on/${frames})':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},${profileStyle.treatment},boxblur=3:1,vignette=angle=PI/4:mode=backward[bg]`,
        `[bg]drawbox=x=0:y=0:w=iw:h=ih:color=black@0.28:t=fill,drawbox=x=86:y=ih-650:w=iw-172:h=360:color=black@0.56:t=fill,drawbox=x=86:y=ih-650:w=iw-172:h=4:color=white@0.86:t=fill,drawtext=fontfile='${ffPath(font)}':textfile='${ffPath(ctaFile)}':fontcolor=white:fontsize=76:x=(w-text_w)/2:y=h-565,drawtext=fontfile='${ffPath(regular)}':textfile='${ffPath(supportFile)}':fontcolor=white@0.72:fontsize=30:x=(w-text_w)/2:y=h-405,drawbox=x=238:y=ih-270:w=iw-476:h=82:color=white@0.94:t=fill,drawtext=fontfile='${ffPath(font)}':text='SMARTCORRETORAI':fontcolor=black@0.90:fontsize=30:x=(w-text_w)/2:y=h-244,fade=t=in:st=0:d=0.22,fade=t=out:st=${seconds - 0.24}:d=0.24,format=yuv420p[vout]`,
      ].join(';')
    : `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},zoompan=z='${movement.z}':x='${movement.x}':y='${movement.y}':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},format=yuv420p[vout]`

  console.log(`V3 CTA: ${ctaText}`)

  await run(FFMPEG, [
    '-y',
    '-loop', '1',
    '-i', inputImage,
    '-filter_complex', filter,
    '-map', '[vout]',
    '-t', String(seconds),
    ...encodeSegmentArgs(outputSegment),
  ])

  return { file: outputSegment, duration: seconds, transition: 'fadeblack' }
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
    ...encodeSegmentArgs(targetFile),
  ])
}

async function addMusicIfAvailable(videoFile, finalFile) {
  const musicFile = path.join(AUDIO_DIR, 'music.mp3')
  if (!fs.existsSync(musicFile)) {
    fs.copyFileSync(videoFile, finalFile)
    console.log('No music found. Exporting V3 without audio.')
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
    '-af', 'volume=0.58,afade=t=in:st=0:d=1.1,afade=t=out:st=18:d=1.7',
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

  const narrativeSlides = slides.map((slide, index) => ({ ...slide, originalIndex: index, scene: slide.scene || sceneFor(slide) }))
  const profile = detectProfile(config, narrativeSlides)
  const profileStyle = styleForProfile(profile)
  console.log(`V3 profile: ${profile}`)

  const segments = []
  for (let index = 0; index < narrativeSlides.length; index += 1) {
    segments.push(await createSlideSegment(narrativeSlides[index], index, profileStyle))
  }

  const ctaImage = narrativeSlides[narrativeSlides.length - 1]?.image || narrativeSlides[0].image
  segments.push(await createCtaSegment({ cta: config.cta || 'Agende sua visita', image: ctaImage, index: narrativeSlides.length, profileStyle }))

  const silentVideo = path.join(WORK_DIR, 'slideshow-v3-no-audio.mp4')
  await crossfadeSegments(segments, silentVideo)
  await addMusicIfAvailable(silentVideo, OUTPUT_FILE)

  const finalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0) - ((segments.length - 1) * TRANSITION_SECONDS)
  fs.rmSync(WORK_DIR, { recursive: true, force: true })
  console.log(`V3 video generated: ${OUTPUT_FILE}`)
  console.log(`Estimated duration: ${finalDuration.toFixed(1)}s`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
