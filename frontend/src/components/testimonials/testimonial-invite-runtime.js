export const TESTIMONIAL_BODY_MAX_LENGTH = 3000
export const TESTIMONIAL_PROFESSION_MAX_LENGTH = 120

export class TestimonialFormError extends Error {}

export function validateTestimonialForm(input) {
  const body = typeof input?.body === 'string' ? input.body.trim() : ''
  const professionLabel = typeof input?.professionLabel === 'string' ? input.professionLabel.trim() : ''
  if (!body) throw new TestimonialFormError('Escreva seu depoimento antes de enviar.')
  if (body.length > TESTIMONIAL_BODY_MAX_LENGTH) throw new TestimonialFormError('O depoimento deve ter no máximo 3.000 caracteres.')
  if (professionLabel.length > TESTIMONIAL_PROFESSION_MAX_LENGTH) throw new TestimonialFormError('A profissão deve ter no máximo 120 caracteres.')
  if (typeof input.publicationConsent !== 'boolean' || typeof input.attributionConsent !== 'boolean') {
    throw new TestimonialFormError('Revise as autorizações do depoimento.')
  }
  return Object.freeze({ body, professionLabel: professionLabel || null })
}

export function buildTestimonialPayload(input, requestId) {
  const validated = validateTestimonialForm(input)
  if (typeof requestId !== 'string' || !requestId) throw new TestimonialFormError('Não foi possível preparar o envio.')
  return Object.freeze({
    body: validated.body,
    profession_label: validated.professionLabel,
    publication_consent: input.publicationConsent,
    attribution_consent: input.attributionConsent,
    requestId,
  })
}

export function canShowTestimonialInvite({ isAuthenticated, dismissed, statusLoaded, hasSubmitted }) {
  return isAuthenticated === true && dismissed !== true && statusLoaded === true && hasSubmitted === false
}
