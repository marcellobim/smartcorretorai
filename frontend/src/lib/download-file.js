const EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

const DOWNLOAD_ERROR_MESSAGES = {
  download_url_missing: 'O arquivo final ainda não está disponível para download.',
  download_url_invalid: 'O link final do arquivo é inválido. Atualize a página e tente novamente.',
  download_url_expired: 'O link de download expirou. Atualize a página para obter um novo link e tente novamente.',
  download_request_blocked: 'Não foi possível acessar o arquivo final. O link pode ter expirado; atualize a página e tente novamente.',
  download_request_failed: 'Não foi possível baixar o arquivo final. Tente novamente em instantes.',
  download_unexpected_content: 'O link retornou um arquivo inválido. Atualize a página e tente novamente.',
  download_empty_file: 'O arquivo final está vazio e não pode ser baixado.',
  download_timeout: 'O download demorou mais que o esperado. Tente novamente.',
}

const sanitizeFilename = (filename) => String(filename || 'smartcorretorai-arquivo')
  .trim()
  .replace(/[\\/:*?"<>|]+/g, '-')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')

const getUrlExtension = (url) => {
  try {
    const pathname = new URL(url, window.location.href).pathname
    return pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase() || ''
  } catch {
    return ''
  }
}

const ensureFileExtension = (filename, mimeType, sourceUrl) => {
  const safeFilename = sanitizeFilename(filename)
  if (/\.[a-z0-9]{2,5}$/i.test(safeFilename)) return safeFilename
  const extension = EXTENSION_BY_MIME_TYPE[String(mimeType || '').split(';')[0].toLowerCase()]
    || getUrlExtension(sourceUrl)
    || 'png'
  return `${safeFilename}.${extension}`
}

const createDownloadError = (code, status = null) => {
  const error = new Error(code)
  error.code = code
  error.status = status
  return error
}

export const getDownloadErrorMessage = (error) => (
  DOWNLOAD_ERROR_MESSAGES[error?.code || error?.message]
  || DOWNLOAD_ERROR_MESSAGES.download_request_failed
)

export async function downloadFileFromPrivateUrl(url, filename, options = {}) {
  if (!url) throw createDownloadError('download_url_missing')

  let parsedUrl
  try {
    parsedUrl = new URL(url, window.location.href)
  } catch {
    throw createDownloadError('download_url_invalid')
  }
  if (!['http:', 'https:', 'blob:'].includes(parsedUrl.protocol)) {
    throw createDownloadError('download_url_invalid')
  }

  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs || 120000)

  let response
  try {
    response = await fetch(parsedUrl.href, {
      method: 'GET',
      credentials: 'same-origin',
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw createDownloadError('download_timeout')
    throw createDownloadError('download_request_blocked')
  } finally {
    window.clearTimeout(timeoutId)
  }

  if ([401, 403, 410].includes(response.status)) {
    throw createDownloadError('download_url_expired', response.status)
  }
  if (!response.ok) throw createDownloadError('download_request_failed', response.status)

  const blob = await response.blob()
  if (!blob.size) throw createDownloadError('download_empty_file')
  if (/^(?:text\/html|application\/(?:json|problem\+json))/i.test(blob.type)) {
    throw createDownloadError('download_unexpected_content')
  }

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = ensureFileExtension(filename, blob.type, parsedUrl.href)
  link.style.display = 'none'
  document.body.appendChild(link)

  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }
}
