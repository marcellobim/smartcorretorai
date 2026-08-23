export const SMART_TOKEN_COSTS = Object.freeze({
  textCampaign: 25,
  quickBannerItem: 45,
  realEstateBannerItem: 75,
  virtualStagingImage: 30,
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
  const message = String(error?.message || error || '').trim()
  if (code === 'TRIAL_PRODUCT_NOT_ALLOWED' || /TRIAL_PRODUCT_NOT_ALLOWED/i.test(message)) {
    return 'Seu teste grátis inclui uma Campanha de Textos. Para usar este produto, adicione Smart Tokens em Planos.'
  }
  if (code === 'INSUFFICIENT_SMART_TOKENS' || /INSUFFICIENT_SMART_TOKENS|Smart Tokens.{0,20}insuficient|saldo.{0,30}insuficient/i.test(message)) {
    return 'Você precisa de mais Smart Tokens para esta criação.'
  }
  if (/sess[aã]o.{0,30}(expir|inv[aá]lid)|unauthori[sz]ed|not authenticated|auth.{0,20}required|invalid.{0,10}jwt|jwt.{0,20}expir/i.test(`${code} ${message}`)) {
    return 'Sua sessão expirou. Faça login novamente.'
  }
  if (/unsupported.{0,20}(file|image|video)|invalid.{0,20}(file|image|video)|arquivo.{0,30}(inv[aá]lid|n[aã]o suport)|formato.{0,30}(inv[aá]lid|n[aã]o suport)|JPG|JPEG|PNG|MP4|tamanho.{0,20}(arquivo|imagem|v[ií]deo)/i.test(`${code} ${message}`)) {
    return 'Revise o arquivo enviado e tente novamente.'
  }
  if (/too many|too few|m[aá]xim[oa]|m[ií]nim[oa]|limite|quantidade.{0,30}(arquivo|imagem|foto|pe[çc]a)/i.test(`${code} ${message}`)) {
    return 'Revise a quantidade de arquivos e tente novamente.'
  }
  if (/required|obrigat[oó]ri|campo.{0,20}(ausente|inv[aá]lid)|missing.{0,20}(field|input)|invalid.{0,20}(input|payload)/i.test(`${code} ${message}`)) {
    return 'Revise as informações preenchidas e tente novamente.'
  }
  if (/campanha.{0,30}n[aã]o foi salva|textos.{0,30}n[aã]o (foi|foram) salv/i.test(message)) {
    return 'Os textos foram gerados, mas a campanha não foi salva automaticamente.'
  }
  return fallback
}
