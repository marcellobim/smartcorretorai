export const HERO_NEXT_VERTICAL_EXPORT = Object.freeze({
  width: 1080,
  height: 1920,
  contentHeight: 1620,
  topMargin: 150,
  bottomMargin: 150,
})

export const isHeroNextVerticalFormat = (formatId, formatGroup) => (
  formatId === 'story_reels' || formatGroup === 'vertical'
)

export const getHeroNextExportDimensions = (formatId, formatGroup) => (
  isHeroNextVerticalFormat(formatId, formatGroup)
    ? { width: HERO_NEXT_VERTICAL_EXPORT.width, height: HERO_NEXT_VERTICAL_EXPORT.height }
    : null
)

const loadImage = (blob) => new Promise((resolve, reject) => {
  const url = URL.createObjectURL(blob)
  const image = new Image()
  image.onload = () => {
    URL.revokeObjectURL(url)
    resolve(image)
  }
  image.onerror = () => {
    URL.revokeObjectURL(url)
    reject(new Error('hero_next_export_image_unreadable'))
  }
  image.src = url
})

const canvasToBlob = (canvas, type) => new Promise((resolve, reject) => {
  canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('hero_next_export_failed'))), type, 0.96)
})

// The provider currently returns a 2:3 source for the vertical SKU. This deterministic
// export preserves every pixel of the generated asset and adds only balanced 9:16 margins.
export async function createHeroNextVerticalNineBySixteenBlob(sourceBlob) {
  const image = await loadImage(sourceBlob)
  const { width, height, contentHeight, topMargin } = HERO_NEXT_VERTICAL_EXPORT
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) throw new Error('hero_next_export_canvas_unavailable')

  context.fillStyle = '#071923'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, topMargin, width, contentHeight)
  return canvasToBlob(canvas, sourceBlob.type === 'image/png' ? 'image/png' : 'image/jpeg')
}

export const withNineBySixteenSuffix = (filename) => {
  const safe = String(filename || 'smartcorretorai-banner').trim()
  return /\.[a-z0-9]{2,5}$/i.test(safe)
    ? safe.replace(/(\.[a-z0-9]{2,5})$/i, '-9x16$1')
    : `${safe}-9x16.jpg`
}

export function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
