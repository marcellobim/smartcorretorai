import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CREDIT_RECHARGES, SMART_TOKEN_RECHARGE_PACKAGES } from '../src/data/creditCosts.js'
import { getSmartTokenBalance } from '../src/lib/smart-tokens.js'

const planos = readFileSync(new URL('../src/pages/Planos.jsx', import.meta.url), 'utf8')
const terms = readFileSync(new URL('../src/pages/TermosDeUso.jsx', import.meta.url), 'utf8')
const checkout = readFileSync(new URL('../../supabase/functions/stripe-checkout/runtime.ts', import.meta.url), 'utf8')
const webhook = readFileSync(new URL('../../supabase/functions/stripe-webhook/runtime.ts', import.meta.url), 'utf8')
const stripeCommerce = readFileSync(new URL('../../supabase/functions/_shared/stripe-commerce.ts', import.meta.url), 'utf8')
const economicCatalog = readFileSync(new URL('../../supabase/functions/_shared/economic-catalog.ts', import.meta.url), 'utf8')
const sidebar = readFileSync(new URL('../src/components/layout/Sidebar.jsx', import.meta.url), 'utf8')
const settings = readFileSync(new URL('../src/pages/Configuracoes.jsx', import.meta.url), 'utf8')
const dashboard = readFileSync(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8')
const portalIndex = readFileSync(new URL('../../supabase/functions/stripe-customer-portal/index.ts', import.meta.url), 'utf8')
const portalRuntime = readFileSync(new URL('../../supabase/functions/stripe-customer-portal/runtime.ts', import.meta.url), 'utf8')

test('frontend plan cards keep final monthly prices, grants and operational economic keys', () => {
  assert.equal((planos.match(/>Mensal</g) ?? []).length, 1)
  assert.doesNotMatch(planos, /Trimestral|Anual|Em breve|em breve/)

  assert.match(planos, /id: 'start',[\s\S]*?preco: '127',[\s\S]*?capacityDetail: '6\.350 Smart Tokens por mês'/)
  assert.match(planos, /id: 'pro',[\s\S]*?preco: '217',[\s\S]*?capacityDetail: '10\.850 Smart Tokens por mês'/)
  assert.match(planos, /id: 'elite',[\s\S]*?preco: '547',[\s\S]*?capacityDetail: '26\.350 Smart Tokens por mês'/)
  assert.doesNotMatch(planos, /preco: '(97|187|497)'/)
  assert.doesNotMatch(planos, /Smart Tokens inclusos/)

  assert.match(economicCatalog, /start: Object\.freeze\(\{ smartTokens: 6_350,/)
  assert.match(economicCatalog, /pro: Object\.freeze\(\{ smartTokens: 10_850,/)
  assert.match(economicCatalog, /elite: Object\.freeze\(\{ smartTokens: 26_350,/)

  assert.match(stripeCommerce, /start: Object\.freeze\(\{[\s\S]*?key: 'start',[\s\S]*?priceEnv: 'STRIPE_PRICE_START'/)
  assert.match(stripeCommerce, /pro: Object\.freeze\(\{[\s\S]*?key: 'pro',[\s\S]*?priceEnv: 'STRIPE_PRICE_PRO'/)
  assert.match(stripeCommerce, /elite: Object\.freeze\(\{[\s\S]*?key: 'elite',[\s\S]*?priceEnv: 'STRIPE_PRICE_ELITE'/)
})

test('Planos sends only the internal economic key to the authenticated checkout function', () => {
  assert.match(planos, /functions\.invoke\('stripe-checkout',[\s\S]*body: \{ economicKey \}/)
  assert.doesNotMatch(planos, /body:\s*\{[^}]*smartTokens|body:\s*\{[^}]*priceId|body:\s*\{[^}]*validityDays/)
  assert.match(checkout, /Object\.keys\(body\)\.length !== 1/)
})

test('Planos presents SMART15 once above subscriptions without adding a coupon field or changing recharges', () => {
  assert.equal((planos.match(/Oferta de lançamento/g) ?? []).length, 1)
  assert.equal((planos.match(/SMART15/g) ?? []).length, 1)
  assert.match(planos, /Use o código\{' '\}[\s\S]*?SMART15[\s\S]*?no checkout e ganhe 15% de desconto nos 3 primeiros meses\./)
  assert.match(planos, /Oferta de lançamento[\s\S]*?SMART15[\s\S]*?<section className="mt-8 grid gap-5 lg:grid-cols-3">/)
  assert.doesNotMatch(planos, /<input|aplicar cupom|preço promocional|precoPromocional/i)

  const rechargeSection = planos.slice(planos.indexOf('<section className="mt-10 rounded-3xl'))
  assert.doesNotMatch(rechargeSection, /SMART15|Oferta de lançamento|15%/)
})

test('purchased Smart Token balance remains visible without requiring a subscription', () => {
  assert.equal(getSmartTokenBalance({ plano: 'free', saldo_creditos: 2000 }), 2000)
  assert.equal(getSmartTokenBalance({ plano: 'pro', saldo_creditos: 10850 }), 10850)
  assert.equal(getSmartTokenBalance({ plano: 'free', saldo_creditos: 0 }), 0)

  assert.match(sidebar, /getSmartTokenBalance\(\{ saldo_creditos: profile\?\.saldo_creditos \}\)/)
  assert.match(sidebar, /const showBalance = balance !== null && \(!trial \|\| balance > 0\)/)
  assert.match(sidebar, /Saldo: <span[^>]*>\{formatSmartTokens\(balance\)\} ST<\/span>/)
  assert.match(sidebar, /Saldo:[\s\S]*?<NavLink[\s\S]*?Smart Tokens/)
  assert.doesNotMatch(planos, /Saldo:|getSmartTokenBalance|formatSmartTokens/)
})

test('successful checkout return refreshes the authenticated profile once', () => {
  assert.match(planos, /searchParams\.get\('checkout'\) !== 'success'/)
  assert.match(planos, /checkoutRefreshHandledRef\.current = true[\s\S]*?void reloadProfile\(\)/)
  assert.match(planos, /if \(!isAuthenticated \|\| loading[^\n]+checkoutRefreshHandledRef\.current\) return/)
})

test('active users manage subscriptions through a server-authoritative Stripe Customer Portal', () => {
  assert.match(settings, /hasActiveSubscription && \([\s\S]*?Gerenciar assinatura/)
  assert.match(settings, /functions\.invoke\('stripe-customer-portal'\)/)
  assert.doesNotMatch(settings, /functions\.invoke\('stripe-customer-portal',[\s\S]{0,120}body:/)
  assert.doesNotMatch(settings, /customer_id|STRIPE_SECRET_KEY|sk_live_|sk_test_/)
  assert.match(portalIndex, /SUPABASE_SERVICE_ROLE_KEY/)
  assert.match(portalIndex, /STRIPE_SECRET_KEY/)
  assert.match(portalIndex, /from\('subscriptions'\)[\s\S]*?eq\('user_id', userId\)[\s\S]*?eq\('status', 'ativo'\)/)
  assert.match(portalRuntime, /Object\.keys\(body\)\.length !== 0/)
  assert.match(portalRuntime, /portalUrl\.hostname !== 'billing\.stripe\.com'/)
  assert.match(dashboard, /Gerenciar assinatura[\s\S]*?cancelamento tem efeito ao final do período vigente/)
})

test('Customer Portal does not mutate credits and the webhook remains cancellation authority', () => {
  assert.doesNotMatch(`${portalIndex}\n${portalRuntime}`, /credit_lots|saldo_creditos|add_credits|grant_stripe_credit_lot/)
  assert.match(webhook, /customer\.subscription\.deleted[\s\S]*?subscription_cancelled/)
  assert.match(webhook, /normalizeStripeSubscription\(object, 'cancelado'\)/)
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
  assert.match(planos, /Continue ou comece a criar/)
  assert.match(planos, /Escolha sua recarga/)
  assert.match(planos, /Comece sem assinatura ou complemente seu plano sempre que precisar de mais capacidade para criar\./)
  assert.match(planos, /Recarga selecionada:/)
  assert.match(planos, /Smart Tokens extras/)
  assert.match(planos, /Use Smart Tokens extras para começar a criar sem assinatura ou complementar seu plano\./)
  assert.match(planos, /Fazer upgrade do plano pode oferecer melhor custo-benefício/)
  assert.doesNotMatch(planos, /2 opções simples|Use em Banner Imobiliário, Studio IA, Banners e Textos\.|pacote|Outro valor|quickAmounts|tokensPerReal/i)
  assert.match(terms, /2\.000 Smart Tokens — R\$ 49,90/)
  assert.match(terms, /4\.000 Smart Tokens — R\$ 97,90/)
  assert.match(terms, /expiram em 30 dias/)
  assert.match(planos, /Validade: 30 dias/)
  assert.match(planos, /Cada recarga tem validade de 30 dias a partir da compra/)
  assert.doesNotMatch(terms, /500 créditos — R\$ 59|1\.000 créditos — R\$ 99|2\.000 créditos — R\$ 179|expiram em 180 dias/)
})

test('Planos copy exposes only current rules and the contact channel', () => {
  assert.match(planos, /Todos os planos dão acesso à plataforma completa\./)
  assert.match(planos, /Smart Tokens representam sua capacidade de criação\./)
  assert.match(planos, /Antes de cada criação, o sistema verifica seu saldo disponível\./)
  assert.match(planos, /Cancelamento pode ser feito pela conta\./)
  assert.doesNotMatch(planos, /Landing IA|landings|7 dias|24 horas|download|armazenamento/i)

  assert.match(planos, />Contato</)
  assert.match(planos, /Dúvidas ou sugestões\? Fale com a gente\./)
  assert.match(planos, /Use este canal para suporte, sugestões ou qualquer assunto relacionado ao SmartCorretorAI\./)
  assert.match(planos, /suporte@smartcorretorai\.com/)
})
