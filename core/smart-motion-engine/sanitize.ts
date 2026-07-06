const DEFAULT_TEXT_LIMIT = 90
const DEFAULT_CAPTION_LIMIT = 64

export function sanitizeText(value: unknown, maxLength = DEFAULT_TEXT_LIMIT): string {
  return String(value ?? '')
    .normalize('NFC')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/[\u2028\u2029]/g, ' ')
    .replace(/[\uD800-\uDFFF]/g, '')
    .replace(/[^\p{L}\p{N}\s.,!?;:/'"()+\-&%$@#]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function sanitizeCaption(value: unknown): string {
  return sanitizeText(value, DEFAULT_CAPTION_LIMIT)
}

export function sanitizeCta(value: unknown): string {
  return sanitizeText(value, 48)
}

export function wrapText(value: unknown, maxLineChars = 22, maxLines = 3): string {
  const clean = sanitizeText(value, maxLineChars * maxLines + maxLines)
  if (!clean) return ''

  const lines: string[] = []
  let current = ''

  for (const word of clean.split(' ').filter(Boolean)) {
    const safeWord = word.length > maxLineChars ? word.slice(0, maxLineChars) : word
    const next = current ? `${current} ${safeWord}` : safeWord
    if (next.length > maxLineChars && current) {
      lines.push(current)
      current = safeWord
    } else {
      current = next
    }

    if (lines.length >= maxLines) break
  }

  if (current && lines.length < maxLines) lines.push(current)
  return lines.join('\n')
}

export function escapeFfmpegFilterPath(filePath: string): string {
  return String(filePath || '')
    .replace(/\\/g, '/')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
}

export function sanitizePositiveNumber(value: unknown, fallback: number, min: number, max: number): number {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return fallback
  return Math.min(max, Math.max(min, numeric))
}
