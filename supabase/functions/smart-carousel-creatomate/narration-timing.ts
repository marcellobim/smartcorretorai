export const SMART_CAROUSEL_SCENE_DURATION_SECONDS = 3.5
export const SMART_CAROUSEL_TRANSITION_DURATION_SECONDS = 0.45
export const SMART_CAROUSEL_CTA_SCENE_DURATION_SECONDS = 3.5
export const SMART_CAROUSEL_NARRATION_CTA_GAP_SECONDS = 1.5

export type NarrationCandidate = {
  narration: string
  narrationHighlights: string[]
}

type ResolveNarrationTimingOptions = {
  initial: NarrationCandidate
  minimumWords: number
  maximumWords: number
  fallbackInvitation: string
  reviseOnce: (targetWords: number) => Promise<NarrationCandidate>
}

export function countNarrationWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length
}

export function calculateSmartCarouselTiming(imageCount: number) {
  const photoSequenceSeconds = imageCount * SMART_CAROUSEL_SCENE_DURATION_SECONDS
    - Math.max(0, imageCount - 1) * SMART_CAROUSEL_TRANSITION_DURATION_SECONDS

  return {
    photoSequenceSeconds,
    narrationSeconds: Math.max(1, photoSequenceSeconds - SMART_CAROUSEL_NARRATION_CTA_GAP_SECONDS),
    totalSeconds: photoSequenceSeconds + SMART_CAROUSEL_CTA_SCENE_DURATION_SECONDS,
  }
}

export function calculateNarrationWordTargets(availableSeconds: number) {
  const minimumWords = Math.ceil(availableSeconds * 1.70)
  const maximumWords = Math.floor(availableSeconds * 2.20)

  return {
    minimumWords,
    maximumWords,
    targetWords: Math.round((minimumWords + maximumWords) / 2),
  }
}

export function isSemanticallyValidNarration(value: string) {
  return countNarrationWords(value) >= 2 && /\p{L}/u.test(value)
}

function ensureSentenceEnding(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  return /[.!?…]$/.test(normalized) ? normalized : `${normalized}.`
}

function splitCompleteSentences(value: string) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (!normalized) return []

  return (normalized.match(/[^.!?…]+(?:[.!?…]+|$)/gu) || [])
    .map(ensureSentenceEnding)
    .filter(Boolean)
}

function findProtectedInvitation(sentence: string, maximumWords: number) {
  const clauses = sentence
    .split(/[,;:]/)
    .map(ensureSentenceEnding)
    .filter((clause) => isSemanticallyValidNarration(clause) && countNarrationWords(clause) <= maximumWords)

  return clauses.at(-1) || ''
}

export function normalizeNarrationToMaximum(
  narration: string,
  maximumWords: number,
  fallbackInvitation: string,
) {
  const normalized = narration.replace(/\s+/g, ' ').trim()
  if (!normalized || maximumWords < 1) throw new Error('narration_normalization_failed')
  if (countNarrationWords(normalized) <= maximumWords) return normalized

  const sentences = splitCompleteSentences(normalized)
  const retained = sentences.map((_, index) => index)
  const lastIndex = sentences.length - 1

  while (retained.length > 1) {
    const candidate = retained.map((index) => sentences[index]).join(' ')
    if (countNarrationWords(candidate) <= maximumWords) return candidate

    const secondary = retained
      .filter((index) => index !== 0 && index !== lastIndex)
      .sort((left, right) => countNarrationWords(sentences[right]) - countNarrationWords(sentences[left]))

    const indexToRemove = secondary[0] ?? retained.find((index) => index !== lastIndex)
    if (indexToRemove === undefined) break
    retained.splice(retained.indexOf(indexToRemove), 1)
  }

  const protectedInvitation = ensureSentenceEnding(sentences[lastIndex] || '')
  if (
    isSemanticallyValidNarration(protectedInvitation)
    && countNarrationWords(protectedInvitation) <= maximumWords
  ) return protectedInvitation

  const protectedClause = findProtectedInvitation(protectedInvitation, maximumWords)
  if (protectedClause) return protectedClause

  const safeFallback = ensureSentenceEnding(fallbackInvitation)
  if (
    isSemanticallyValidNarration(safeFallback)
    && countNarrationWords(safeFallback) <= maximumWords
  ) return safeFallback

  throw new Error('narration_normalization_failed')
}

export async function resolveNarrationTiming({
  initial,
  minimumWords,
  maximumWords,
  fallbackInvitation,
  reviseOnce,
}: ResolveNarrationTimingOptions) {
  if (!isSemanticallyValidNarration(initial.narration)) throw new Error('invalid_marketing_response')

  const initialWords = countNarrationWords(initial.narration)
  if (initialWords >= minimumWords && initialWords <= maximumWords) {
    return { ...initial, revisionAttempts: 0 }
  }

  const targetWords = Math.round((minimumWords + maximumWords) / 2)
  const revised = await reviseOnce(targetWords)
  if (!isSemanticallyValidNarration(revised.narration)) throw new Error('invalid_marketing_response')

  const finalNarration = countNarrationWords(revised.narration) > maximumWords
    ? normalizeNarrationToMaximum(revised.narration, maximumWords, fallbackInvitation)
    : revised.narration

  if (
    !isSemanticallyValidNarration(finalNarration)
    || countNarrationWords(finalNarration) > maximumWords
  ) throw new Error('narration_duration_out_of_range')

  return {
    ...revised,
    narration: finalNarration,
    revisionAttempts: 1,
  }
}
