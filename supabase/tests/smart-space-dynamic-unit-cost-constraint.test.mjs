import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const migration = readFileSync(
  new URL('../migrations/20260830040000_fix_smart_space_dynamic_unit_cost_constraint.sql', import.meta.url),
  'utf8',
)

const acceptsQuote = ({ imageCount, unitCost, quoted }) =>
  [30, 60].includes(unitCost) && quoted === imageCount * unitCost

test('forward migration removes only the obsolete fixed 30 ST quote constraint', () => {
  assert.match(
    migration,
    /DROP CONSTRAINT virtual_staging_image_requests_check;/,
  )
  assert.match(
    migration,
    /CHECK \(\(smart_tokens_quoted = \(image_count \* 30\)\)\)/,
  )
  assert.doesNotMatch(migration, /DROP (?:TABLE|COLUMN|FUNCTION|INDEX)/i)
  assert.doesNotMatch(migration, /UPDATE|DELETE|INSERT/i)
})

test('migration requires the approved dynamic quote and unit cost constraints', () => {
  assert.match(
    migration,
    /CHECK \(\(smart_tokens_quoted = \(image_count \* unit_cost\)\)\)/,
  )
  assert.match(
    migration,
    /CHECK \(\(unit_cost = ANY \(ARRAY\[\(30\)::bigint, \(60\)::bigint\]\)\)\)/,
  )
})

test('migration aborts for active work, open reservations, or incompatible history', () => {
  assert.match(migration, /status IN \('pending', 'preparing', 'processing'\)/)
  assert.match(migration, /cr\.status IN \('open', 'pending', 'reserved'\)/)
  assert.match(migration, /unit_cost NOT IN \(30, 60\)/)
  assert.match(migration, /smart_tokens_quoted <> image_count \* unit_cost/)
  assert.match(migration, /LOCK TABLE public\.virtual_staging_image_requests IN ACCESS EXCLUSIVE MODE/)
})

test('dynamic rule accepts approved 30/60 ST combinations and preserves 30 ST history', () => {
  for (const example of [
    { imageCount: 1, unitCost: 30, quoted: 30 },
    { imageCount: 1, unitCost: 60, quoted: 60 },
    { imageCount: 5, unitCost: 30, quoted: 150 },
    { imageCount: 5, unitCost: 60, quoted: 300 },
  ]) assert.equal(acceptsQuote(example), true)
})

test('dynamic rule rejects mismatched quotes and unsupported unit costs', () => {
  assert.equal(acceptsQuote({ imageCount: 1, unitCost: 30, quoted: 60 }), false)
  assert.equal(acceptsQuote({ imageCount: 1, unitCost: 60, quoted: 30 }), false)
  assert.equal(acceptsQuote({ imageCount: 5, unitCost: 45, quoted: 225 }), false)
})

test('migration contains no provider, economy mutation, grant, or secret material', () => {
  assert.doesNotMatch(migration, /fetch\(|OpenAI|Creatomate|api[_-]?key|bearer|private[_-]?key/i)
  assert.doesNotMatch(migration, /GRANT|REVOKE|reserve_credits_from_lots|settle_smart_space_request/i)
})
