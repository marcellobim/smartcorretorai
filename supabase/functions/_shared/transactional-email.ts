import { MONTHLY_PLAN_GRANTS, PURCHASE_GRANTS } from './economic-catalog.ts'

// Safe production fallbacks. Configure the environment values only after the
// SNETIA sender domain has been verified by Resend.
export const TRANSACTIONAL_EMAIL_FROM = 'SmartCorretorAI <noreply@mail.smartcorretorai.com>'
export const TRANSACTIONAL_EMAIL_REPLY_TO = 'suporte@smartcorretorai.com'

const DASHBOARD_URL = 'https://snetia.com/dashboard'
const SETTINGS_URL = 'https://snetia.com/configuracoes'
const HOME_URL = 'https://snetia.com'

type PlanKey = 'start' | 'pro' | 'elite' | 'usd_start' | 'usd_pro' | 'usd_elite'
type PurchaseKey = keyof typeof PURCHASE_GRANTS

export type AppliedInvoiceDiscount = Readonly<{
  amountBrlCents: number
  percentOff?: number
  promotionCode?: string
  durationMonths?: number
}>

export type InvoicePaymentEmailData = Readonly<{
  amountPaidBrlCents: number
  currency?: 'BRL' | 'USD'
  discount?: AppliedInvoiceDiscount
}>

export type TransactionalEmailTemplateInput =
  | Readonly<{ kind: 'purchase_confirmed'; economicKey: PurchaseKey; amountPaidBrlCents?: number }>
  | Readonly<{ kind: 'subscription_welcome' | 'subscription_renewed'; economicKey: PlanKey; payment: InvoicePaymentEmailData }>
  | Readonly<{ kind: 'subscription_payment_failed'; economicKey: PlanKey }>
  | Readonly<{ kind: 'subscription_cancelled' }>
  | Readonly<{ kind: 'testimonial_received' }>
  | Readonly<{ kind: 'testimonial_bonus_granted'; smartTokenBalance?: number }>

export type TransactionalEmailContent = Readonly<{
  subject: string
  html: string
  text: string
}>

export type ResendMessage = TransactionalEmailContent & Readonly<{
  to: string
  idempotencyKey: string
}>

type SendOptions = Readonly<{
  readEnv?: (name: string) => string | undefined
  fetchImpl?: typeof fetch
  timeoutMilliseconds?: number
}>

const formatInteger = (value: number) => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(value)
const formatBrl = (cents: number) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2,
}).format(cents / 100).replace(/\u00a0/g, ' ')
const formatMoney = (cents: number, currency: 'BRL' | 'USD') => currency === 'USD'
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(cents / 100)
  : formatBrl(cents)
const formatPercent = (value: number) => new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
}).format(value)

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

function renderEmail(headline: string, paragraphs: readonly string[], ctaLabel: string, ctaUrl: string, replyTo: string) {
  const safeHeadline = escapeHtml(headline)
  const safeParagraphs = paragraphs.map(paragraph => `<p style="margin:0 0 16px;color:#334155;font-size:16px;line-height:1.6">${escapeHtml(paragraph)}</p>`).join('')
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9;padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background:#fff;border-radius:12px"><tr><td style="padding:32px"><div style="color:#0f172a;font-size:20px;font-weight:700;margin-bottom:24px">SNETIA</div><h1 style="margin:0 0 24px;color:#0f172a;font-size:26px;line-height:1.25">${safeHeadline}</h1>${safeParagraphs}<p style="margin:24px 0"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;background:#0f2747;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px">${escapeHtml(ctaLabel)}</a></p><p style="margin:28px 0 0;color:#64748b;font-size:13px;line-height:1.5">SNETIA<br><a href="mailto:${escapeHtml(replyTo)}" style="color:#475569">${escapeHtml(replyTo)}</a></p></td></tr></table></td></tr></table></body></html>`
}

function content(subject: string, paragraphs: readonly string[], ctaLabel: string, ctaUrl: string, replyTo: string): TransactionalEmailContent {
  return Object.freeze({
    subject,
    html: renderEmail(subject, paragraphs, ctaLabel, ctaUrl, replyTo),
    text: [`SNETIA`, '', ...paragraphs, '', `${ctaLabel}: ${ctaUrl}`, '', replyTo].join('\n'),
  })
}

function discountText(discount: AppliedInvoiceDiscount, currency: 'BRL' | 'USD') {
  const label = discount.promotionCode ? `Oferta ${discount.promotionCode}:` : 'Desconto aplicado:'
  if (Number.isFinite(discount.percentOff) && Number(discount.percentOff) > 0) {
    const duration = Number.isInteger(discount.durationMonths) && Number(discount.durationMonths) > 0
      ? ` por ${discount.durationMonths} meses`
      : ''
    return `${label} ${formatPercent(Number(discount.percentOff))}% de desconto${duration}`
  }
  return `${label} ${formatMoney(discount.amountBrlCents, currency)}`
}

export function buildTransactionalEmail(
  input: TransactionalEmailTemplateInput,
  readEnv: NonNullable<SendOptions['readEnv']> = defaultEnv,
): TransactionalEmailContent {
  const replyTo = configuredAddress(readEnv, 'TRANSACTIONAL_EMAIL_REPLY_TO', TRANSACTIONAL_EMAIL_REPLY_TO)
  const email = (subject: string, paragraphs: readonly string[], ctaLabel: string, ctaUrl: string) => content(subject, paragraphs, ctaLabel, ctaUrl, replyTo)
  if (input.kind === 'testimonial_received') {
    return email('Recebemos seu depoimento', [
      'Olá,',
      'Obrigado por compartilhar sua experiência com a SNETIA. Seu depoimento foi recebido e será analisado.',
      'Se ele for aprovado conforme as regras da campanha, você poderá receber 500 Smart Tokens.',
      'Avisaremos você por e-mail caso o bônus seja concedido.',
    ], 'Acessar SNETIA', DASHBOARD_URL)
  }

  if (input.kind === 'testimonial_bonus_granted') {
    const paragraphs = [
      'Olá,',
      'Seu depoimento foi aprovado para a campanha.',
      'Concedemos 500 Smart Tokens à sua conta pela participação.',
    ]
    if (Number.isSafeInteger(input.smartTokenBalance) && Number(input.smartTokenBalance) >= 0) {
      paragraphs.push(`Saldo confirmado: ${formatInteger(Number(input.smartTokenBalance))} ST`)
    }
    paragraphs.push('Obrigado por participar e compartilhar sua experiência.')
    return email('Você ganhou 500 Smart Tokens', paragraphs, 'Usar meus Smart Tokens', DASHBOARD_URL)
  }

  if (input.kind === 'purchase_confirmed') {
    const purchase = PURCHASE_GRANTS[input.economicKey]
    if (!purchase) throw new Error('transactional_email_catalog_item_invalid')
    return email('Seus Smart Tokens chegaram', [
      'Olá,',
      'Sua recarga foi confirmada.',
      `${formatInteger(purchase.smartTokens)} Smart Tokens já estão disponíveis na sua conta.`,
      `Valor pago: ${formatMoney(input.amountPaidBrlCents ?? ('priceUsdCents' in purchase ? purchase.priceUsdCents : purchase.priceBrlCents), 'priceUsdCents' in purchase ? 'USD' : 'BRL')}`,
      `Validade: ${purchase.validityDays} dias`,
    ], 'Começar a criar', DASHBOARD_URL)
  }

  if (input.kind === 'subscription_cancelled') {
    return email('Sua assinatura foi cancelada', [
      'Olá,',
      'Sua assinatura da SNETIA foi cancelada e não haverá uma nova renovação.',
      'Os Smart Tokens já disponíveis na sua conta continuam seguindo suas regras de validade.',
      'Obrigado por usar a SNETIA. Esperamos ter você de volta.',
    ], 'Voltar à SNETIA', HOME_URL)
  }

  const plan = MONTHLY_PLAN_GRANTS[input.economicKey]
  if (!plan || !('monthlyPriceBrlCents' in plan) || !('displayName' in plan)) {
    throw new Error('transactional_email_catalog_item_invalid')
  }
  const planName = plan.displayName
  const currency: 'BRL' | 'USD' = 'monthlyPriceUsdCents' in plan ? 'USD' : 'BRL'
  const regularPrice = 'monthlyPriceUsdCents' in plan ? plan.monthlyPriceUsdCents : plan.monthlyPriceBrlCents
  if (input.kind === 'subscription_welcome') {
    const paragraphs = [
      'Olá,',
      `Sua assinatura do plano ${planName} está ativa.`,
      `Valor pago: ${formatMoney(input.payment.amountPaidBrlCents, input.payment.currency ?? currency)}`,
    ]
    if (input.payment.discount) {
      paragraphs.push(discountText(input.payment.discount, input.payment.currency ?? currency))
      paragraphs.push(`Valor normal do plano: ${formatMoney(regularPrice, currency)}/mês`)
    }
    paragraphs.push(
      `Smart Tokens incluídos neste ciclo: ${formatInteger(plan.smartTokens)} ST`,
      'Eles já estão disponíveis na sua conta.',
    )
    return email(`Bem-vindo ao plano ${planName}`, paragraphs, 'Começar a criar', DASHBOARD_URL)
  }
  if (input.kind === 'subscription_renewed') {
    const paragraphs = [
      'Olá,',
      `Sua renovação do plano ${planName} foi confirmada.`,
      `Valor pago: ${formatMoney(input.payment.amountPaidBrlCents, input.payment.currency ?? currency)}`,
    ]
    if (input.payment.discount) paragraphs.push(discountText(input.payment.discount, input.payment.currency ?? currency))
    paragraphs.push(
      `Smart Tokens adicionados neste ciclo: ${formatInteger(plan.smartTokens)} ST`,
      'Seu plano continua ativo.',
    )
    return email(`Seu plano ${planName} foi renovado`, paragraphs, 'Acessar SNETIA', DASHBOARD_URL)
  }
  return email('Não conseguimos renovar seu plano', [
    'Olá,',
    `Não conseguimos concluir a renovação do seu plano ${planName}.`,
    'Nenhum novo Smart Token foi adicionado neste ciclo.',
    'Você pode revisar sua forma de pagamento em Configurações → Plano e Assinatura.',
  ], 'Gerenciar assinatura', SETTINGS_URL)
}

function defaultEnv(name: string) {
  const runtime = globalThis as typeof globalThis & { Deno?: { env?: { get(name: string): string | undefined } } }
  return runtime.Deno?.env?.get(name)
}

function configuredAddress(readEnv: NonNullable<SendOptions['readEnv']>, name: string, fallback: string) {
  const value = String(readEnv(name) ?? '').trim()
  return value || fallback
}

export async function sendTransactionalEmail(message: ResendMessage, options: SendOptions = {}) {
  const readEnv = options.readEnv ?? defaultEnv
  const apiKey = String(readEnv('RESEND_API_KEY') ?? '').trim()
  // Future Resend configuration, after sender verification:
  // TRANSACTIONAL_EMAIL_FROM="SNETIA <support@snetia.com>"
  // TRANSACTIONAL_EMAIL_REPLY_TO="support@snetia.com"
  const from = configuredAddress(readEnv, 'TRANSACTIONAL_EMAIL_FROM', TRANSACTIONAL_EMAIL_FROM)
  const replyTo = configuredAddress(readEnv, 'TRANSACTIONAL_EMAIL_REPLY_TO', TRANSACTIONAL_EMAIL_REPLY_TO)
  if (!apiKey) throw new Error('resend_configuration_missing')
  if (!/^\S+@\S+\.\S+$/.test(message.to)) throw new Error('transactional_email_recipient_invalid')
  if (!message.idempotencyKey || message.idempotencyKey.length > 256) throw new Error('transactional_email_idempotency_invalid')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), options.timeoutMilliseconds ?? 8_000)
  try {
    const response = await (options.fetchImpl ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': message.idempotencyKey,
      },
      body: JSON.stringify({
        from,
        reply_to: replyTo,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
      }),
    })
    if (!response.ok) throw new Error('resend_delivery_rejected')
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>
    const providerMessageId = typeof payload.id === 'string' ? payload.id : ''
    if (!providerMessageId) throw new Error('resend_delivery_response_invalid')
    return providerMessageId
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('resend_')) throw error
    throw new Error('resend_delivery_failed')
  } finally {
    clearTimeout(timeout)
  }
}
