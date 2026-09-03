-- Safely resumes a social job that failed before any irreversible external action.
-- Reuses the same job and its existing owner-scoped media lease.
CREATE OR REPLACE FUNCTION public.requeue_unstarted_social_publish_job(
  p_job_id UUID,
  p_expected_error_code TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_job public.social_publish_jobs%ROWTYPE;
  v_lease public.social_media_leases%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_job_id IS NULL OR p_expected_error_code NOT IN ('invalid_media_source', 'social_publish_failed', 'worker_unavailable') THEN
    RAISE EXCEPTION 'invalid_social_requeue_request' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO STRICT v_job
    FROM public.social_publish_jobs AS job
   WHERE job.id = p_job_id
   FOR UPDATE;

  IF v_job.status <> 'failed'
     OR v_job.error_code IS DISTINCT FROM p_expected_error_code
     OR v_job.external_publish_started_at IS NOT NULL
     OR v_job.external_commit_started_at IS NOT NULL
     OR v_job.external_container_id IS NOT NULL
     OR v_job.external_post_id IS NOT NULL THEN
    RETURN FALSE;
  END IF;

  SELECT * INTO STRICT v_lease
    FROM public.social_media_leases AS lease
   WHERE lease.job_id = v_job.id
     AND lease.user_id = v_job.user_id
     AND lease.status = 'active'
     AND lease.expires_at > v_now + INTERVAL '1 hour'
   ORDER BY lease.created_at DESC
   LIMIT 1
   FOR UPDATE;

  IF v_lease.content_type NOT IN ('image/jpeg', 'image/png', 'video/mp4')
     OR v_lease.content_length <= 0
     OR v_lease.object_path NOT LIKE v_job.user_id::TEXT || '/%' THEN
    RETURN FALSE;
  END IF;

  UPDATE public.social_publish_jobs AS job
     SET status = 'retry_scheduled',
         media_lease_id = v_lease.id,
         error_code = NULL,
         claim_token = NULL,
         claimed_at = NULL,
         claim_expires_at = NULL,
         next_poll_at = v_now + INTERVAL '1 minute',
         updated_at = v_now
   WHERE job.id = v_job.id;
  RETURN TRUE;
EXCEPTION
  WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
    RETURN FALSE;
END;
$$;
REVOKE ALL ON FUNCTION public.requeue_unstarted_social_publish_job(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.requeue_unstarted_social_publish_job(UUID, TEXT)
  TO service_role;
