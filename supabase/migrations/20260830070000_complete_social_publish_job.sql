-- Completa uma publicacao externa usando o mesmo claim e container ja finalizado.
CREATE OR REPLACE FUNCTION public.complete_social_publish_job(
  p_job_id UUID,
  p_claim_token UUID,
  p_expected_status TEXT,
  p_external_container_id TEXT,
  p_external_post_id TEXT,
  p_external_post_url TEXT DEFAULT NULL
)
RETURNS TABLE(job_id UUID, job_status TEXT, external_post_id TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_job public.social_publish_jobs%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_claim_token IS NULL
     OR p_expected_status IS DISTINCT FROM 'publishing'
     OR p_external_container_id IS NULL
     OR p_external_container_id !~ '^[A-Za-z0-9._:-]{1,200}$'
     OR p_external_post_id IS NULL
     OR p_external_post_id !~ '^[A-Za-z0-9._:-]{1,200}$'
     OR (
       p_external_post_url IS NOT NULL
       AND p_external_post_url !~* '^https://(www\.)?instagram\.com/'
     ) THEN
    RAISE EXCEPTION 'invalid_social_publish_completion' USING ERRCODE = '22023';
  END IF;

  UPDATE public.social_publish_jobs AS j
     SET status = 'published',
         external_post_id = p_external_post_id,
         external_post_url = p_external_post_url,
         next_poll_at = NULL,
         error_code = NULL,
         claim_token = NULL,
         claimed_at = NULL,
         claim_expires_at = NULL,
         updated_at = v_now
   WHERE j.id = p_job_id
     AND j.claim_token = p_claim_token
     AND j.status = p_expected_status
     AND j.claim_expires_at > v_now
     AND j.external_container_id = p_external_container_id
     AND j.external_container_status = 'FINISHED'
  RETURNING j.* INTO v_job;

  IF FOUND THEN
    IF v_job.media_lease_id IS NOT NULL THEN
      UPDATE public.social_media_leases AS l
         SET status = 'closed', closed_at = v_now
       WHERE l.id = v_job.media_lease_id
         AND l.job_id = v_job.id
         AND l.status = 'active';
    END IF;
    RETURN QUERY SELECT v_job.id, v_job.status, v_job.external_post_id;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.complete_social_publish_job(UUID, UUID, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_social_publish_job(UUID, UUID, TEXT, TEXT, TEXT, TEXT)
  TO service_role;
