const fs = require('fs')
const path = require('path')
const os = require('os')
const { spawn } = require('child_process')

const ROOT = __dirname
const TEST_NAME = process.env.V31_TEST || 'alto-padrao-01'
const TEST_DIR = path.join(ROOT, 'v31-tests', TEST_NAME)
const IMAGES_DIR = path.join(TEST_DIR, 'images')
const AUDIO_DIR = path.join(ROOT, 'input', 'audio')
const OUTPUT_DIR = path.join(ROOT, 'output')
const WORK_DIR = path.join(os.tmpdir(), `smartcorretorai-slideshow-v31-${TEST_NAME}-${process.pid}`)
const SLIDES_JSON = path.join(TEST_DIR, 'slides.json')
const OUTPUT_FILE = path.join(OUTPUT_DIR, `v31-${TEST_NAME}.mp4`)
const SUMMARY_FILE = path.join(TEST_DIR, 'summary.json')
const REPORT_FILE = path.join(TEST_DIR, 'REPORT.md')

const WIDTH = 1080
const HEIGHT = 1920
const FPS = 30
const DEFAULT_SLIDE_SECONDS = 3.4
const DEFAULT_CTA_SECONDS = 3.2
const DEFAULT_TRANSITION_SECONDS = 0.62

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

function writeTextFile(name, text) {
  const filePath = path.join(WORK_DIR, name)
  fs.writeFileSync(filePath, String(text || '').replace(/\s+/g, ' ').trim(), 'utf8')
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

function movementCatalog(type, seconds) {
  const frames = Math.round(seconds * FPS)
  const p = `on/${frames}`
  const t = `t/${seconds}`

  const catalog = {
    pool: {
      code: 'POOL_LUXURY',
      name: 'aspirational-wide-pan',
      z: '1.055',
      x: `(iw-iw/zoom)*(0.10+0.55*${p})`,
      y: `(ih-ih/zoom)*0.48`,
      fgX: `-18+36*${t}`,
      fgY: '58',
      transition: 'fadeblack',
    },
    amenity: {
      code: 'AMENITY_REVEAL',
      name: 'open-amenity-pan',
      z: '1.055',
      x: `(iw-iw/zoom)*(0.16+0.50*${p})`,
      y: `(ih-ih/zoom)*0.50`,
      fgX: `-16+32*${t}`,
      fgY: '60',
      transition: 'smoothleft',
    },
    gourmet: {
      code: 'AMENITY_REVEAL',
      name: 'diagonal-gourmet-travel',
      z: '1.06',
      x: `(iw-iw/zoom)*(0.18+0.42*${p})`,
      y: `(ih-ih/zoom)*(0.62-0.20*${p})`,
      fgX: `-14+28*${t}`,
      fgY: `64-18*${t}`,
      transition: 'smoothup',
    },
    living: {
      code: 'LIVING_PREMIUM',
      name: 'soft-lateral-living',
      z: '1.052',
      x: `(iw-iw/zoom)*(0.12+0.58*${p})`,
      y: 'ih/2-(ih/zoom/2)',
      fgX: `-22+44*${t}`,
      fgY: '62',
      transition: 'fade',
    },
    kitchen: {
      code: 'KITCHEN_REVEAL',
      name: 'elegant-kitchen-pan',
      z: '1.052',
      x: `(iw-iw/zoom)*(0.62-0.48*${p})`,
      y: 'ih/2-(ih/zoom/2)',
      fgX: `20-38*${t}`,
      fgY: '64',
      transition: 'smoothleft',
    },
    suite: {
      code: 'SUITE_SLOW',
      name: 'premium-suite-push',
      z: `min(1.075,1+0.075*${p})`,
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih-ih/zoom)*(0.48-0.05*${p})`,
      fgX: '8',
      fgY: `62-18*${t}`,
      transition: 'fadeblack',
    },
    bedroom: {
      code: 'BEDROOM_SOFT',
      name: 'quiet-bedroom-drift',
      z: `min(1.06,1+0.06*${p})`,
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih-ih/zoom)*(0.45+0.08*${p})`,
      fgX: `12+14*${t}`,
      fgY: '62',
      transition: 'fade',
    },
    balcony: {
      code: 'BALCONY_VIEW',
      name: 'depth-balcony-move',
      z: '1.06',
      x: `(iw-iw/zoom)*(0.18+0.42*${p})`,
      y: `(ih-ih/zoom)*(0.65-0.32*${p})`,
      fgX: `-18+34*${t}`,
      fgY: `72-26*${t}`,
      transition: 'smoothup',
    },
    view: {
      code: 'BALCONY_VIEW',
      name: 'depth-view-move',
      z: '1.052',
      x: `(iw-iw/zoom)*(0.08+0.44*${p})`,
      y: `(ih-ih/zoom)*(0.55-0.20*${p})`,
      fgX: `-16+26*${t}`,
      fgY: `66-20*${t}`,
      transition: 'smoothup',
    },
    bathroom: {
      code: 'BATHROOM_DETAIL',
      name: 'short-detail-bathroom',
      z: `min(1.045,1+0.045*${p})`,
      x: 'iw/2-(iw/zoom/2)',
      y: 'ih/2-(ih/zoom/2)',
      fgX: '0',
      fgY: '58',
      transition: 'fade',
    },
    detail: {
      code: 'BATHROOM_DETAIL',
      name: 'controlled-detail-move',
      z: `min(1.045,1+0.045*${p})`,
      x: 'iw/2-(iw/zoom/2)',
      y: `(ih-ih/zoom)*(0.48+0.06*${p})`,
      fgX: `6+10*${t}`,
      fgY: '60',
      transition: 'fade',
    },
    cta: {
      code: 'CTA_FINAL',
      name: 'stable-cta-frame',
      z: '1.035',
      x: 'iw/2-(iw/zoom/2)',
      y: 'ih/2-(ih/zoom/2)',
      fgX: '0',
      fgY: '0',
      transition: 'fadeblack',
    },
  }

  return catalog[type] || catalog.detail
}

function slideFilter({ type, captionFile, fonts, seconds }) {
  const motion = movementCatalog(type, seconds)
  const frames = Math.round(seconds * FPS)
  const font = fonts.bold
  const regular = fonts.regular || fonts.bold
  const treatment = 'eq=contrast=1.055:saturation=1.02:brightness=-0.004'

  if (!font) {
    return {
      motion,
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
    motion,
    args: ['-filter_complex', filter, '-map', '[vout]'],
  }
}

async function createSlideSegment(slide, index, timing) {
  const inputImage = path.join(IMAGES_DIR, slide.image)
  const fonts = getFontFiles()
  const captionFile = writeTextFile(`caption-${index}.txt`, slide.caption)
  const outputSegment = path.join(WORK_DIR, `segment-${String(index + 1).padStart(2, '0')}.mp4`)
  const filter = slideFilter({ type: slide.type, captionFile, fonts, seconds: timing.slideSeconds })

  console.log(`V3.1 slide ${index + 1}: ${slide.type} / ${filter.motion.code} / ${filter.motion.name}`)

  await run(FFMPEG, [
    '-y',
    '-loop', '1',
    '-i', inputImage,
    ...filter.args,
    '-t', String(timing.slideSeconds),
    ...encodeArgs(outputSegment),
  ])

  return {
    file: outputSegment,
    duration: timing.slideSeconds,
    transition: filter.motion.transition,
    movement: filter.motion.name,
    movementCode: filter.motion.code,
  }
}

async function createCtaSegment(config, lastImage, index, timing) {
  const inputImage = path.join(IMAGES_DIR, lastImage)
  const fonts = getFontFiles()
  const outputSegment = path.join(WORK_DIR, `segment-${String(index + 1).padStart(2, '0')}-cta.mp4`)
  const ctaFile = writeTextFile('cta.txt', String(config.cta || 'Agende sua visita').toUpperCase())
  const supportFile = writeTextFile('support.txt', 'Apartamento alto padrao | Visita com hora marcada')
  const font = fonts.bold
  const regular = fonts.regular || fonts.bold
  const frames = Math.round(timing.ctaSeconds * FPS)

  const filter = font
    ? [
        `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase:flags=lanczos,crop=${WIDTH}:${HEIGHT},zoompan=z='1.035':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${WIDTH}x${HEIGHT}:fps=${FPS},eq=contrast=1.05:saturation=1.0:brightness=-0.01,boxblur=2:1,vignette=angle=PI/4:mode=backward[bg]`,
        `[bg]drawbox=x=0:y=0:w=iw:h=ih:color=black@0.30:t=fill,drawbox=x=92:y=ih-650:w=iw-184:h=360:color=black@0.58:t=fill,drawbox=x=92:y=ih-650:w=iw-184:h=4:color=white@0.88:t=fill,drawtext=fontfile='${ffPath(font)}':textfile='${ffPath(ctaFile)}':fontcolor=white:fontsize=76:x=(w-text_w)/2:y=h-565,drawtext=fontfile='${ffPath(regular)}':textfile='${ffPath(supportFile)}':fontcolor=white@0.74:fontsize=29:x=(w-text_w)/2:y=h-408,drawbox=x=238:y=ih-270:w=iw-476:h=82:color=white@0.94:t=fill,drawtext=fontfile='${ffPath(font)}':text='SMARTCORRETORAI':fontcolor=black@0.90:fontsize=30:x=(w-text_w)/2:y=h-244,fade=t=in:st=0:d=0.24,fade=t=out:st=${timing.ctaSeconds - 0.25}:d=0.25,format=yuv420p[vout]`,
      ].join(';')
    : `[0:v]scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=increase,crop=${WIDTH}:${HEIGHT},format=yuv420p[vout]`

  await run(FFMPEG, [
    '-y',
    '-loop', '1',
    '-i', inputImage,
    '-filter_complex', filter,
    '-map', '[vout]',
    '-t', String(timing.ctaSeconds),
    ...encodeArgs(outputSegment),
  ])

  return {
    file: outputSegment,
    duration: timing.ctaSeconds,
    transition: 'fadeblack',
    movement: 'stable-cta-frame',
    movementCode: 'CTA_FINAL',
  }
}

async function crossfadeSegments(segments, targetFile, timing) {
  const args = ['-y']
  for (const segment of segments) args.push('-i', segment.file)

  const filters = []
  let previousLabel = '[0:v]'
  let currentDuration = segments[0].duration

  for (let index = 1; index < segments.length; index += 1) {
    const outLabel = index === segments.length - 1 ? '[vout]' : `[v${index}]`
    const offset = Math.max(0, currentDuration - timing.transitionSeconds)
    const transition = segments[index - 1].transition || 'fade'
    filters.push(`${previousLabel}[${index}:v]xfade=transition=${transition}:duration=${timing.transitionSeconds}:offset=${offset.toFixed(2)}${outLabel}`)
    previousLabel = outLabel
    currentDuration = currentDuration + segments[index].duration - timing.transitionSeconds
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
    console.log('No music found. Exporting V3.1 without audio.')
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

function reportMarkdown({ config, slides, summary }) {
  const rows = summary.slides.map((slide) => (
    `| ${slide.order} | \`${slide.image}\` | ${slide.type} | ${slide.caption} | ${slide.movementCode} | ${slide.movement} | ${slide.transition} |`
  )).join('\n')

  return `# Studio Hero V3.1 - ${TEST_NAME}

## Escopo

Experimento local da POC, sem integracao ao produto real.

## Video Gerado

- Arquivo: \`${path.relative(ROOT, OUTPUT_FILE).replace(/\\/g, '/')}\`
- Resolucao: 1080x1920
- Codec: H.264
- FPS: 30
- Duracao estimada: ${summary.durationSeconds}s
- Musica: ${summary.music ? 'sim' : 'nao'}

## Narrativa

Perfil: ${config.profile}

1. Abertura com impacto visual
2. Piscina/amenidade/lazer
3. Living/cozinha
4. Suite/dormitorio
5. Varanda/vista
6. Banheiro/detalhe
7. CTA final

## Imagens, Classificacao E Movimentos

| Ordem | Arquivo | Tipo | Legenda | Movimento | Nome tecnico | Transicao |
|---:|---|---|---|---|---|---|
${rows}
| CTA | \`${slides[slides.length - 1].image}\` | cta | ${config.cta} | CTA_FINAL | stable-cta-frame | fadeblack |

## Comparacao Com V3

- A V3 dependia de deteccao por nome/caption e podia classificar muitas imagens como \`detail\`.
- A V3.1 usa \`type\` explicito nesta primeira POC, evitando repeticao de \`slow-detail-drift\`.
- A V3.1 aplica movimentos com intencao por ambiente.
- O CTA final e mais estavel e mais separado da sequencia de fotos.
- O zoom foi reduzido para diminuir tremor e microdrift.

## Problemas Encontrados

- Ainda depende de classificacao manual nesta POC.
- Nao havia \`input/audio/music.mp3\`, portanto o video foi exportado sem trilha.
- Fotos horizontais e verticais precisam de tratamento melhor de crop para producao.
- O render com FFmpeg e pesado para rodar sincronicamente em ambiente serverless.

## Pendencias Para V3.1 Real

- Classificacao automatica visual.
- Selecao automatica das melhores 6 a 8 imagens.
- Narrativa por perfil: alto padrao, vazio, lancamento, locacao e comercial.
- Biblioteca de trilhas licenciadas ou musica padrao segura.
- Worker assincrono para render.
- Preview de frames antes de gerar.

## Conclusao

Esta V3.1 experimental supera a V3 em narrativa e controle de movimento. Ela ainda nao e produto, mas prova que o modo Carrossel Inteligente pode evoluir para uma alternativa previsivel, barata e visualmente superior ao slideshow basico.
`
}

async function main() {
  ensureDir(OUTPUT_DIR)
  fs.rmSync(WORK_DIR, { recursive: true, force: true })
  ensureDir(WORK_DIR)

  if (!fs.existsSync(SLIDES_JSON)) throw new Error(`Missing test config: ${SLIDES_JSON}`)

  const config = JSON.parse(fs.readFileSync(SLIDES_JSON, 'utf8'))
  const slides = Array.isArray(config.slides) ? config.slides : []
  if (slides.length < 5 || slides.length > 8) {
    throw new Error(`V3.1 expects 5 to 8 images. Found: ${slides.length}`)
  }

  const timing = {
    slideSeconds: Number(config.slideSeconds || DEFAULT_SLIDE_SECONDS),
    ctaSeconds: Number(config.ctaSeconds || DEFAULT_CTA_SECONDS),
    transitionSeconds: Number(config.transitionSeconds || DEFAULT_TRANSITION_SECONDS),
  }

  for (const slide of slides) {
    const imagePath = path.join(IMAGES_DIR, slide.image)
    if (!fs.existsSync(imagePath)) throw new Error(`Image not found: ${imagePath}`)
    if (!slide.type) throw new Error(`Missing type for image: ${slide.image}`)
  }

  const segments = []
  for (let index = 0; index < slides.length; index += 1) {
    segments.push(await createSlideSegment(slides[index], index, timing))
  }
  segments.push(await createCtaSegment(config, slides[slides.length - 1].image, slides.length, timing))

  const silentVideo = path.join(WORK_DIR, 'slideshow-v31-no-audio.mp4')
  await crossfadeSegments(segments, silentVideo, timing)
  const hasMusic = await addMusicIfAvailable(silentVideo, OUTPUT_FILE)

  const finalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0) - ((segments.length - 1) * timing.transitionSeconds)
  const summary = {
    output: OUTPUT_FILE,
    durationSeconds: Number(finalDuration.toFixed(2)),
    music: hasMusic,
    timing,
    slides: slides.map((slide, index) => ({
      order: index + 1,
      image: slide.image,
      type: slide.type,
      caption: slide.caption,
      movementCode: segments[index].movementCode,
      movement: segments[index].movement,
      transition: segments[index].transition,
    })),
    cta: {
      caption: config.cta,
      movementCode: segments[segments.length - 1].movementCode,
      movement: segments[segments.length - 1].movement,
      transition: segments[segments.length - 1].transition,
    },
  }

  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2), 'utf8')
  fs.writeFileSync(REPORT_FILE, reportMarkdown({ config, slides, summary }), 'utf8')

  fs.rmSync(WORK_DIR, { recursive: true, force: true })
  console.log(`V3.1 video generated: ${OUTPUT_FILE}`)
  console.log(`Report generated: ${REPORT_FILE}`)
  console.log(`Estimated duration: ${finalDuration.toFixed(1)}s`)
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
