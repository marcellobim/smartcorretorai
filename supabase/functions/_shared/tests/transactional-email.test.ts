import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  TRANSACTIONAL_EMAIL_FROM,
  TRANSACTIONAL_EMAIL_REPLY_TO,
  buildTransactionalEmail,
  sendTransactionalEmail,
} from '../transactional-email.ts'

test('approved purchase email uses the canonical recharge catalog', () => {
  const email = buildTransactionalEmail({ kind: 'purchase_confirmed', economicKey: 'brl_49_90' })
  assert.equal(email.subject, 'Seus Smart Tokens chegaram')
  assert.match(email.text, /2\.000 Smart Tokens/)
  assert.match(email.text, /R\$ 49,90/)
  assert.match(email.text, /30 dias/)
  assert.match(email.html, /https:\/\/www\.smartcorretorai\.com\/dashboard/)
})

test('first invoice and renewal have distinct plan subjects and canonical values', () => {
  const welcome = buildTransactionalEmail({ kind: 'subscription_welcome', economicKey: 'start' })
  const renewal = buildTransactionalEmail({ kind: 'subscription_renewed', economicKey: 'pro' })
  assert.equal(welcome.subject, 'Bem-vindo ao plano START')
  assert.match(welcome.text, /R\$ 127,00\/mês/)
  assert.match(welcome.text, /6\.350 ST/)
  assert.equal(renewal.subject, 'Seu plano PRO foi renovado')
  assert.match(renewal.text, /R\$ 217,00/)
  assert.match(renewal.text, /10\.850 Smart Tokens/)
})

test('payment failure and cancellation use short safe operational copy', () => {
  const failure = buildTransactionalEmail({ kind: 'subscription_payment_failed', economicKey: 'elite' })
  const cancellation = buildTransactionalEmail({ kind: 'subscription_cancelled' })
  assert.equal(failure.subject, 'Não conseguimos renovar seu plano')
  assert.match(failure.text, /plano ELITE/)
  assert.match(failure.text, /Nenhum novo Smart Token/)
  assert.match(failure.text, /\/configuracoes/)
  assert.equal(cancellation.subject, 'Sua assinatura foi cancelada')
  assert.match(cancellation.text, /não haverá uma nova renovação/)
  assert.match(cancellation.text, /não são apagados/)
})

test('Resend transport is server-only, fixed-sender and mocked in tests', async () => {
  let request: { url: string; init?: RequestInit } | null = null
  const content = buildTransactionalEmail({ kind: 'subscription_welcome', economicKey: 'start' })
  const id = await sendTransactionalEmail({
    ...content,
    to: 'usuario@example.com',
    idempotencyKey: 'stripe-email:invoice:in_test',
  }, {
    readEnv: name => name === 'RESEND_API_KEY' ? 'test_key_not_real' : undefined,
    fetchImpl: async (url, init) => {
      request = { url: String(url), init }
      return new Response(JSON.stringify({ id: 'email_test' }), { status: 200 })
    },
  })
  assert.equal(id, 'email_test')
  assert.equal(request?.url, 'https://api.resend.com/emails')
  const headers = new Headers(request?.init?.headers)
  assert.equal(headers.get('Idempotency-Key'), 'stripe-email:invoice:in_test')
  const body = JSON.parse(String(request?.init?.body))
  assert.equal(body.from, TRANSACTIONAL_EMAIL_FROM)
  assert.equal(body.reply_to, TRANSACTIONAL_EMAIL_REPLY_TO)
  assert.deepEqual(body.to, ['usuario@example.com'])
  assert.equal(JSON.stringify(body).includes('test_key_not_real'), false)
})

test('Resend errors expose only sanitized error codes', async () => {
  const content = buildTransactionalEmail({ kind: 'purchase_confirmed', economicKey: 'brl_97_90' })
  await assert.rejects(() => sendTransactionalEmail({
    ...content,
    to: 'usuario@example.com',
    idempotencyKey: 'stripe-email:purchase:cs_test',
  }, {
    readEnv: () => 'test_key_not_real',
    fetchImpl: async () => new Response('provider detail must stay private', { status: 500 }),
  }), /resend_delivery_rejected/)
})

test('email implementation remains absent from the frontend and reads only the server secret', () => {
  const source = readFileSync(new URL('../transactional-email.ts', import.meta.url), 'utf8')
  const webhook = readFileSync(new URL('../../stripe-webhook/index.ts', import.meta.url), 'utf8')
  assert.match(source, /RESEND_API_KEY/)
  assert.match(webhook, /auth\.admin\.getUserById\(notification\.userId\)/)
  assert.doesNotMatch(source, /VITE_|SUPABASE_SERVICE_ROLE_KEY|STRIPE_SECRET_KEY/)
})
