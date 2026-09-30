type JsonRecord = Record<string, unknown>

function normalizeSelectedCta(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
}

const EN_US_SPOKEN_CTAS: Record<string, string> = {
  'SAIBA MAIS': 'Learn more.',
  'AGENDE SUA VISITA': 'Schedule your visit.',
  'ENTRE EM CONTATO': 'Contact us.',
  'SOLICITE MAIS INFORMACOES': 'Request more information.',
  'INFORMACOES NA BIO': 'Find details in our bio.',
  'FALE COMIGO': "Let's talk.",
  'QUERO CONVERSAR': "Let's talk.",
  'CHAME NO WHATSAPP': 'Message us on WhatsApp.',
}

export function buildFreeAiSpokenCtaClosing(value: unknown, language = 'pt-BR') {
  const selectedCta = normalizeSelectedCta(value)
  if (!selectedCta) return null

  if (language === 'en-US') {
    return {
      selectedCta,
      spokenClosing: EN_US_SPOKEN_CTAS[selectedCta.toLocaleUpperCase('pt-BR')] || 'Learn more.',
    }
  }

  const lowerCta = selectedCta.toLocaleLowerCase('pt-BR')
  const spokenClosing = `${lowerCta.charAt(0).toLocaleUpperCase('pt-BR')}${lowerCta.slice(1).replace(/[.!?]+$/, '')}.`

  return { selectedCta, spokenClosing }
}

export function buildFreeAiSpokenCtaInstruction(value: unknown, language = 'pt-BR') {
  const closing = buildFreeAiSpokenCtaClosing(value, language)
  if (!closing) return ''

  const languageInstruction = language === 'en-US'
    ? `End the American English voiceover with the spoken sentence "${closing.spokenClosing}"`
    : `End the Brazilian Portuguese voiceover with the spoken sentence "${closing.spokenClosing}"`

  return `SPOKEN CTA CLOSING - FREE AI ONLY
The selected CTA is "${closing.selectedCta}".
${languageInstruction}
Deliver it naturally as the final sentence while clearly preserving the selected CTA intent.
This CTA is audio-only. Never display, caption, subtitle, draw or render it as visible text.
Keep the existing video duration. Reserve enough time for the complete CTA and shorten the preceding narration if necessary.
Never omit or truncate the spoken CTA. Do not replace it with the opening highlight or hero phrase.`
}

export function withFreeAiSpokenCta(prompt: string, value: unknown, isJsonMode: boolean, language = 'pt-BR') {
  const closing = buildFreeAiSpokenCtaClosing(value, language)
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
        language,
        audio_only: true,
        visible_text_forbidden: true,
        timing_policy: 'keep the existing duration; shorten the preceding narration so the complete CTA is never truncated',
        opening_highlight_is_not_the_cta: true,
      },
    }

    return JSON.stringify(payload, null, 2)
  }

  return `${prompt.trim()}\n\n---\n\n${buildFreeAiSpokenCtaInstruction(value, language)}`
}
