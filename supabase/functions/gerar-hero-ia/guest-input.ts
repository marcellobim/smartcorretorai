// Guest accepts the same image-free choice exposed by the official Banner UI.
// Uploaded images retain the existing MIME, base64 and size gates.
export function validGuestImages(raw: unknown, images: { contentType: string; data: string }[]): boolean {
  if (raw == null || (Array.isArray(raw) && raw.length === 0)) return images.length === 0
  if (!Array.isArray(raw) || raw.length > 4 || images.length !== raw.length) return false
  return images.every((image) => /^image\/(jpeg|png|webp)$/.test(image.contentType)
    && /^(?:data:image\/(?:jpeg|png|webp);base64,)?[A-Za-z0-9+/=\s]+$/.test(image.data)
    && image.data.length <= 4 * 1024 * 1024)
}
