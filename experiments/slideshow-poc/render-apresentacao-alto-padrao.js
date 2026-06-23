const fs = require('fs')
const path = require('path')
const { spawn } = require('child_process')

const ROOT = __dirname
const REPO_ROOT = path.resolve(ROOT, '..', '..')
const ASSET_DIR = path.join(REPO_ROOT, 'assets-imoveis', 'alto-padrao-01')
const OUTPUT_DIR = path.join(ROOT, 'output')
const WORK_DIR = path.join(ROOT, '.tmp', 'apresentacao-alto-padrao-01')
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'apresentacao-alto-padrao-01.mp4')
const REPORT_FILE = path.join(ROOT, 'REPORT_APRESENTACAO.md')
const AUDIO_FILE = path.join(ROOT, 'input', 'audio', 'music.mp3')

const WIDTH = 1080
const HEIGHT = 1920
const FPS = 30
const SLIDE_SECONDS = 2.45
const CTA_SECONDS = 3.0

const slides = [
  {
    image: 'Screenshot_20260622_063020_Chrome.jpg',
    caption: 'LIVING INTEGRADO',
    transition: 'fade simples',
  },
  {
    image: 'Screenshot_20260622_062959_Chrome.jpg',
    caption: 'VARANDA GOURMET',
    transition: 'fade simples',
  },
  {
    image: 'Screenshot_20260622_063130_Chrome.jpg',
    caption: 'SUITE AMPLA',
    transition: 'fade simples',
  },
  {
    image: 'Screenshot_20260622_063303_Chrome.jpg',
    caption: 'VISTA URBANA',
    transition: 'fade simples',
  },
  {
    image: 'Screenshot_20260622_062941_Chrome.jpg',
    caption: 'LAZER COMPLETO',
    transition: 'fade simples',
  },
]

function getFfmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH
  try {
    return require('ffmpeg-static')
  } catch {
    return 'ffmpeg'
  }
}

function getFontFile() {
  const candidates = [
    'C:\\Windows\\Fonts\\segoeuib.ttf',
    'C:\\Windows\\Fonts\\arialbd.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  ]
  return candidates.find((file) => fs.existsSync(file)) || candidates[0]
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function ffPath(file) {
  return file.replace(/\\/g, '/').replace(/:/g, '\\:')
}

function concatPath(file) {
  return file.replace(/\\/g, '/')
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(stderr || `${command} exited with code ${code}`))
    })
  })
}

function writeTextFile(name, text) {
  const file = path.join(WORK_DIR, name)
  fs.writeFileSync(file, text, 'utf8')
  return file
}

function baseVideoFilter(seconds, captionFile, fontFile) {
  return [
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease`,
    `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0x0f172a`,
    `drawbox=x=90:y=h-360:w=iw-180:h=138:color=black@0.46:t=fill`,
    `drawbox=x=90:y=h-360:w=iw-180:h=3:color=white@0.68:t=fill`,
    `drawtext=fontfile='${ffPath(fontFile)}':textfile='${ffPath(captionFile)}':fontcolor=white:fontsize=58:x=(w-text_w)/2:y=h-310`,
    'fade=t=in:st=0:d=0.25',
    `fade=t=out:st=${(seconds - 0.25).toFixed(2)}:d=0.25`,
    'format=yuv420p',
  ].join(',')
}

async function createImageSegment(ffmpeg, slide, index, fontFile) {
  const imageFile = path.join(ASSET_DIR, slide.image)
  if (!fs.existsSync(imageFile)) {
    throw new Error(`Imagem nao encontrada: ${imageFile}`)
  }

  const captionFile = writeTextFile(`caption-${index + 1}.txt`, slide.caption)
  const output = path.join(WORK_DIR, `segment-${String(index + 1).padStart(2, '0')}.mp4`)

  await run(ffmpeg, [
    '-y',
    '-loop', '1',
    '-t', String(SLIDE_SECONDS),
    '-i', imageFile,
    '-vf', baseVideoFilter(SLIDE_SECONDS, captionFile, fontFile),
    '-r', String(FPS),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    output,
  ])

  return output
}

async function createCtaSegment(ffmpeg, fontFile) {
  const lastImage = path.join(ASSET_DIR, slides[slides.length - 1].image)
  const ctaFile = writeTextFile('cta.txt', 'AGENDE SUA VISITA')
  const supportFile = writeTextFile('cta-support.txt', 'SmartCorretorAI')
  const output = path.join(WORK_DIR, 'segment-06-cta.mp4')

  const filter = [
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease`,
    `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=0x0f172a`,
    'drawbox=x=0:y=0:w=iw:h=ih:color=black@0.36:t=fill',
    'drawbox=x=110:y=h-595:w=iw-220:h=300:color=black@0.60:t=fill',
    'drawbox=x=110:y=h-595:w=iw-220:h=4:color=white@0.78:t=fill',
    `drawtext=fontfile='${ffPath(fontFile)}':textfile='${ffPath(ctaFile)}':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=h-520`,
    `drawtext=fontfile='${ffPath(fontFile)}':textfile='${ffPath(supportFile)}':fontcolor=white@0.72:fontsize=30:x=(w-text_w)/2:y=h-392`,
    'fade=t=in:st=0:d=0.25',
    `fade=t=out:st=${(CTA_SECONDS - 0.25).toFixed(2)}:d=0.25`,
    'format=yuv420p',
  ].join(',')

  await run(ffmpeg, [
    '-y',
    '-loop', '1',
    '-t', String(CTA_SECONDS),
    '-i', lastImage,
    '-vf', filter,
    '-r', String(FPS),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    output,
  ])

  return output
}

async function concatSegments(ffmpeg, segmentFiles) {
  const concatFile = path.join(WORK_DIR, 'segments.txt')
  fs.writeFileSync(
    concatFile,
    segmentFiles.map((file) => `file '${concatPath(file)}'`).join('\n'),
    'utf8',
  )

  const noAudioFile = path.join(WORK_DIR, 'apresentacao-no-audio.mp4')
  await run(ffmpeg, [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatFile,
    '-c', 'copy',
    noAudioFile,
  ])

  if (!fs.existsSync(AUDIO_FILE)) {
    fs.copyFileSync(noAudioFile, OUTPUT_FILE)
    return { music: false }
  }

  await run(ffmpeg, [
    '-y',
    '-i', noAudioFile,
    '-i', AUDIO_FILE,
    '-shortest',
    '-filter:a', 'afade=t=in:st=0:d=0.8,afade=t=out:st=14.7:d=0.8,volume=0.28',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-b:a', '128k',
    OUTPUT_FILE,
  ])

  return { music: true }
}

function writeReport({ duration, music, size }) {
  const report = `# Studio Hero Apresentacao - Alto Padrao 01

## Resultado

- Video: \`experiments/slideshow-poc/output/apresentacao-alto-padrao-01.mp4\`
- Duracao: ${duration.toFixed(2)}s
- Resolucao: ${WIDTH}x${HEIGHT}
- Codec: H.264
- FPS: ${FPS}
- Tamanho final: ${size} bytes
- Musica: ${music ? 'aplicada a partir de input/audio/music.mp3' : 'nao aplicada; nenhum arquivo input/audio/music.mp3 foi encontrado'}

## Intencao

Este teste encerra a linha de tentativa premium sem Veo e valida apenas uma apresentacao limpa de imovel.

Nao foram usados:

- Parallax.
- Camera fake.
- Movimento artificial.
- Classificacao complexa.
- Melhoria de imagem.
- Filtro forte.
- Upscale agressivo.

## Imagens usadas

| Ordem | Imagem | Legenda | Transicao |
| --- | --- | --- | --- |
${slides.map((slide, index) => `| ${index + 1} | \`${slide.image}\` | ${slide.caption} | ${slide.transition} |`).join('\n')}
| 6 | Ultima imagem como base | AGENDE SUA VISITA | fade simples |

## Fluxo visual

Imagem
|
Legenda
|
Imagem
|
Legenda
|
Imagem
|
Legenda
|
CTA final

## Observacao

As imagens foram preservadas visualmente. O render apenas ajusta escala e preenchimento para o quadro vertical 1080x1920, mantendo a imagem inteira visivel, com fundo navy quando necessario.
`

  fs.writeFileSync(REPORT_FILE, report, 'utf8')
}

async function main() {
  ensureDir(OUTPUT_DIR)
  ensureDir(WORK_DIR)

  const ffmpeg = getFfmpegPath()
  const fontFile = getFontFile()
  const segmentFiles = []

  for (let index = 0; index < slides.length; index += 1) {
    segmentFiles.push(await createImageSegment(ffmpeg, slides[index], index, fontFile))
  }

  segmentFiles.push(await createCtaSegment(ffmpeg, fontFile))
  const audio = await concatSegments(ffmpeg, segmentFiles)

  const duration = slides.length * SLIDE_SECONDS + CTA_SECONDS
  const size = fs.statSync(OUTPUT_FILE).size

  writeReport({ duration, music: audio.music, size })

  console.log(`Apresentacao gerada: ${OUTPUT_FILE}`)
  console.log(`Duracao estimada: ${duration.toFixed(2)}s`)
  console.log(`Musica: ${audio.music ? 'sim' : 'nao'}`)
  console.log(`Relatorio: ${REPORT_FILE}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
