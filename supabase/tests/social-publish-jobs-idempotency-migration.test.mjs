import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(
  new URL('../migrations/20260830050000_create_social_publish_jobs_idempotency.sql', import.meta.url),
  'utf8',
)
const concurrency = readFileSync(
  new URL('./social-publish-jobs-idempotency.postgres.sql', import.meta.url),
  'utf8',
)
const claimConcurrency = readFileSync(
  new URL('./social-publish-jobs-claim.postgres.sql', import.meta.url),
  'utf8',
)
const recovery = readFileSync(
  new URL('./social-publish-jobs-recovery.postgres.sql', import.meta.url),
  'utf8',
)
const captionCancel = readFileSync(
  new URL('./social-publish-jobs-caption-cancel.postgres.sql', import.meta.url),
  'utf8',
)
const pollingRuntime = readFileSync(
  new URL('../functions/_shared/social-publish-jobs/polling.mjs', import.meta.url),
  'utf8',
)
const pollingTests = readFileSync(
  new URL('../functions/_shared/social-publish-jobs/polling.test.mjs', import.meta.url),
  'utf8',
)
const mediaLeaseRuntime = readFileSync(
  new URL('../functions/_shared/social-publish-jobs/media-leases.mjs', import.meta.url),
  'utf8',
)
const mediaLeaseTests = readFileSync(
  new URL('../functions/_shared/social-publish-jobs/media-leases.test.mjs', import.meta.url),
  'utf8',
)
const tokenLifecycleRuntime = readFileSync(
  new URL('../functions/_shared/social-publish-jobs/meta-token-lifecycle.mjs', import.meta.url),
  'utf8',
)
const tokenLifecycleTests = readFileSync(
  new URL('../functions/_shared/social-publish-jobs/meta-token-lifecycle.test.mjs', import.meta.url),
  'utf8',
)

test('scopes idempotency to user and key', () => {
  assert.match(
    migration,
    /CONSTRAINT social_publish_jobs_user_idempotency_unique UNIQUE \(user_id, idempotency_key\)/,
  )
})

test('create or reuse is one atomic insert followed by reading the winner', () => {
  assert.match(migration, /ON CONFLICT \(user_id, idempotency_key\) DO NOTHING/)
  assert.match(migration, /RETURNING \* INTO v_job/)
  assert.match(
    migration,
    /WHERE j\.user_id = p_user_id\s+AND j\.idempotency_key = p_idempotency_key/,
  )
  assert.match(migration, /RETURN QUERY SELECT v_job\.id, v_job\.status, TRUE/)
})

test('a reused key cannot silently change publication intent', () => {
  for (const field of ['social_connection_id', 'platform', 'source_type', 'source_id', 'caption_snapshot']) {
    assert.match(migration, new RegExp(`v_job\\.${field} IS DISTINCT FROM`))
  }
  assert.match(migration, /idempotency_key_intent_mismatch/)
})

test('browser roles cannot create jobs directly or call the create/reuse function', () => {
  assert.match(migration, /ENABLE ROW LEVEL SECURITY/)
  assert.match(migration, /REVOKE ALL ON TABLE public\.social_publish_jobs FROM PUBLIC, anon, authenticated/)
  assert.match(migration, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(
    migration,
    /REVOKE EXECUTE ON FUNCTION public\.create_or_reuse_social_publish_job[\s\S]*FROM PUBLIC, anon, authenticated/,
  )
})

test('postgres concurrency test launches two simultaneous creates and requires one job id', () => {
  assert.equal((concurrency.match(/dblink_send_query\(/g) || []).length, 2)
  assert.match(
    concurrency,
    /count\(DISTINCT job_id\)[\s\S]*<> 1[\s\S]*concurrent creates returned different jobs/,
  )
  assert.match(
    concurrency,
    /idempotency_key = '30000000-0000-4000-8000-000000000090'[\s\S]*\) <> 1[\s\S]*concurrent creates inserted duplicate jobs/,
  )
})

test('claim contract stores a complete bounded lease', () => {
  assert.match(migration, /claim_token UUID/)
  assert.match(migration, /claimed_at TIMESTAMPTZ/)
  assert.match(migration, /claim_expires_at TIMESTAMPTZ/)
  assert.match(migration, /p_claim_ttl_seconds IS NULL[\s\S]*p_claim_ttl_seconds NOT BETWEEN 30 AND 900/)
  assert.match(migration, /claim_expires_at > claimed_at/)
})

test('claim is a single conditional update and only expired processing claims recover', () => {
  const start = migration.indexOf('FUNCTION public.claim_social_publish_job')
  const end = migration.indexOf('$$;', start)
  const claim = migration.slice(start, end)
  assert.match(claim, /UPDATE public\.social_publish_jobs AS j/)
  assert.match(claim, /j\.status IN \('queued', 'retry_scheduled'\)/)
  assert.match(claim, /j\.status = 'processing'[\s\S]*j\.claim_expires_at <= v_now/)
  assert.match(claim, /claim_token = pg_catalog\.gen_random_uuid\(\)/)
})

test('worker transition requires job, token, expected state and an active lease', () => {
  const start = migration.indexOf('FUNCTION public.transition_claimed_social_publish_job')
  const end = migration.indexOf('$$;', start)
  const transition = migration.slice(start, end)
  assert.match(transition, /p_job_id UUID[\s\S]*p_claim_token UUID[\s\S]*p_expected_status TEXT/)
  assert.match(transition, /j\.id = p_job_id/)
  assert.match(transition, /j\.claim_token = p_claim_token/)
  assert.match(transition, /j\.status = p_expected_status/)
  assert.match(transition, /j\.claim_expires_at > v_now/)
})

test('postgres claim suite covers concurrency, active and expired leases, token and state guards', () => {
  assert.equal((claimConcurrency.match(/dblink_send_query\(/g) || []).length, 2)
  for (const message of [
    'exactly one concurrent claim must win',
    'active claim was stolen',
    'expired claim reused its old token',
    'wrong token changed job state',
    'unexpected source state changed job state',
  ]) {
    assert.match(claimConcurrency, new RegExp(message))
  }
})

test('recovery accepts only job id and derives ownership from auth uid', () => {
  assert.match(migration, /FUNCTION public\.get_social_publish_job_recovery\(p_job_id UUID\)/)
  assert.doesNotMatch(migration, /get_social_publish_job_recovery\([^)]*user_id/i)
  const start = migration.indexOf('FUNCTION public.get_social_publish_job_recovery')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.match(section, /j\.user_id = auth\.uid\(\)/)
  assert.match(section, /LANGUAGE sql[\s\S]*STABLE[\s\S]*SECURITY DEFINER/)
  assert.doesNotMatch(section, /\b(?:INSERT|UPDATE|DELETE)\b/i)
})

test('recovery returns only the explicit safe projection', () => {
  const start = migration.indexOf('FUNCTION public.get_social_publish_job_recovery')
  const end = migration.indexOf('LANGUAGE sql', start)
  const output = migration.slice(start, end)
  for (const field of [
    'public_status', 'destination', 'social_account', 'source_type', 'source_id',
    'caption_snapshot', 'created_at', 'updated_at', 'external_post_id', 'external_post_link', 'public_error_code',
  ]) {
    assert.match(output, new RegExp(`\\b${field}\\b`))
  }
  for (const blocked of [
    'user_id', 'access_token', 'page_access_token', 'ciphertext', 'claim_token', 'signed_url', 'secret',
    'external_container_id', 'external_container_status', 'poll_attempt_count', 'next_poll_at',
    'media_lease_id', 'opaque_token_hash', 'object_path',
  ]) {
    assert.doesNotMatch(output, new RegExp(`\\b${blocked}\\b`, 'i'))
  }
})

test('recovery sanitizes internal states, links and error codes', () => {
  const start = migration.indexOf('FUNCTION public.get_social_publish_job_recovery')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.match(section, /'processing', 'publishing', 'reconciliation_required'[\s\S]*THEN 'processing'/)
  assert.match(section, /j\.status = 'published'[\s\S]*j\.external_post_id/)
  assert.match(section, /ELSE 'social_publish_failed'/)
  assert.match(migration, /external_post_url ~\* '\^https:\/\//)
})

test('postgres recovery suite covers owner, isolation, states, missing job and side effects', () => {
  for (const message of [
    'owner recovery returned wrong destination or account',
    'non-owner read another user job',
    'missing job returned recovery data',
    'published recovery contract mismatch',
    'failed recovery leaked or mapped unsafe data',
    'processing recovery contract mismatch',
    'recovery caused a job side effect',
  ]) {
    assert.match(recovery, new RegExp(message))
  }
})

test('caption is persisted exactly once as an immutable snapshot', () => {
  assert.match(migration, /caption_snapshot TEXT CHECK/)
  assert.match(migration, /v_caption_snapshot TEXT := p_caption/)
  assert.match(migration, /source_type, source_id, caption_snapshot, status/)
  assert.match(migration, /v_job\.caption_snapshot IS DISTINCT FROM v_caption_snapshot/)
  assert.doesNotMatch(migration, /btrim\(p_caption\)/)
  assert.match(migration, /BEFORE UPDATE OF caption_snapshot ON public\.social_publish_jobs/)
  assert.match(migration, /caption_snapshot_immutable/)
})

test('recovery returns the stored caption snapshot without reading the source product', () => {
  const start = migration.indexOf('FUNCTION public.get_social_publish_job_recovery')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.match(section, /j\.caption_snapshot/)
  assert.doesNotMatch(section, /hero_generations|properties|campaigns/i)
})

test('owner cancellation is atomic and limited to pre-irreversible states', () => {
  const start = migration.indexOf('FUNCTION public.cancel_social_publish_job')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.match(section, /p_expected_status IS NULL[\s\S]*p_expected_status NOT IN \('queued', 'processing'\)/)
  assert.match(section, /j\.user_id = auth\.uid\(\)/)
  assert.match(section, /j\.status = p_expected_status/)
  assert.match(section, /j\.external_publish_started_at IS NULL/)
  assert.match(section, /SET status = 'cancelled'/)
  assert.doesNotMatch(section, /\bDELETE\b/i)
})

test('container polling start marks irreversible publication and cannot replace its container', () => {
  const start = migration.indexOf('FUNCTION public.start_social_publish_job_container_polling')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.match(section, /SET status = 'publishing'[\s\S]*external_publish_started_at = v_now/)
  assert.match(section, /j\.external_container_id IS NULL/)
  assert.match(migration, /external_container_id_immutable/)
  assert.match(migration, /status NOT IN \('publishing', 'published', 'reconciliation_required'\)[\s\S]*external_publish_started_at IS NOT NULL/)
})

test('postgres caption and cancellation suite covers all requested cases', () => {
  for (const message of [
    'caption snapshot mutation was accepted',
    'caption snapshot was not preserved exactly',
    'source text mutation changed caption snapshot',
    'queued cancellation failed',
    'safe processing cancellation failed',
    'irreversible publishing cancellation was accepted',
    'published cancellation was accepted',
    'non-owner cancelled another user job',
  ]) {
    assert.match(captionCancel, new RegExp(message))
  }
})

test('polling persists normalized state, attempt count and next schedule for the same container', () => {
  for (const field of ['external_container_id', 'external_container_status', 'poll_attempt_count', 'next_poll_at']) {
    assert.match(migration, new RegExp(`\\b${field}\\b`))
  }
  const start = migration.indexOf('FUNCTION public.record_social_publish_job_poll_result')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.match(section, /'IN_PROGRESS', 'FINISHED', 'ERROR', 'EXPIRED'/)
  assert.match(section, /poll_attempt_count = j\.poll_attempt_count \+ 1/)
  assert.match(section, /j\.external_container_id = p_external_container_id/)
})

test('timeout only defers polling of the persisted container', () => {
  const start = migration.indexOf('FUNCTION public.defer_social_publish_job_poll_timeout')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.match(section, /poll_attempt_count = j\.poll_attempt_count \+ 1/)
  assert.match(section, /next_poll_at = p_next_poll_at/)
  assert.match(section, /j\.external_container_id = p_external_container_id/)
  assert.doesNotMatch(section, /\bINSERT\b/i)
})

test('database cannot reach published before external FINISHED', () => {
  const start = migration.indexOf('FUNCTION public.transition_claimed_social_publish_job')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.match(section, /p_next_status <> 'published' OR j\.external_container_status = 'FINISHED'/)
})

test('polling runtime has no create or publish dependency and fixtures cover all outcomes', () => {
  assert.doesNotMatch(pollingRuntime, /createExternalContainer|media_publish|publishContainer/)
  assert.match(pollingRuntime, /externalStatus === 'FINISHED'/)
  assert.match(pollingRuntime, /mediaPublishAllowed: true/)
  for (const title of [
    'IN_PROGRESS', 'FINISHED', 'ERROR', 'EXPIRED', 'ambiguous timeout',
    'existing container', 'never duplicates', 'no state except FINISHED',
  ]) {
    assert.match(pollingTests, new RegExp(title, 'i'))
  }
})

test('browser recovery remains read-only and never triggers external polling', () => {
  const start = migration.indexOf('FUNCTION public.get_social_publish_job_recovery')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.doesNotMatch(section, /record_social_publish_job_poll_result|defer_social_publish_job_poll_timeout|external_container_id|social_media_lease/)
  assert.doesNotMatch(section, /\b(?:INSERT|UPDATE|DELETE)\b/i)
})

test('media lease is private, opaque, job-object scoped and capped at 24 hours', () => {
  assert.match(migration, /CREATE TABLE public\.social_media_leases/)
  assert.match(migration, /UNIQUE \(job_id, bucket_id, object_path\)/)
  assert.match(migration, /opaque_token_hash TEXT NOT NULL UNIQUE/)
  assert.match(migration, /expires_at <= created_at \+ INTERVAL '24 hours'/)
  assert.match(migration, /REVOKE ALL ON TABLE public\.social_media_leases FROM PUBLIC, anon, authenticated/)
})

test('lease creation derives owner from job and requires a private bucket', () => {
  const start = migration.indexOf('FUNCTION public.create_or_reuse_social_media_lease')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.doesNotMatch(section, /p_user_id/)
  assert.match(section, /p_object_path NOT LIKE v_job\.user_id::TEXT \|\| '\/%'/)
  assert.match(section, /storage\.buckets[\s\S]*b\.public IS FALSE/)
  assert.match(section, /p_ttl_seconds NOT BETWEEN 60 AND 86400/)
})

test('external start requires an active lease with enough remaining lifetime', () => {
  const start = migration.indexOf('FUNCTION public.start_social_publish_job_container_polling')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.match(section, /l\.status = 'active'/)
  assert.match(section, /l\.expires_at >= v_now \+ pg_catalog\.make_interval/)
  assert.match(section, /media_lease_id = p_media_lease_id/)
})

test('database closure blocks IN_PROGRESS and permits safe terminal closure', () => {
  const start = migration.indexOf('FUNCTION public.close_social_media_lease_if_safe')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.match(section, /j\.status IN \('published', 'failed', 'cancelled'\)/)
  assert.match(section, /j\.external_container_status IS DISTINCT FROM 'IN_PROGRESS'/)
  assert.match(section, /SET status = 'closed'/)
  assert.match(migration, /p_next_status IN \('published', 'failed'\)[\s\S]*UPDATE public\.social_media_leases[\s\S]*SET status = 'closed'/)
  assert.match(migration, /v_terminal_failure[\s\S]*UPDATE public\.social_media_leases[\s\S]*SET status = 'closed'/)
})

test('lease runtime exposes only GET and HEAD and has no listing or public-bucket capability', () => {
  assert.match(mediaLeaseRuntime, /new Set\(\['GET', 'HEAD'\]\)/)
  assert.match(mediaLeaseRuntime, /'Content-Type': lease\.contentType/)
  assert.match(mediaLeaseRuntime, /'Content-Length': String\(lease\.contentLength\)/)
  assert.doesNotMatch(mediaLeaseRuntime, /listObjects|makePublic|graph\.facebook|media_publish/i)
})

test('media lease fixtures cover all twelve retention and access cases', () => {
  for (const title of [
    'valid lease creation', 'another user', 'different object', 'expired lease', 'revoked lease',
    'GET returns', 'HEAD returns', 'methods other than GET and HEAD', 'IN_PROGRESS prevents',
    'published permits', 'lacks the required remaining window', 'no permanent-public',
  ]) {
    assert.match(mediaLeaseTests, new RegExp(title, 'i'))
  }
})

test('social connection lifecycle persists encrypted state and validation timestamps', () => {
  for (const field of [
    'access_token_ciphertext', 'access_token_nonce', 'access_token_auth_tag',
    'page_access_token_ciphertext', 'page_access_token_nonce', 'page_access_token_auth_tag',
    'key_version', 'expires_at', 'last_validated_at', 'connection_status',
  ]) {
    assert.match(migration, new RegExp(`\\b${field}\\b`))
  }
  assert.match(migration, /connection_status IN \('active', 'expired', 'revoked', 'reconnect_required'\)/)
  assert.match(migration, /connection_status = 'active'[\s\S]*page_access_token_ciphertext IS NOT NULL/)
  assert.match(migration, /access_token IS NULL[\s\S]*page_access_token IS NULL/)
})

test('pre-publication validation invalidates unusable ciphertext and is service-only', () => {
  const start = migration.indexOf('FUNCTION public.record_social_connection_validation')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.match(section, /last_validated_at = v_now/)
  assert.match(section, /CASE WHEN p_validation_status = 'active' THEN page_access_token_ciphertext ELSE NULL END/)
  assert.match(section, /auth\.role\(\) IS DISTINCT FROM 'service_role'/)
  assert.match(tokenLifecycleRuntime, /validateRemoteToken\(token\)[\s\S]*persistValidation[\s\S]*runValidatedOperation/)
})

test('disconnect is owner-isolated, local-first and preserves connection history', () => {
  const start = migration.indexOf('FUNCTION public.disconnect_social_connection')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.match(section, /sc\.user_id = auth\.uid\(\)/)
  assert.match(section, /connection_status = 'revoked'/)
  assert.match(section, /access_token_ciphertext = NULL[\s\S]*page_access_token_ciphertext = NULL/)
  assert.doesNotMatch(section, /DELETE FROM public\.social_connections/i)
  assert.match(tokenLifecycleRuntime, /blockLocallyAndInvalidate[\s\S]*revokeRemoteToken/)
})

test('disconnect cancels only reversible jobs and revokes only safe leases', () => {
  const start = migration.indexOf('FUNCTION public.disconnect_social_connection')
  const end = migration.indexOf('$$;', start)
  const section = migration.slice(start, end)
  assert.match(section, /j\.status IN \('queued', 'processing'\)/)
  assert.match(section, /j\.external_publish_started_at IS NULL/)
  assert.match(section, /j\.external_container_status IS DISTINCT FROM 'IN_PROGRESS'/)
  assert.match(section, /SET status = 'revoked', revoked_at = v_now/)
})

test('mocked lifecycle suite covers all requested token and disconnect cases without logging secrets', () => {
  assert.doesNotMatch(tokenLifecycleRuntime, /graph\.facebook|fetch\(|console\./i)
  for (const title of [
    'active token', 'expired token', 'revoked connection', 'reconnect_required',
    'validation is persisted before', 'normal disconnect', 'remote revocation failure',
    'jobs and safely revoked leases', 'cannot be reused after disconnect', 'owner isolation',
  ]) {
    assert.match(tokenLifecycleTests, new RegExp(title, 'i'))
  }
})
