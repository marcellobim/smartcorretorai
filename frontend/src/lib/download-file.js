const EXTENSION_BY_MIME_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
}

const sanitizeFilename = (filename) => String(filename || 'smartcorretorai-arquivo')
  .trim()
  .replace(/[\\/:*?"<>|]+/g, '-')
  .replace(/\s+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-|-$/g, '')

const ensureFileExtension = (filename, mimeType) => {
  const safeFilename = sanitizeFilename(filename)
  if (/\.[a-z0-9]{2,5}$/i.test(safeFilename)) return safeFilename
  const extension = EXTENSION_BY_MIME_TYPE[String(mimeType || '').toLowerCase()] || 'png'
  return `${safeFilename}.${extension}`
}

export async function downloadFileFromPrivateUrl(url, filename) {
  if (!url) throw new Error('download_url_missing')

  const response = await fetch(url)
  if (!response.ok) throw new Error('download_request_failed')

  const blob = await response.blob()
  if (!blob.size) throw new Error('download_empty_file')

  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = ensureFileExtension(filename, blob.type)
  link.style.display = 'none'
  document.body.appendChild(link)

  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }
}
