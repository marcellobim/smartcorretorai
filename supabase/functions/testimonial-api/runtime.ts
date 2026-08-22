export const TESTIMONIAL_BODY_MAX_LENGTH = 3000
export const TESTIMONIAL_PROFESSION_MAX_LENGTH = 120

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const ALLOWED_FIELDS = new Set([
  'body',
  'profession_label',
  'publication_consent',
  'attribution_consent',
  'requestId',
])

export class TestimonialRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export type ValidTestimonialSubmission = Readonly<{
  body: string
  professionLabel: string | null
  publicationConsent: boolean
  attributionConsent: boolean
  requestId: string
}>

export function validateTestimonialSubmission(input: unknown): ValidTestimonialSubmission {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TestimonialRequestError('Dados do depoimento inválidos.', 400)
  }
  const record = input as Record<string, unknown>
  const unknownField = Object.keys(record).find(field => !ALLOWED_FIELDS.has(field))
  if (unknownField) throw new TestimonialRequestError('Campo não permitido no depoimento.', 400)

  if (typeof record.body !== 'string') throw new TestimonialRequestError('Depoimento obrigatório.', 400)
  const body = record.body.trim()
  if (!body) throw new TestimonialRequestError('Depoimento obrigatório.', 400)
  if (body.length > TESTIMONIAL_BODY_MAX_LENGTH) {
    throw new TestimonialRequestError('Depoimento acima do limite permitido.', 400)
  }

  let professionLabel: string | null = null
  if (record.profession_label != null) {
    if (typeof record.profession_label !== 'string') {
      throw new TestimonialRequestError('Profissão inválida.', 400)
    }
    professionLabel = record.profession_label.trim()
    if (!professionLabel || professionLabel.length > TESTIMONIAL_PROFESSION_MAX_LENGTH) {
      throw new TestimonialRequestError('Profissão inválida.', 400)
    }
  }
  if (typeof record.publication_consent !== 'boolean'
      || typeof record.attribution_consent !== 'boolean') {
    throw new TestimonialRequestError('Consentimentos inválidos.', 400)
  }
  const requestId = typeof record.requestId === 'string' ? record.requestId.trim() : ''
  if (!UUID_PATTERN.test(requestId)) {
    throw new TestimonialRequestError('Identificador da submissão inválido.', 400)
  }
  return Object.freeze({
    body,
    professionLabel,
    publicationConsent: record.publication_consent,
    attributionConsent: record.attribution_consent,
    requestId,
  })
}

export type PersistedTestimonial = Readonly<{
  id: string
  status: string
  submittedAt: string
  created: boolean
}>

type SubmissionDependencies = Readonly<{
  authenticate(token: string): Promise<{ id: string } | null>
  persist(userId: string, submission: ValidTestimonialSubmission): Promise<PersistedTestimonial>
  notify(testimonialId: string, userId: string): Promise<'sent' | 'already_processed' | 'failed'>
}>

export async function handleTestimonialSubmission(
  authorization: string,
  input: unknown,
  dependencies: SubmissionDependencies,
) {
  if (!/^Bearer\s+\S+/i.test(authorization)) {
    throw new TestimonialRequestError('Sessão inválida.', 401)
  }
  const token = authorization.replace(/^Bearer\s+/i, '').trim()
  const user = await dependencies.authenticate(token)
  if (!user?.id) throw new TestimonialRequestError('Sessão inválida.', 401)

  const submission = validateTestimonialSubmission(input)
  const testimonial = await dependencies.persist(user.id, submission)
  let notification: 'sent' | 'already_processed' | 'failed' = 'failed'
  try {
    notification = await dependencies.notify(testimonial.id, user.id)
  } catch {
    notification = 'failed'
  }
  return Object.freeze({
    testimonial_id: testimonial.id,
    status: testimonial.status,
    submitted_at: testimonial.submittedAt,
    testimonialCreated: testimonial.created,
    notificationSent: notification === 'sent',
  })
}
