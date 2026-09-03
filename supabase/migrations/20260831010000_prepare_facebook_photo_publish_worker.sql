-- Forward-only support for direct Facebook Page photo publishing.
-- This migration does not publish content and does not call Meta.

ALTER TABLE public.social_publish_jobs
  ADD COLUMN IF NOT EXISTS social_account_id UUID;
ALTER TABLE public.social_accounts
  ADD CONSTRAINT social_accounts_id_owner_connection_key
    UNIQUE (id, user_id, social_connection_id);
ALTER TABLE public.social_publish_jobs
  ADD CONSTRAINT social_publish_jobs_account_owner_connection_fk
    FOREIGN KEY (social_account_id, user_id, social_connection_id)
    REFERENCES public.social_accounts(id, user_id, social_connection_id)
    ON DELETE RESTRICT;
CREATE INDEX IF NOT EXISTS social_publish_jobs_account_created_idx
  ON public.social_publish_jobs(social_account_id, created_at DESC)
  WHERE social_account_id IS NOT NULL;
ALTER TABLE public.social_publish_jobs
  DROP CONSTRAINT IF EXISTS social_publish_jobs_container_state_consistent;
ALTER TABLE public.social_publish_jobs
  ADD CONSTRAINT social_publish_jobs_container_state_consistent CHECK (
    (external_container_status IS NULL OR external_container_id IS NOT NULL)
    AND (
      status NOT IN ('publishing', 'published')
      OR platform = 'facebook'
      OR external_container_id IS NOT NULL
    )
  );
CREATE OR REPLACE FUNCTION public.create_or_reuse_social_publish_job(
  p_user_id UUID,
  p_social_connection_id UUID,
  p_platform TEXT,
  p_idempotency_key UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_caption TEXT DEFAULT NULL
)
RETURNS TABLE(job_id UUID, job_status TEXT, reused BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.social_publish_jobs%ROWTYPE;
  v_platform TEXT := pg_catalog.lower(pg_catalog.btrim(p_platform));
  v_source_type TEXT := pg_catalog.btrim(p_source_type);
  v_caption_snapshot TEXT := p_caption;
  v_account_ids UUID[];
  v_social_account_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_social_connection_id IS NULL OR p_idempotency_key IS NULL
     OR p_source_id IS NULL OR v_platform NOT IN ('instagram', 'facebook')
     OR NULLIF(v_source_type, '') IS NULL
     OR pg_catalog.length(v_caption_snapshot) > 2200 THEN
    RAISE EXCEPTION 'invalid_social_publish_job' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.social_connections AS sc
     WHERE sc.id = p_social_connection_id
       AND sc.user_id = p_user_id
       AND sc.provider = 'meta'
       AND sc.connection_status = 'active'
  ) THEN
    RAISE EXCEPTION 'invalid_social_connection' USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.array_agg(a.id ORDER BY a.id)
    INTO v_account_ids
    FROM public.social_accounts AS a
   WHERE a.user_id = p_user_id
     AND a.social_connection_id = p_social_connection_id
     AND a.provider = 'meta'
     AND a.platform = v_platform
     AND a.account_status = 'active';

  IF pg_catalog.array_length(v_account_ids, 1) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'social_account_selection_required' USING ERRCODE = '22023';
  END IF;
  v_social_account_id := v_account_ids[1];

  INSERT INTO public.social_publish_jobs (
    user_id, social_connection_id, social_account_id, platform, idempotency_key,
    source_type, source_id, caption_snapshot, status
  ) VALUES (
    p_user_id, p_social_connection_id, v_social_account_id, v_platform, p_idempotency_key,
    v_source_type, p_source_id, v_caption_snapshot, 'queued'
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING * INTO v_job;

  IF FOUND THEN
    RETURN QUERY SELECT v_job.id, v_job.status, FALSE;
    RETURN;
  END IF;

  SELECT j.* INTO STRICT v_job
    FROM public.social_publish_jobs AS j
   WHERE j.user_id = p_user_id
     AND j.idempotency_key = p_idempotency_key;

  IF v_job.social_connection_id IS DISTINCT FROM p_social_connection_id
     OR v_job.social_account_id IS DISTINCT FROM v_social_account_id
     OR v_job.platform IS DISTINCT FROM v_platform
     OR v_job.source_type IS DISTINCT FROM v_source_type
     OR v_job.source_id IS DISTINCT FROM p_source_id
     OR v_job.caption_snapshot IS DISTINCT FROM v_caption_snapshot THEN
    RAISE EXCEPTION 'idempotency_key_intent_mismatch' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY SELECT v_job.id, v_job.status, TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_or_reuse_social_publish_job(UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_reuse_social_publish_job(UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT)
  TO service_role;
CREATE OR REPLACE FUNCTION public.start_facebook_photo_publish(
  p_job_id UUID,
  p_claim_token UUID,
  p_media_lease_id UUID,
  p_min_remaining_lease_seconds INTEGER
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
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_job_id IS NULL OR p_claim_token IS NULL OR p_media_lease_id IS NULL
     OR p_min_remaining_lease_seconds IS NULL
     OR p_min_remaining_lease_seconds NOT BETWEEN 60 AND 86400 THEN
    RAISE EXCEPTION 'invalid_facebook_photo_publish_start' USING ERRCODE = '22023';
  END IF;

  UPDATE public.social_publish_jobs AS j
     SET status = 'publishing',
         external_publish_started_at = v_now,
         media_lease_id = p_media_lease_id,
         updated_at = v_now
   WHERE j.id = p_job_id
     AND j.claim_token = p_claim_token
     AND j.status = 'processing'
     AND j.platform = 'facebook'
     AND j.claim_expires_at > v_now
     AND j.external_publish_started_at IS NULL
     AND j.external_post_id IS NULL
     AND j.social_account_id IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM public.social_accounts AS a
        WHERE a.id = j.social_account_id
          AND a.user_id = j.user_id
          AND a.social_connection_id = j.social_connection_id
          AND a.provider = 'meta'
          AND a.platform = 'facebook'
          AND a.account_status = 'active'
     )
     AND EXISTS (
       SELECT 1
         FROM public.social_media_leases AS l
        WHERE l.id = p_media_lease_id
          AND l.job_id = j.id
          AND l.user_id = j.user_id
          AND l.status = 'active'
          AND l.expires_at >= v_now + pg_catalog.make_interval(secs => p_min_remaining_lease_seconds)
     )
  RETURNING j.* INTO v_job;

  IF FOUND THEN
    RETURN QUERY SELECT v_job.id, v_job.status;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.start_facebook_photo_publish(UUID, UUID, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_facebook_photo_publish(UUID, UUID, UUID, INTEGER)
  TO service_role;
CREATE OR REPLACE FUNCTION public.complete_facebook_photo_publish(
  p_job_id UUID,
  p_claim_token UUID,
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
     OR p_external_post_id IS NULL
     OR p_external_post_id !~ '^[A-Za-z0-9._:-]{1,200}$'
     OR (
       p_external_post_url IS NOT NULL
       AND p_external_post_url !~* '^https://(www\.)?facebook\.com/'
     ) THEN
    RAISE EXCEPTION 'invalid_facebook_photo_publish_completion' USING ERRCODE = '22023';
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
     AND j.status = 'publishing'
     AND j.platform = 'facebook'
     AND j.claim_expires_at > v_now
     AND j.external_publish_started_at IS NOT NULL
     AND j.external_post_id IS NULL
     AND j.social_account_id IS NOT NULL
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
REVOKE EXECUTE ON FUNCTION public.complete_facebook_photo_publish(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_facebook_photo_publish(UUID, UUID, TEXT, TEXT)
  TO service_role;
CREATE OR REPLACE FUNCTION public.get_social_publish_job_recovery(p_job_id UUID)
RETURNS TABLE(
  job_id UUID,
  public_status TEXT,
  destination TEXT,
  social_account TEXT,
  source_type TEXT,
  source_id UUID,
  caption_snapshot TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  external_post_id TEXT,
  external_post_link TEXT,
  public_error_code TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    j.id,
    CASE
      WHEN j.status IN ('queued', 'retry_scheduled') THEN 'queued'
      WHEN j.status IN ('processing', 'publishing', 'reconciliation_required') THEN 'processing'
      WHEN j.status = 'published' THEN 'published'
      WHEN j.status = 'failed' THEN 'failed'
      WHEN j.status = 'cancelled' THEN 'cancelled'
    END,
    j.platform,
    CASE
      WHEN j.platform = 'facebook' THEN a.display_name
      WHEN j.platform = 'instagram' THEN COALESCE(a.username, sc.ig_username)
      ELSE NULL
    END,
    j.source_type,
    j.source_id,
    j.caption_snapshot,
    j.created_at,
    j.updated_at,
    CASE WHEN j.status = 'published' THEN j.external_post_id ELSE NULL END,
    CASE WHEN j.status = 'published' THEN j.external_post_url ELSE NULL END,
    CASE
      WHEN j.status <> 'failed' THEN NULL
      WHEN j.error_code IN ('social_account_not_connected', 'instagram_not_connected')
        THEN 'social_account_not_connected'
      WHEN j.error_code IN ('social_reconnect_required', 'instagram_reconnect_required', 'facebook_reconnect_required')
        THEN 'social_reconnect_required'
      WHEN j.error_code = 'invalid_media_source' THEN 'invalid_media_source'
      WHEN j.error_code = 'publish_timeout' THEN 'publish_timeout'
      WHEN j.error_code = 'external_container_expired' THEN 'external_container_expired'
      ELSE 'social_publish_failed'
    END
  FROM public.social_publish_jobs AS j
  JOIN public.social_connections AS sc
    ON sc.id = j.social_connection_id
   AND sc.user_id = j.user_id
  LEFT JOIN public.social_accounts AS a
    ON a.id = j.social_account_id
   AND a.user_id = j.user_id
   AND a.social_connection_id = j.social_connection_id
  WHERE j.id = p_job_id
    AND j.user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_social_publish_job_recovery(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_social_publish_job_recovery(UUID)
  TO authenticated;
