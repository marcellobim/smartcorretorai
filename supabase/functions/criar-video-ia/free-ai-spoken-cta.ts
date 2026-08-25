type JsonRecord = Record<string, unknown>

function normalizeSelectedCta(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
}

export function buildFreeAiSpokenCtaClosing(value: unknown) {
  const selectedCta = normalizeSelectedCta(value)
  if (!selectedCta) return null

  const lowerCta = selectedCta.toLocaleLowerCase('pt-BR')
  const spokenClosing = `${lowerCta.charAt(0).toLocaleUpperCase('pt-BR')}${lowerCta.slice(1).replace(/[.!?]+$/, '')}.`

  return { selectedCta, spokenClosing }
}

export function buildFreeAiSpokenCtaInstruction(value: unknown) {
  const closing = buildFreeAiSpokenCtaClosing(value)
  if (!closing) return ''

  return `SPOKEN CTA CLOSING - FREE AI ONLY
The selected CTA is "${closing.selectedCta}".
End the Brazilian Portuguese voiceover with the spoken sentence "${closing.spokenClosing}"
Deliver it naturally as the final sentence while clearly preserving the selected CTA intent.
This CTA is audio-only. Never display, caption, subtitle, draw or render it as visible text.
Keep the existing video duration. Reserve enough time for the complete CTA and shorten the preceding narration if necessary.
Never omit or truncate the spoken CTA. Do not replace it with the opening highlight or hero phrase.`
}

export function withFreeAiSpokenCta(prompt: string, value: unknown, isJsonMode: boolean) {
  const closing = buildFreeAiSpokenCtaClosing(value)
  if (!closing) return prompt

  if (isJsonMode) {
    const payload = JSON.parse(prompt) as JsonRecord
    const currentAudioEngine = payload.audio_engine && typeof payload.audio_engine === 'object'
      ? payload.audio_engine as JsonRecord
      : {}

    payload.audio_engine = {
      ...currentAudioEngine,
      spoken_cta_closing: {
        enabled: true,
        selected_cta: closing.selectedCta,
        required_final_spoken_sentence: closing.spokenClosing,
        placement: 'final_voiceover_sentence',
        language: 'pt-BR',
        audio_only: true,
        visible_text_forbidden: true,
        timing_policy: 'keep the existing duration; shorten the preceding narration so the complete CTA is never truncated',
        opening_highlight_is_not_the_cta: true,
      },
    }

    return JSON.stringify(payload, null, 2)
  }

  return `${prompt.trim()}\n\n---\n\n${buildFreeAiSpokenCtaInstruction(value)}`
}
