export const SMART_TOKEN_COSTS = Object.freeze({
  textCampaign: 25,
  quickBannerItem: 45,
  realEstateBannerItem: 75,
  smartCarousel: 100,
  veoVideo: 120,
  geminiVideo: 325,
})

const BALANCE_FIELDS = Object.freeze([
  'saldo_creditos',
  'smart_tokens_saldo',
  'tokens_saldo',
  'restantes_mes',
  'total_disponivel',
])

export function getSmartTokenBalance(user) {
  const value = BALANCE_FIELDS
    .map(field => user?.[field])
    .find(candidate => candidate !== undefined && candidate !== null && candidate !== '')

  if (value === undefined) return null
  const balance = Number(value)
  return Number.isFinite(balance) ? Math.max(balance, 0) : null
}

export function isTrialUser(user, now = Date.now()) {
  const plan = String(user?.plano || user?.plan || user?.subscription_plan || '').trim().toLowerCase()
  if (['trial', 'teste', 'free_trial', 'demonstrativo'].includes(plan)) return true

  const trialEndsAt = Date.parse(String(user?.trial_ends_at || ''))
  return Number.isFinite(trialEndsAt) && trialEndsAt > now
}

export function formatSmartTokens(value) {
  const amount = Number(value)
  return Number.isFinite(amount) ? Math.max(0, Math.round(amount)).toLocaleString('pt-BR') : '—'
}

export function getSmartTokenErrorMessage(error, fallback = 'Não foi possível concluir esta criação.') {
  const code = String(error?.code || error?.context?.code || '').toUpperCase()
  const message = String(error?.message || error || '')
  if (code === 'INSUFFICIENT_SMART_TOKENS' || /INSUFFICIENT_SMART_TOKENS|Smart Tokens.{0,20}insuficient|saldo.{0,30}insuficient/i.test(message)) {
    return 'Você precisa de mais Smart Tokens para esta criação.'
  }
  return message || fallback
}
