export const SHORT_VIDEOS_MODULE_ID = 'short-videos'
export const SHORT_VIDEOS_EXAMPLE_PATH = '/demos-videos/short-video-1.mp4'
export const SHORT_VIDEOS_INPUT_BUCKET = 'short-videos-inputs'
export const SHORT_VIDEO_ACCEPTED_MIME_TYPES = Object.freeze(['video/mp4'])
export const SHORT_VIDEO_MAX_BYTES = 250 * 1024 * 1024
export const SHORT_VIDEO_MAX_DURATION_SECONDS = 5 * 60
export const SHORT_VIDEOS_RENTAL_STAGES = Object.freeze(['Pronto para morar', 'Disponível já', 'Vago'])
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function getShortVideosStageOptions(purpose, saleOptions) {
  return purpose === 'rent' ? SHORT_VIDEOS_RENTAL_STAGES : saleOptions
}

export function getShortVideosPropertyTypes(purpose, propertyTypes) {
  return purpose === 'rent' ? propertyTypes.filter(type => type !== 'Terreno / Lote') : propertyTypes
}

export function adaptQuestionsForShortVideos(questions) {
  return questions.filter(([questionId]) => questionId !== 'presenter')
}

export function validateShortVideoFile(file) {
  if (!file) return 'Selecione um vídeo MP4.'
  if (!SHORT_VIDEO_ACCEPTED_MIME_TYPES.includes(file.type)) return 'Formato não suportado. Envie um vídeo MP4.'
  if (!file.size) return 'O arquivo selecionado está vazio.'
  if (file.size > SHORT_VIDEO_MAX_BYTES) return 'O vídeo deve ter no máximo 250 MB.'
  return ''
}

export function buildShortVideoInputPath(userId, requestId) {
  if (!UUID_PATTERN.test(String(userId || '')) || !UUID_PATTERN.test(String(requestId || ''))) {
    throw new Error('invalid_short_video_input_owner')
  }
  return `${userId}/short-videos/${requestId}/input.mp4`
}

export function getShortVideoTerminalActions(record, terminalState) {
  const isShortVideo = record?.inputFlow === SHORT_VIDEOS_MODULE_ID
  const terminalFailure = terminalState === 'failed' || terminalState === 'not-found'
  return {
    releaseLock: isShortVideo && terminalFailure,
    cleanupInput: isShortVideo && record?.phase === 'starting' && terminalState === 'not-found',
  }
}

export async function cleanupShortVideoInput(storage, userId, requestId) {
  const inputPath = buildShortVideoInputPath(userId, requestId)
  const { error } = await storage.from(SHORT_VIDEOS_INPUT_BUCKET).remove([inputPath])
  if (error) throw new Error('short_video_input_cleanup_failed')
  return inputPath
}

export function validateShortVideoDuration(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return 'Não foi possível identificar a duração do vídeo.'
  if (durationSeconds > SHORT_VIDEO_MAX_DURATION_SECONDS) return 'O vídeo deve ter no máximo 5 minutos.'
  return ''
}

export function readShortVideoDuration(file) {
  return new Promise((resolve, reject) => {
    const metadataUrl = URL.createObjectURL(file)
    const video = document.createElement('video')
    const release = () => URL.revokeObjectURL(metadataUrl)
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      const duration = video.duration
      release()
      resolve(duration)
    }
    video.onerror = () => {
      release()
      reject(new Error('Não foi possível ler os metadados do vídeo.'))
    }
    video.src = metadataUrl
  })
}

export function formatShortVideoDuration(durationSeconds) {
  const totalSeconds = Math.max(0, Math.round(Number(durationSeconds) || 0))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return `${minutes}:${seconds}`
}
