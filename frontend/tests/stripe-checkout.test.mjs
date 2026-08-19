import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CREDIT_RECHARGES, SMART_TOKEN_RECHARGE_PACKAGES } from '../src/data/creditCosts.js'

const planos = readFileSync(new URL('../src/pages/Planos.jsx', import.meta.url), 'utf8')
const terms = readFileSync(new URL('../src/pages/TermosDeUso.jsx', import.meta.url), 'utf8')
const checkout = readFileSync(new URL('../../supabase/functions/stripe-checkout/runtime.ts', import.meta.url), 'utf8')
const webhook = readFileSync(new URL('../../supabase/functions/stripe-webhook/runtime.ts', import.meta.url), 'utf8')
const stripeCommerce = readFileSync(new URL('../../supabase/functions/_shared/stripe-commerce.ts', import.meta.url), 'utf8')
const economicCatalog = readFileSync(new URL('../../supabase/functions/_shared/economic-catalog.ts', import.meta.url), 'utf8')

test('frontend plan cards keep final monthly prices, grants and operational economic keys', () => {
  assert.match(planos, /id: 'start',[\s\S]*?preco: '127'/)
  assert.match(planos, /id: 'pro',[\s\S]*?preco: '217'/)
  assert.match(planos, /id: 'elite',[\s\S]*?preco: '547'/)
  assert.doesNotMatch(planos, /preco: '(97|187|497)'/)

  assert.match(economicCatalog, /start: Object\.freeze\(\{ smartTokens: 6_350 \}\)/)
  assert.match(economicCatalog, /pro: Object\.freeze\(\{ smartTokens: 10_850 \}\)/)
  assert.match(economicCatalog, /elite: Object\.freeze\(\{ smartTokens: 26_350 \}\)/)

  assert.match(stripeCommerce, /start: Object\.freeze\(\{[\s\S]*?key: 'start',[\s\S]*?priceEnv: 'STRIPE_PRICE_START'/)
  assert.match(stripeCommerce, /pro: Object\.freeze\(\{[\s\S]*?key: 'pro',[\s\S]*?priceEnv: 'STRIPE_PRICE_PRO'/)
  assert.match(stripeCommerce, /elite: Object\.freeze\(\{[\s\S]*?key: 'elite',[\s\S]*?priceEnv: 'STRIPE_PRICE_ELITE'/)
})

test('Planos sends only the internal economic key to the authenticated checkout function', () => {
  assert.match(planos, /functions\.invoke\('stripe-checkout',[\s\S]*body: \{ economicKey \}/)
  assert.doesNotMatch(planos, /body:\s*\{[^}]*smartTokens|body:\s*\{[^}]*priceId|body:\s*\{[^}]*validityDays/)
  assert.match(checkout, /Object\.keys\(body\)\.length !== 1/)
})

test('Stripe integration never calls the legacy add_credits RPC', () => {
  assert.doesNotMatch(`${checkout}\n${webhook}\n${stripeCommerce}`, /add_credits/)
  assert.match(webhook, /invoice\.paid/)
  assert.match(webhook, /checkout\.session\.completed/)
  assert.match(stripeCommerce, /client\.rpc\('grant_stripe_credit_lot'/)
})

test('frontend exposes exactly the two approved recharge packages', () => {
  assert.deepEqual(Object.keys(CREDIT_RECHARGES), ['brl_49_90', 'brl_97_90'])
  assert.deepEqual(SMART_TOKEN_RECHARGE_PACKAGES.map(item => ({
    id: item.id,
    credits: item.credits,
    price: item.price,
    expiresInDays: item.expiresInDays,
  })), [
    { id: 'brl_49_90', credits: 2000, price: 49.9, expiresInDays: 30 },
    { id: 'brl_97_90', credits: 4000, price: 97.9, expiresInDays: 30 },
  ])
  assert.match(planos, /2 opções simples/)
  assert.match(planos, /Fazer upgrade do plano pode oferecer melhor custo-benefício/)
  assert.doesNotMatch(planos, /Outro valor|quickAmounts|tokensPerReal/)
  assert.match(terms, /2\.000 Smart Tokens — R\$ 49,90/)
  assert.match(terms, /4\.000 Smart Tokens — R\$ 97,90/)
  assert.match(terms, /expiram em 30 dias/)
  assert.doesNotMatch(terms, /500 créditos — R\$ 59|1\.000 créditos — R\$ 99|2\.000 créditos — R\$ 179|expiram em 180 dias/)
})
