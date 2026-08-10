import { getSharePublishNetwork } from '../config/sharePublishNetworks'

const EXTENSION_MIME_TYPES = Object.freeze({
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
})

const SHARE_ERROR_MESSAGES = Object.freeze({
  share_media_missing: 'A mídia ainda não está disponível para compartilhar.',
  share_media_invalid: 'A mídia não pôde ser preparada. Use Baixar e tente publicar manualmente.',
  share_media_expired: 'O link da mídia expirou. Renove ou baixe o arquivo para continuar.',
  share_media_fetch_failed: 'Não foi possível preparar a mídia. Baixar e copiar legenda continuam disponíveis.',
  share_media_empty: 'O arquivo retornado está vazio e não pode ser compartilhado.',
  share_media_unexpected: 'O link não retornou uma mídia válida.',
  share_unavailable: 'O compartilhamento de arquivos não está disponível neste navegador.',
  share_failed: 'Não foi possível abrir o compartilhamento. Baixe a mídia e finalize manualmente.',
  clipboard_failed: 'Não foi possível copiar a legenda. Selecione o texto e copie manualmente.',
})

const createShareError = (code, status = null) => {
  const error = new Error(code)
  error.code = code
  error.status = status
  return error
}

const clean = value => String(value || '').trim()

const getUrlExtension = url => {
  try {
    return new URL(url, 'https://smartcorretorai.local').pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() || ''
  } catch {
    return ''
  }
}

const getMimeType = item => clean(item?.mimeType).toLowerCase()
  || EXTENSION_MIME_TYPES[getUrlExtension(item?.filename)]
  || EXTENSION_MIME_TYPES[getUrlExtension(item?.url)]
  || ''

const inferMediaType = mimeType => mimeType.startsWith('video/') ? 'video' : mimeType.startsWith('image/') ? 'image' : ''

export function normalizeShareMedia(media = [], { downloadUrl = '', downloadName = '', mimeType = '' } = {}) {
  const source = Array.isArray(media) && media.length
    ? media
    : (downloadUrl ? [{ url: downloadUrl, filename: downloadName, mimeType }] : [])

  return source.map((item, index) => {
    const url = clean(item?.url || item?.downloadUrl)
    const resolvedMimeType = getMimeType({ ...item, url })
    const type = clean(item?.type) || inferMediaType(resolvedMimeType)
    return {
      id: clean(item?.id) || `share-media-${index + 1}`,
      url,
      filename: clean(item?.filename || item?.downloadName) || `smartcorretorai-midia-${index + 1}`,
      mimeType: resolvedMimeType,
      type,
      source: item,
    }
  }).filter(item => item.url && ['image', 'video'].includes(item.type))
}

export function composeShareText({ shareText = '', hashtags = [], cta = '' } = {}) {
  const text = clean(shareText)
  const ctaText = clean(cta)
  const hashtagItems = (Array.isArray(hashtags) ? hashtags : clean(hashtags).split(/\s+/))
    .map(clean)
    .filter(Boolean)
    .map(item => item.startsWith('#') ? item : `#${item}`)
  const uniqueHashtags = [...new Set(hashtagItems)]
  const hashtagText = uniqueHashtags.filter(tag => !text.includes(tag)).join(' ')
  return [text, ctaText && !text.includes(ctaText) ? ctaText : '', hashtagText].filter(Boolean).join('\n\n')
}

function parseMediaUrl(url) {
  let parsedUrl
  try {
    parsedUrl = new URL(url, globalThis.location?.href || 'https://smartcorretorai.local')
  } catch {
    throw createShareError('share_media_invalid')
  }
  if (!['http:', 'https:', 'blob:'].includes(parsedUrl.protocol)) throw createShareError('share_media_invalid')
  return parsedUrl.href
}

export async function fetchShareMediaBlob(item, { fetchRef = globalThis.fetch } = {}) {
  if (!item?.url || typeof fetchRef !== 'function') throw createShareError('share_media_missing')
  const url = parseMediaUrl(item.url)
  let response
  try {
    response = await fetchRef(url, { method: 'GET', credentials: 'same-origin' })
  } catch {
    throw createShareError('share_media_fetch_failed')
  }
  if ([401, 403, 410].includes(response?.status)) throw createShareError('share_media_expired', response.status)
  if (!response?.ok) throw createShareError('share_media_fetch_failed', response?.status || null)
  const blob = await response.blob()
  if (!blob?.size) throw createShareError('share_media_empty')
  if (/^(?:text\/html|application\/(?:json|problem\+json))/i.test(blob.type)) throw createShareError('share_media_unexpected')
  return blob
}

async function prepareOneShareFile(item, index, dependencies) {
  const FileCtor = dependencies.FileCtor || globalThis.File
  if (typeof FileCtor !== 'function') throw createShareError('share_unavailable')
  const blob = await fetchShareMediaBlob(item, dependencies)
  return new FileCtor([blob], item.filename || `smartcorretorai-midia-${index + 1}`, {
    type: item.mimeType || blob.type,
    lastModified: dependencies.now?.() || Date.now(),
  })
}

export async function prepareShareFiles(media, dependencies = {}) {
  const files = []
  const failures = []
  for (const [index, item] of (Array.isArray(media) ? media : []).entries()) {
    try {
      files.push(await prepareOneShareFile(item, index, dependencies))
    } catch (initialError) {
      if (typeof dependencies.renewMediaUrl === 'function') {
        try {
          const renewedUrl = await dependencies.renewMediaUrl(item.source || item, initialError)
          if (renewedUrl) {
            files.push(await prepareOneShareFile({ ...item, url: renewedUrl }, index, dependencies))
            continue
          }
        } catch (renewError) {
          failures.push({ item, error: renewError })
          continue
        }
      }
      failures.push({ item, error: initialError })
    }
  }
  return { files, failures }
}

const safeCanShare = (navigatorRef, files) => {
  try {
    return Boolean(files.length && navigatorRef?.canShare?.({ files }))
  } catch {
    return false
  }
}

export function getFileShareCapabilities(files, navigatorRef = globalThis.navigator) {
  const available = typeof navigatorRef?.share === 'function' && typeof navigatorRef?.canShare === 'function'
  if (!available) return { available: false, all: false, individual: files.map(() => false) }
  return {
    available: true,
    all: safeCanShare(navigatorRef, files),
    individual: files.map(file => safeCanShare(navigatorRef, [file])),
  }
}

export const isShareCancellationError = error => ['AbortError', 'NotAllowedError'].includes(error?.name)

export async function sharePreparedFiles({ files = [], title = '', text = '' }, navigatorRef = globalThis.navigator) {
  if (typeof navigatorRef?.share !== 'function' || !safeCanShare(navigatorRef, files)) return 'unsupported'
  try {
    await navigatorRef.share({ files, title: clean(title) || undefined, text: clean(text) || undefined })
    return 'shared'
  } catch (error) {
    if (isShareCancellationError(error)) return 'cancelled'
    throw createShareError('share_failed')
  }
}

export async function copyShareText(value, { navigatorRef = globalThis.navigator, documentRef = globalThis.document } = {}) {
  const text = clean(value)
  if (!text) throw createShareError('clipboard_failed')
  if (navigatorRef?.clipboard?.writeText) {
    try {
      await navigatorRef.clipboard.writeText(text)
      return 'clipboard'
    } catch {
      // Browsers can deny the modern clipboard API even after advertising it.
    }
  }
  if (!documentRef?.body || typeof documentRef.execCommand !== 'function') throw createShareError('clipboard_failed')
  const textarea = documentRef.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  documentRef.body.appendChild(textarea)
  textarea.select()
  const copied = documentRef.execCommand('copy')
  textarea.remove()
  if (!copied) throw createShareError('clipboard_failed')
  return 'fallback'
}

export function getOfficialNetworkUrl(networkId, shareText = '') {
  const network = getSharePublishNetwork(networkId)
  if (!network) return ''
  if (network.id === 'whatsapp' && clean(shareText)) return `${network.openUrl}?text=${encodeURIComponent(clean(shareText))}`
  return network.openUrl
}

export function openOfficialNetwork(networkId, { shareText = '', windowRef = globalThis.window } = {}) {
  const url = getOfficialNetworkUrl(networkId, shareText)
  if (!url || typeof windowRef?.open !== 'function') return ''
  const opened = windowRef.open(url, '_blank', 'noopener,noreferrer')
  if (opened) opened.opener = null
  return url
}

export async function downloadShareMedia(item, { onDownload, downloadRef } = {}) {
  if (typeof onDownload === 'function') return onDownload(item.source || item)
  if (typeof downloadRef !== 'function') throw createShareError('share_media_missing')
  return downloadRef(item.url, item.filename)
}

export const getShareErrorMessage = error => SHARE_ERROR_MESSAGES[error?.code || error?.message] || SHARE_ERROR_MESSAGES.share_failed
