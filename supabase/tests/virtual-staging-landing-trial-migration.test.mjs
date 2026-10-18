import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../migrations/20261017010000_add_virtual_staging_landing_trial.sql', import.meta.url), 'utf8')

test('Virtual Staging landing trial is one authenticated furnish image and leaves paid access normal', () => {
  assert.match(migration, /CREATE TABLE public\.virtual_staging_trial_uses/)
  assert.match(migration, /p_amount=30[\s\S]*product_code'='virtual_staging'[\s\S]*image_count'='1'[\s\S]*transformation_type'='furnish'/)
  assert.match(migration, /landing_virtual_staging_trial'='true'/)
  assert.match(migration, /NEW\.image_count<>1[\s\S]*NEW\.transformation_type<>'furnish'/)
  assert.match(migration, /ON CONFLICT\(user_id\) DO NOTHING/)
  assert.match(migration, /VIRTUAL_STAGING_TRIAL_ALREADY_USED/)
  assert.match(migration, /IF NOT v_trial_funded THEN RETURN NEW/)
  assert.match(migration, /IF NOT v_landing_trial THEN RAISE EXCEPTION 'TRIAL_PRODUCT_NOT_ALLOWED'/)
  assert.match(migration, /p_landing_trial BOOLEAN/)
  assert.match(migration, /'landing_virtual_staging_trial',p_landing_trial/)
})

test('trial accounting is private and server-only', () => {
  assert.match(migration, /FORCE ROW LEVEL SECURITY/)
  assert.match(migration, /REVOKE ALL ON TABLE public\.virtual_staging_trial_uses FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /GRANT ALL ON TABLE public\.virtual_staging_trial_uses TO service_role/)
  assert.match(migration, /BEFORE UPDATE OF reservation_id,status ON public\.virtual_staging_image_requests/)
})
