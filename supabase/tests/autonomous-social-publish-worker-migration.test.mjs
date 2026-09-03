import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../migrations/20260901020000_autonomous_social_publish_worker.sql', import.meta.url), 'utf8')
const forwardFix = readFileSync(new URL('../migrations/20260901030000_preserve_instagram_finished_on_commit.sql', import.meta.url), 'utf8')
const stalledPollingFix = readFileSync(new URL('../migrations/20260901040000_resume_stalled_social_polling_early.sql', import.meta.url), 'utf8')

test('scheduler uses Vault and a server-only authorization RPC', () => {
  assert.match(sql, /vault\.create_secret/i)
  assert.match(sql, /authorize_social_publish_worker/i)
  assert.match(sql, /cron\.schedule/i)
  assert.match(sql, /net\.http_post/i)
  assert.doesNotMatch(sql, /service_role[^\n]*eyJ/i)
})

test('worker claims due jobs atomically and skips live claims', () => {
  assert.match(sql, /FOR UPDATE SKIP LOCKED/i)
  assert.match(sql, /claim_expires_at IS NULL OR j\.claim_expires_at <= v_now/i)
  assert.match(sql, /status IN \('queued', 'processing', 'publishing', 'reconciliation_required', 'retry_scheduled'\)/i)
})

test('external mutation has a durable one-way guard', () => {
  assert.match(sql, /external_commit_started_at TIMESTAMPTZ/i)
  assert.match(sql, /j\.external_commit_started_at IS NULL/i)
  assert.match(sql, /complete_autonomous_social_publish_job/i)
  assert.match(sql, /external_commit_started_at IS NOT NULL/i)
})

test('publication remains economically neutral', () => {
  assert.doesNotMatch(sql, /credit_lots|smart_tokens|saldo_creditos|reserve_|consume_/i)
  assert.doesNotMatch(forwardFix, /credit_lots|smart_tokens|saldo_creditos|reserve_|consume_/i)
})

test('Instagram commit preserves FINISHED provider evidence', () => {
  assert.match(forwardFix, /WHEN j\.platform = 'instagram' THEN j\.external_container_status/i)
  assert.match(forwardFix, /j\.external_container_status = 'FINISHED'/i)
  assert.doesNotMatch(forwardFix, /instagram'[\s\S]{0,80}'IN_PROGRESS'/i)
  assert.match(forwardFix, /status = 'published'[\s\S]*external_container_status = 'FINISHED'/i)
})

test('stalled IN_PROGRESS polling resumes early but FINISHED/commit cannot be taken over', () => {
  assert.match(stalledPollingFix, /external_container_status = 'IN_PROGRESS'/i)
  assert.match(stalledPollingFix, /external_commit_started_at IS NULL/i)
  assert.match(stalledPollingFix, /updated_at <= v_now - INTERVAL '2 minutes'/i)
  assert.doesNotMatch(stalledPollingFix, /external_container_status = 'FINISHED'[\s\S]*claim_expires_at > v_now/i)
})
