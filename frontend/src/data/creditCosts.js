export const CREDIT_COSTS = {
  textGeneration: 0,
  packages: {
    economica: 40,
    premium_ia: 200,
    completa: 500,
  },
  unitCosts: {
    banner: 10,
    story: 15,
    carousel: 20,
    video: 60,
    premiumVideo: 120,
  },
}

export const CREDIT_PLANS = {
  start: {
    id: 'start',
    name: 'START',
    monthlyCredits: 1000,
    quarterlyMonthlyPrice: 97,
    monthlyPrice: 127,
    subscriptionCreditsExpireOnCycle: true,
  },
  pro: {
    id: 'pro',
    name: 'PRO',
    monthlyCredits: 2500,
    quarterlyMonthlyPrice: 187,
    monthlyPrice: 247,
    subscriptionCreditsExpireOnCycle: true,
  },
  elite: {
    id: 'elite',
    name: 'ELITE',
    monthlyCredits: 6000,
    quarterlyMonthlyPrice: 497,
    monthlyPrice: 597,
    subscriptionCreditsExpireOnCycle: true,
  },
}

export const CREDIT_RECHARGES = {
  brl_49_90: {
    id: 'brl_49_90',
    credits: 2000,
    price: 49.9,
    priceLabel: '49,90',
    expiresInDays: 30,
    expirationPolicy: 'recharge_credits_expire_after_30_days',
  },
  brl_97_90: {
    id: 'brl_97_90',
    credits: 4000,
    price: 97.9,
    priceLabel: '97,90',
    expiresInDays: 30,
    expirationPolicy: 'recharge_credits_expire_after_30_days',
  },
}

export const SMART_TOKEN_RECHARGE_PACKAGES = Object.freeze(Object.values(CREDIT_RECHARGES))

export const CREDIT_POLICIES = {
  multiplier: 10,
  targetMarginRange: {
    min: 0.48,
    max: 0.65,
  },
  subscriptionCredits: {
    accumulate: false,
    expiration: 'next_billing_cycle',
  },
  rechargeCredits: {
    accumulate: true,
    expiration: 'parameterized_days_after_purchase',
    defaultExpirationDays: 30,
  },
  textGeneration: {
    consumesCredits: false,
  },
  downloads: {
    freeTrialCanDownload: false,
    requiresCreditsOrActiveSubscription: true,
  },
}

export default CREDIT_COSTS
