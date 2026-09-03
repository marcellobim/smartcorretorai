-- Forward-only fix: qualify social_media_leases columns that collide with
-- RETURNS TABLE output names in the three affected social job functions.

CREATE OR REPLACE FUNCTION public.record_social_publish_job_poll_result(
  p_job_id UUID,
  p_claim_token UUID,
  p_expected_status TEXT,
  p_external_container_id TEXT,
  p_external_status TEXT,
  p_next_poll_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(job_id UUID, job_status TEXT, poll_attempt_count INTEGER, next_poll_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_job public.social_publish_jobs%ROWTYPE;
  v_terminal_failure BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_claim_token IS NULL OR p_expected_status IS DISTINCT FROM 'publishing'
     OR p_external_container_id IS NULL
     OR p_external_status IS NULL
     OR p_external_status NOT IN ('IN_PROGRESS', 'FINISHED', 'ERROR', 'EXPIRED')
     OR (p_external_status = 'IN_PROGRESS' AND (p_next_poll_at IS NULL OR p_next_poll_at <= v_now))
     OR (p_external_status <> 'IN_PROGRESS' AND p_next_poll_at IS NOT NULL) THEN
    RAISE EXCEPTION 'invalid_social_publish_poll_result' USING ERRCODE = '22023';
  END IF;

  v_terminal_failure := p_external_status IN ('ERROR', 'EXPIRED');

  UPDATE public.social_publish_jobs AS j
     SET status = CASE WHEN v_terminal_failure THEN 'failed' ELSE j.status END,
         external_container_status = p_external_status,
         poll_attempt_count = j.poll_attempt_count + 1,
         next_poll_at = CASE WHEN p_external_status = 'IN_PROGRESS' THEN p_next_poll_at ELSE NULL END,
         error_code = CASE
           WHEN p_external_status = 'ERROR' THEN 'social_publish_failed'
           WHEN p_external_status = 'EXPIRED' THEN 'external_container_expired'
           ELSE NULL
         END,
         claim_token = CASE WHEN v_terminal_failure THEN NULL ELSE j.claim_token END,
         claimed_at = CASE WHEN v_terminal_failure THEN NULL ELSE j.claimed_at END,
         claim_expires_at = CASE WHEN v_terminal_failure THEN NULL ELSE j.claim_expires_at END,
         updated_at = v_now
   WHERE j.id = p_job_id
     AND j.claim_token = p_claim_token
     AND j.status = p_expected_status
     AND j.claim_expires_at > v_now
     AND j.external_container_id = p_external_container_id
  RETURNING j.* INTO v_job;

  IF FOUND THEN
    IF v_terminal_failure AND v_job.media_lease_id IS NOT NULL
       AND v_job.external_container_status IS DISTINCT FROM 'IN_PROGRESS' THEN
      UPDATE public.social_media_leases AS l
         SET status = 'closed', closed_at = v_now
       WHERE l.id = v_job.media_lease_id AND l.job_id = v_job.id AND l.status = 'active';
    END IF;
    RETURN QUERY SELECT v_job.id, v_job.status, v_job.poll_attempt_count, v_job.next_poll_at;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_social_publish_job_poll_result(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_social_publish_job_poll_result(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;
CREATE OR REPLACE FUNCTION public.transition_claimed_social_publish_job(
  p_job_id UUID,
  p_claim_token UUID,
  p_expected_status TEXT,
  p_next_status TEXT
)
RETURNS TABLE(job_id UUID, job_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_job public.social_publish_jobs%ROWTYPE;
  v_release_claim BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_claim_token IS NULL
     OR p_expected_status IS NULL OR p_next_status IS NULL OR NOT (
    (p_expected_status = 'processing' AND p_next_status IN ('retry_scheduled', 'failed'))
    OR (p_expected_status = 'publishing' AND p_next_status IN ('published', 'reconciliation_required'))
  ) THEN
    RAISE EXCEPTION 'invalid_social_publish_transition' USING ERRCODE = '22023';
  END IF;

  v_release_claim := p_next_status IN (
    'retry_scheduled', 'published', 'reconciliation_required', 'failed'
  );

  UPDATE public.social_publish_jobs AS j
     SET status = p_next_status,
         claim_token = CASE WHEN v_release_claim THEN NULL ELSE j.claim_token END,
         claimed_at = CASE WHEN v_release_claim THEN NULL ELSE j.claimed_at END,
         claim_expires_at = CASE WHEN v_release_claim THEN NULL ELSE j.claim_expires_at END,
         updated_at = v_now
   WHERE j.id = p_job_id
     AND j.claim_token = p_claim_token
     AND j.status = p_expected_status
     AND j.claim_expires_at > v_now
     AND (p_next_status <> 'published' OR j.external_container_status = 'FINISHED')
  RETURNING j.* INTO v_job;

  IF FOUND THEN
    IF p_next_status IN ('published', 'failed') AND v_job.media_lease_id IS NOT NULL
       AND v_job.external_container_status IS DISTINCT FROM 'IN_PROGRESS' THEN
      UPDATE public.social_media_leases AS l
         SET status = 'closed', closed_at = v_now
       WHERE l.id = v_job.media_lease_id AND l.job_id = v_job.id AND l.status = 'active';
    END IF;
    RETURN QUERY SELECT v_job.id, v_job.status;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.transition_claimed_social_publish_job(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_claimed_social_publish_job(UUID, UUID, TEXT, TEXT)
  TO service_role;
CREATE OR REPLACE FUNCTION public.cancel_social_publish_job(
  p_job_id UUID,
  p_expected_status TEXT
)
RETURNS TABLE(job_id UUID, job_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_job public.social_publish_jobs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_expected_status IS NULL
     OR p_expected_status NOT IN ('queued', 'processing') THEN
    RAISE EXCEPTION 'invalid_social_publish_cancellation' USING ERRCODE = '22023';
  END IF;

  UPDATE public.social_publish_jobs AS j
     SET status = 'cancelled',
         claim_token = NULL,
         claimed_at = NULL,
         claim_expires_at = NULL,
         updated_at = v_now
   WHERE j.id = p_job_id
     AND j.user_id = auth.uid()
     AND j.status = p_expected_status
     AND j.external_publish_started_at IS NULL
  RETURNING j.* INTO v_job;

  IF FOUND THEN
    IF v_job.media_lease_id IS NOT NULL THEN
      UPDATE public.social_media_leases AS l
         SET status = 'closed', closed_at = v_now
       WHERE l.id = v_job.media_lease_id AND l.job_id = v_job.id AND l.status = 'active';
    END IF;
    RETURN QUERY SELECT v_job.id, v_job.status;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cancel_social_publish_job(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_social_publish_job(UUID, TEXT)
  TO authenticated;
