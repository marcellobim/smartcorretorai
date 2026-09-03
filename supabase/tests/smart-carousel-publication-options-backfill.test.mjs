import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(new URL('../migrations/20260901070000_backfill_smart_carousel_publication_options.sql', import.meta.url), 'utf8')
const edge = readFileSync(new URL('../functions/smart-carousel-creatomate/index.ts', import.meta.url), 'utf8')

test('legacy successful carousel deliveries receive three immutable publication options', () => {
  assert.match(migration, /UPDATE public\.smart_carousel_economy_requests/)
  assert.match(migration, /request\.status = 'succeeded'/)
  assert.match(migration, /jsonb_array_length\(request\.campaign_package->'campaigns'\) = 3/)
  assert.match(migration, /studio-caption-option-/)
  assert.doesNotMatch(migration, /smart_tokens_|credit_|reservation_/)
})

test('latest discovery is owner scoped and read-only', () => {
  assert.match(edge, /async function handleDiscoverLatest/)
  assert.match(edge, /\.eq\('user_id', userId\)/)
  assert.match(edge, /\.eq\('status', 'succeeded'\)/)
  assert.match(edge, /action === 'discover_latest'/)
})
