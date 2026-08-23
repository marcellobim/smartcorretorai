import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('./index.ts', import.meta.url), 'utf8')
const migration = await readFile(new URL('../../migrations/20260823020000_harden_quick_banner_campaign_provider_gate.sql', import.meta.url), 'utf8')

test('JWT and server-derived user identity precede the economic claim and provider', () => {
  const getUser = source.indexOf('supabase.auth.getUser(token)')
  const serverUser = source.indexOf('const userId = user.id')
  const claim = source.indexOf('await campaignGate.claim({ userId')
  const provider = source.indexOf("fetch('https://api.openai.com/v1/chat/completions'")
  assert.ok(getUser > -1 && serverUser > getUser && claim > serverUser && provider > claim)
  assert.match(source, /if \(!authHeader\.startsWith\('Bearer '\)\)[\s\S]*?401/)
  assert.match(source, /if \(!user \|\| authError\)[\s\S]*?401/)
  assert.doesNotMatch(source, /const userId\s*=\s*(?:payload|body|user_id)/)
})

test('request identity is mandatory and no client price reaches the campaign gate', () => {
  assert.match(source, /normalizeQuickBannerCampaignGateIdentity\(client_request_id, economy_claim_token\)/)
  const claimCall = source.match(/campaignGate\.claim\(\{([^}]+)\}\)/)?.[1] || ''
  assert.match(claimCall, /userId/)
  assert.match(claimCall, /economicIdentity/)
  assert.doesNotMatch(claimCall, /price|amount|cost|smart_tokens/i)
})

test('persistent RPC enforces valid reserved cost, idempotent row lock and private ACL', () => {
  assert.match(migration, /smart_tokens_reserved <> v_request\.smart_tokens_quoted/)
  assert.match(migration, /v_reservation\.status <> 'reserved' OR v_reservation\.amount <> v_request\.smart_tokens_quoted/)
  assert.match(migration, /WHERE user_id = p_user_id[\s\S]*client_request_id = p_client_request_id[\s\S]*FOR UPDATE/)
  assert.match(migration, /campaign_generation_status = 'completed'[\s\S]*FALSE,[\s\S]*campaign_generation_result/)
  assert.match(migration, /REVOKE ALL ON FUNCTION public\.claim_quick_banner_campaign_generation[\s\S]*FROM PUBLIC, anon, authenticated/)
})

test('provider failures cancel the existing prepared delivery and success persists replay result', () => {
  assert.match(source, /campaignGate\.fail\(\{ userId,[\s\S]*reason \}\)/)
  assert.match(source, /campaign_provider_request_failed/)
  assert.match(source, /campaign_provider_http_error/)
  assert.match(source, /campaignGate\.complete\(\{ userId,[\s\S]*status: 200/)
})
