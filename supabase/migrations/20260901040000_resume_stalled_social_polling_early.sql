-- A live worker updates an IN_PROGRESS job every few seconds. If that heartbeat
-- stops for two minutes and next_poll_at is already due, the scheduler may take
-- over without waiting for the legacy 15-minute claim TTL. FINISHED/commit
-- states are deliberately excluded from early takeover.
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
       AND (
         j.claim_expires_at IS NULL
         OR j.claim_expires_at <= v_now
         OR (
           j.status = 'publishing'
           AND j.external_container_status = 'IN_PROGRESS'
           AND j.external_commit_started_at IS NULL
           AND j.next_poll_at IS NOT NULL
           AND j.next_poll_at <= v_now
           AND j.updated_at <= v_now - INTERVAL '2 minutes'
         )
       )
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
       SET claim_token = gen_random_uuid(), claimed_at = v_now,
           claim_expires_at = v_now + pg_catalog.make_interval(secs => p_claim_ttl_seconds),
           next_poll_at = NULL, updated_at = v_now
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
