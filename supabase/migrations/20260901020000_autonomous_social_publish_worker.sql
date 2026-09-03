-- Autonomous, shared recovery for social publication jobs.
-- Provider mutations are guarded by an atomic, durable commit marker.

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
ALTER TABLE public.social_publish_jobs
  ADD COLUMN IF NOT EXISTS external_commit_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS autonomous_retry_count INTEGER NOT NULL DEFAULT 0
    CHECK (autonomous_retry_count >= 0);
CREATE INDEX IF NOT EXISTS social_publish_jobs_autonomous_due_idx
  ON public.social_publish_jobs(next_poll_at, updated_at)
  WHERE status IN ('queued', 'processing', 'publishing', 'reconciliation_required', 'retry_scheduled');
-- Existing Facebook workers set publishing immediately before their one external POST.
-- Existing ambiguous jobs must therefore be treated as "commit may have happened".
UPDATE public.social_publish_jobs
   SET external_commit_started_at = COALESCE(external_publish_started_at, updated_at)
 WHERE platform = 'facebook'
   AND status IN ('publishing', 'reconciliation_required')
   AND external_commit_started_at IS NULL;
UPDATE public.social_publish_jobs
   SET external_commit_started_at = updated_at
 WHERE platform = 'instagram'
   AND status = 'reconciliation_required'
   AND external_commit_started_at IS NULL;
CREATE OR REPLACE FUNCTION public.mark_social_external_commit_from_legacy_worker()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.external_commit_started_at IS NULL AND (
    (NEW.platform = 'facebook' AND NEW.status = 'publishing' AND NEW.external_publish_started_at IS NOT NULL)
    OR (NEW.status = 'reconciliation_required' AND OLD.status IS DISTINCT FROM 'reconciliation_required')
  ) THEN
    NEW.external_commit_started_at := pg_catalog.clock_timestamp();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS mark_social_external_commit_from_legacy_worker ON public.social_publish_jobs;
CREATE TRIGGER mark_social_external_commit_from_legacy_worker
BEFORE UPDATE OF status, external_publish_started_at ON public.social_publish_jobs
FOR EACH ROW EXECUTE FUNCTION public.mark_social_external_commit_from_legacy_worker();
REVOKE ALL ON FUNCTION public.mark_social_external_commit_from_legacy_worker() FROM PUBLIC, anon, authenticated;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'social_publish_worker_cron_key') THEN
    PERFORM vault.create_secret(
      pg_catalog.encode(extensions.gen_random_bytes(32), 'hex'),
      'social_publish_worker_cron_key',
      'Internal authentication for the autonomous social publication worker'
    );
  END IF;
END;
$$;
CREATE OR REPLACE FUNCTION public.authorize_social_publish_worker(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_key IS NOT NULL
     AND pg_catalog.length(p_key) >= 32
     AND extensions.digest(p_key, 'sha256') = extensions.digest(
       COALESCE((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'social_publish_worker_cron_key' LIMIT 1), ''),
       'sha256'
     );
$$;
REVOKE ALL ON FUNCTION public.authorize_social_publish_worker(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_social_publish_worker(TEXT) TO service_role;
CREATE OR REPLACE FUNCTION public.claim_due_social_publish_jobs(
  p_limit INTEGER DEFAULT 4,
  p_claim_ttl_seconds INTEGER DEFAULT 50
)
RETURNS TABLE(
  job_id UUID,
  worker_claim_token UUID,
  platform TEXT,
  source_type TEXT,
  caption_snapshot TEXT,
  job_status TEXT,
  external_container_id TEXT,
  external_container_status TEXT,
  external_commit_started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_limit NOT BETWEEN 1 AND 10 OR p_claim_ttl_seconds NOT BETWEEN 20 AND 120 THEN
    RAISE EXCEPTION 'invalid_social_worker_claim' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT j.id
      FROM public.social_publish_jobs AS j
     WHERE j.status IN ('queued', 'processing', 'publishing', 'reconciliation_required', 'retry_scheduled')
       AND (j.claim_expires_at IS NULL OR j.claim_expires_at <= v_now)
       AND (j.next_poll_at IS NULL OR j.next_poll_at <= v_now)
       AND (
         j.status IN ('publishing', 'reconciliation_required')
         OR j.updated_at <= v_now - INTERVAL '2 minutes'
       )
     ORDER BY COALESCE(j.next_poll_at, j.updated_at), j.created_at
     FOR UPDATE SKIP LOCKED
     LIMIT p_limit
  ), claimed AS (
    UPDATE public.social_publish_jobs AS j
       SET claim_token = gen_random_uuid(),
           claimed_at = v_now,
           claim_expires_at = v_now + pg_catalog.make_interval(secs => p_claim_ttl_seconds),
           next_poll_at = NULL,
           updated_at = v_now
      FROM candidates AS c
     WHERE j.id = c.id
    RETURNING j.*
  )
  SELECT c.id, c.claim_token, c.platform, c.source_type, COALESCE(c.caption_snapshot, ''),
         c.status, c.external_container_id, c.external_container_status, c.external_commit_started_at
    FROM claimed AS c;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_due_social_publish_jobs(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_social_publish_jobs(INTEGER, INTEGER) TO service_role;
CREATE OR REPLACE FUNCTION public.record_autonomous_social_container_status(
  p_job_id UUID,
  p_claim_token UUID,
  p_external_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
DECLARE v_terminal BOOLEAN := p_external_status IN ('ERROR', 'EXPIRED');
DECLARE v_changed UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_external_status NOT IN ('IN_PROGRESS', 'FINISHED', 'ERROR', 'EXPIRED') THEN
    RAISE EXCEPTION 'invalid_external_status' USING ERRCODE = '22023';
  END IF;

  UPDATE public.social_publish_jobs AS j
     SET external_container_status = p_external_status,
         poll_attempt_count = j.poll_attempt_count + 1,
         autonomous_retry_count = j.autonomous_retry_count + 1,
         status = CASE WHEN v_terminal THEN 'failed' ELSE j.status END,
         error_code = CASE WHEN p_external_status = 'ERROR' THEN 'social_publish_failed'
                           WHEN p_external_status = 'EXPIRED' THEN 'external_container_expired'
                           ELSE NULL END,
         next_poll_at = CASE WHEN p_external_status = 'IN_PROGRESS' THEN v_now + INTERVAL '1 minute' ELSE NULL END,
         claim_token = CASE WHEN p_external_status = 'FINISHED' THEN j.claim_token ELSE NULL END,
         claimed_at = CASE WHEN p_external_status = 'FINISHED' THEN j.claimed_at ELSE NULL END,
         claim_expires_at = CASE WHEN p_external_status = 'FINISHED' THEN j.claim_expires_at ELSE NULL END,
         updated_at = v_now
   WHERE j.id = p_job_id
     AND j.claim_token = p_claim_token
     AND j.status = 'publishing'
     AND j.claim_expires_at > v_now
     AND j.external_container_id IS NOT NULL
  RETURNING j.id INTO v_changed;

  IF v_terminal AND v_changed IS NOT NULL THEN
    UPDATE public.social_media_leases AS l
       SET status = 'closed', closed_at = v_now
      FROM public.social_publish_jobs AS j
     WHERE j.id = v_changed AND l.id = j.media_lease_id AND l.job_id = j.id AND l.status = 'active';
  END IF;
  RETURN v_changed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.record_autonomous_social_container_status(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_autonomous_social_container_status(UUID, UUID, TEXT) TO service_role;
CREATE OR REPLACE FUNCTION public.begin_autonomous_social_publish(
  p_job_id UUID,
  p_claim_token UUID,
  p_external_container_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
DECLARE v_changed UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.social_publish_jobs AS j
     SET status = 'publishing',
         external_publish_started_at = COALESCE(j.external_publish_started_at, v_now),
         external_commit_started_at = v_now,
         external_container_id = COALESCE(p_external_container_id, j.external_container_id),
         external_container_status = CASE WHEN p_external_container_id IS NOT NULL THEN 'IN_PROGRESS' ELSE j.external_container_status END,
         updated_at = v_now
   WHERE j.id = p_job_id
     AND j.claim_token = p_claim_token
     AND j.claim_expires_at > v_now
     AND j.external_commit_started_at IS NULL
     AND (
       (j.platform = 'facebook' AND j.status IN ('queued', 'processing', 'retry_scheduled') AND p_external_container_id IS NULL)
       OR
       (j.platform = 'instagram' AND j.status = 'publishing' AND j.external_container_status = 'FINISHED'
         AND j.external_container_id = p_external_container_id)
     )
  RETURNING j.id INTO v_changed;
  RETURN v_changed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_autonomous_social_publish(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_autonomous_social_publish(UUID, UUID, TEXT) TO service_role;
CREATE OR REPLACE FUNCTION public.start_autonomous_instagram_container(
  p_job_id UUID,
  p_claim_token UUID,
  p_external_container_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
DECLARE v_changed UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  IF p_external_container_id !~ '^[A-Za-z0-9._:-]{1,200}$' THEN RAISE EXCEPTION 'invalid_container' USING ERRCODE = '22023'; END IF;
  UPDATE public.social_publish_jobs AS j
     SET status = 'publishing', external_publish_started_at = v_now,
         external_container_id = p_external_container_id, external_container_status = 'IN_PROGRESS',
         next_poll_at = v_now + INTERVAL '1 minute', claim_token = NULL, claimed_at = NULL,
         claim_expires_at = NULL, updated_at = v_now
   WHERE j.id = p_job_id AND j.claim_token = p_claim_token AND j.claim_expires_at > v_now
     AND j.platform = 'instagram' AND j.status IN ('queued', 'processing', 'retry_scheduled')
     AND j.external_container_id IS NULL AND j.external_commit_started_at IS NULL
  RETURNING j.id INTO v_changed;
  RETURN v_changed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.start_autonomous_instagram_container(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_autonomous_instagram_container(UUID, UUID, TEXT) TO service_role;
CREATE OR REPLACE FUNCTION public.defer_autonomous_social_publish_job(
  p_job_id UUID,
  p_claim_token UUID,
  p_reconciliation_required BOOLEAN DEFAULT TRUE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
DECLARE v_changed UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.social_publish_jobs AS j
     SET status = CASE WHEN p_reconciliation_required THEN 'reconciliation_required' ELSE j.status END,
         next_poll_at = v_now + INTERVAL '1 minute', claim_token = NULL, claimed_at = NULL,
         claim_expires_at = NULL, autonomous_retry_count = j.autonomous_retry_count + 1, updated_at = v_now
   WHERE j.id = p_job_id AND j.claim_token = p_claim_token AND j.claim_expires_at > v_now
     AND j.status IN ('queued', 'processing', 'publishing', 'reconciliation_required', 'retry_scheduled')
  RETURNING j.id INTO v_changed;
  RETURN v_changed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.defer_autonomous_social_publish_job(UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.defer_autonomous_social_publish_job(UUID, UUID, BOOLEAN) TO service_role;
CREATE OR REPLACE FUNCTION public.complete_autonomous_social_publish_job(
  p_job_id UUID,
  p_claim_token UUID,
  p_external_post_id TEXT,
  p_external_post_url TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
DECLARE v_changed UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.social_publish_jobs AS j
     SET status = 'published', external_post_id = p_external_post_id,
         external_post_url = p_external_post_url, error_code = NULL, next_poll_at = NULL,
         claim_token = NULL, claimed_at = NULL, claim_expires_at = NULL, updated_at = v_now
   WHERE j.id = p_job_id AND j.claim_token = p_claim_token AND j.claim_expires_at > v_now
     AND j.status IN ('publishing', 'reconciliation_required')
     AND j.external_commit_started_at IS NOT NULL
  RETURNING j.id INTO v_changed;
  IF v_changed IS NOT NULL THEN
    UPDATE public.social_media_leases AS l SET status = 'closed', closed_at = v_now
      FROM public.social_publish_jobs AS j
     WHERE j.id = v_changed AND l.id = j.media_lease_id AND l.job_id = j.id AND l.status = 'active';
  END IF;
  RETURN v_changed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_autonomous_social_publish_job(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_autonomous_social_publish_job(UUID, UUID, TEXT, TEXT) TO service_role;
CREATE OR REPLACE FUNCTION public.fail_autonomous_social_publish_job(
  p_job_id UUID,
  p_claim_token UUID,
  p_error_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
DECLARE v_changed UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.social_publish_jobs AS j
     SET status = 'failed', error_code = CASE WHEN p_error_code IN ('social_account_not_connected', 'social_reconnect_required', 'invalid_media_source', 'external_container_expired') THEN p_error_code ELSE 'social_publish_failed' END,
         next_poll_at = NULL, claim_token = NULL, claimed_at = NULL, claim_expires_at = NULL, updated_at = v_now
   WHERE j.id = p_job_id AND j.claim_token = p_claim_token AND j.claim_expires_at > v_now
     AND j.status IN ('queued', 'processing', 'publishing', 'reconciliation_required', 'retry_scheduled')
  RETURNING j.id INTO v_changed;
  IF v_changed IS NOT NULL THEN
    UPDATE public.social_media_leases AS l SET status = 'closed', closed_at = v_now
      FROM public.social_publish_jobs AS j
     WHERE j.id = v_changed AND l.id = j.media_lease_id AND l.job_id = j.id AND l.status = 'active'
       AND j.external_container_status IS DISTINCT FROM 'IN_PROGRESS';
  END IF;
  RETURN v_changed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.fail_autonomous_social_publish_job(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fail_autonomous_social_publish_job(UUID, UUID, TEXT) TO service_role;
DO $$
DECLARE v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'autonomous-social-publish-worker';
  IF v_job_id IS NOT NULL THEN PERFORM cron.unschedule(v_job_id); END IF;
  PERFORM cron.schedule(
    'autonomous-social-publish-worker',
    '* * * * *',
    $cron$
      SELECT net.http_post(
        url := 'https://sfbowejaevlmhcvsxhbk.supabase.co/functions/v1/social-publish-worker',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-social-worker-key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'social_publish_worker_cron_key' LIMIT 1)
        ),
        body := '{"source":"cron"}'::jsonb,
        timeout_milliseconds := 50000
      );
    $cron$
  );
END;
$$;
