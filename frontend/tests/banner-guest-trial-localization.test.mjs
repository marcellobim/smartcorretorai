import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import enUS from '../src/i18n/messages/en-US.js'
import ptBR from '../src/i18n/messages/pt-BR.js'

const clientSource = readFileSync(new URL('../src/lib/guest-banner-client.js', import.meta.url), 'utf8')
const guestClientBlock = clientSource
  .slice(clientSource.indexOf('export function guestBannerErrorCode'), clientSource.indexOf('export function guestResultForBanner'))
  .replaceAll('export ', '')

function createRequest(fetchImpl) {
  return new Function('fetch', 'supabase', `${guestClientBlock}; return guestBannerRequest`)(fetchImpl, {
    auth: { getSession: async () => ({ data: { session: null } }) },
  })
}

const message = (catalog, key) => key.split('.').reduce((value, segment) => value?.[segment], catalog)

test('Banner trial CTA and failure copy follow the active US or BR catalog', () => {
  assert.equal(message(enUS, 'banner.guest.create'), 'Create Banner')
  assert.equal(message(enUS, 'banner.guest.creating'), 'Creating Banner...')
  assert.equal(message(enUS, 'banner.guest.genericError'), 'We could not complete your Banner right now. Please try again.')
  assert.equal(message(ptBR, 'banner.guest.create'), 'Criar anúncio')
  assert.equal(message(ptBR, 'banner.guest.genericError'), 'Não foi possível concluir. Tente novamente.')
})

test('guest transport retains a safe error code for the localized UI instead of hard-coding Portuguese', async () => {
  const request = createRequest(async () => ({ ok: false, json: async () => ({ error: 'origin_not_allowed' }) }))

  await assert.rejects(request('generate'), error => error.code === 'origin_not_allowed' && error.message === 'origin_not_allowed')
  assert.doesNotMatch(guestClientBlock, /Não foi possível concluir|Seu teste grátis/)
})

test('a stubbed guest Banner success returns its result without any Smart Token client path', async () => {
  const response = { status: 'completed', requestId: 'guest-request', imageUrl: 'https://example.invalid/banner.jpg', texts: {} }
  const request = createRequest(async () => ({ ok: true, json: async () => response }))

  assert.deepEqual(await request('generate', { clientRequestId: 'test' }), response)
  assert.doesNotMatch(clientSource, /smart[_ -]?token|reserveSmart|consumeSmart/i)
})
