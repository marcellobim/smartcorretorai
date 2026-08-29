export const LISTING_XRAY_MAX_IMAGES = 5
export const LISTING_XRAY_MAX_SOURCE_IMAGE_BYTES = 8 * 1024 * 1024
export const LISTING_XRAY_MAX_IMAGE_BYTES = 2 * 1024 * 1024
export const LISTING_XRAY_ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_DIMENSION = 2048

export function validateListingXrayFiles(files) {
  const items = Array.from(files || [])
  if (items.length < 1 || items.length > LISTING_XRAY_MAX_IMAGES) throw new Error('Envie de 1 a 5 imagens.')
  for (const file of items) {
    if (!LISTING_XRAY_ACCEPTED_IMAGE_TYPES.includes(file?.type)) throw new Error('Use imagens JPG, PNG ou WebP.')
    if (!Number.isFinite(file?.size) || file.size < 1 || file.size > LISTING_XRAY_MAX_SOURCE_IMAGE_BYTES) throw new Error('Cada imagem original pode ter no máximo 8 MB.')
  }
  return items
}

const readDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader(); reader.onerror = () => reject(new Error('Não foi possível ler uma das imagens.')); reader.onload = () => resolve(String(reader.result || '')); reader.readAsDataURL(file)
})
const byteLength = dataUrl => Math.floor((String(dataUrl).split(',')[1]?.length || 0) * 3 / 4)
const loadImage = source => new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = () => reject(new Error('Uma das imagens não pôde ser processada.')); image.src = source })

async function normalizeImage(file) {
  const source = await readDataUrl(file); const image = await loadImage(source)
  const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight)); let width = Math.max(1, Math.round(image.naturalWidth * scale)); let height = Math.max(1, Math.round(image.naturalHeight * scale)); let quality = 0.9
  const canvas = document.createElement('canvas'); const context = canvas.getContext('2d', { alpha: false }); if (!context) throw new Error('Não foi possível preparar as imagens.')
  let output = source
  for (let attempt = 0; attempt < 7; attempt += 1) {
    canvas.width = width; canvas.height = height; context.fillStyle = '#fff'; context.fillRect(0, 0, width, height); context.drawImage(image, 0, 0, width, height)
    output = canvas.toDataURL('image/jpeg', quality)
    if (byteLength(output) <= LISTING_XRAY_MAX_IMAGE_BYTES) break
    quality = Math.max(0.68, quality - 0.07); width = Math.max(1, Math.round(width * 0.88)); height = Math.max(1, Math.round(height * 0.88))
  }
  if (byteLength(output) > LISTING_XRAY_MAX_IMAGE_BYTES) throw new Error('Uma das imagens continua muito grande após a preparação.')
  return { data_url: output }
}

export async function prepareListingXrayImages(files) {
  const validated = validateListingXrayFiles(files)
  return Promise.all(validated.map(normalizeImage))
}
