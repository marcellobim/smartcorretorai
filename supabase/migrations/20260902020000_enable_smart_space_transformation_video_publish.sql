-- Adds the completed Smart Space transformation MP4 as a captionless social source.
-- This migration creates no publish job, calls no provider and moves no Smart Tokens.

ALTER TABLE public.social_publish_jobs
  DROP CONSTRAINT IF EXISTS social_publish_jobs_product_identity_consistent;

ALTER TABLE public.social_publish_jobs
  ADD CONSTRAINT social_publish_jobs_product_identity_consistent CHECK (
    (source_option_id IS NULL AND media_asset_id IS NULL)
    OR (
      source_type = 'banner_imobiliario'
      AND source_option_id ~ '^banner-caption-option-[1-3]$'
      AND media_asset_id ~ '^[A-Za-z0-9._:-]{1,240}$'
    )
    OR (
      source_type = 'quick_banners'
      AND source_option_id ~ '^quick-banner-caption-option-[1-3]$'
      AND media_asset_id ~ '^[A-Za-z0-9._:-]{1,240}$'
    )
    OR (
      source_type = 'video_imobiliario'
      AND source_option_id ~ '^smart-tour-caption-option-[1-3]$'
      AND media_asset_id = source_id::TEXT
    )
    OR (
      source_type IN ('studio_ia_commercial', 'studio_ia_creative', 'studio_ia_carousel')
      AND source_option_id ~ '^studio-caption-option-[1-3]$'
      AND media_asset_id = source_id::TEXT
    )
    OR (
      source_type = 'smart_space_image'
      AND source_option_id = 'smart-space-no-caption'
      AND media_asset_id ~ '^[0-4]:[a-z0-9_]{1,40}$'
    )
    OR (
      source_type = 'smart_space_transform'
      AND source_option_id = 'smart-space-no-caption'
      AND media_asset_id ~ '^[0-4]:transformation_video$'
    )
    OR (
      source_type IN ('smart_space_life', 'smart_space_broker')
      AND source_option_id = 'smart-space-no-caption'
      AND media_asset_id = source_id::TEXT
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS social_publish_jobs_smart_space_transform_destination_unique
  ON public.social_publish_jobs(user_id, platform, source_type, source_id, source_option_id, media_asset_id)
  WHERE source_type = 'smart_space_transform';

CREATE OR REPLACE FUNCTION public.create_or_reuse_smart_space_transform_social_publish_job(
  p_user_id UUID,
  p_social_connection_id UUID,
  p_platform TEXT,
  p_idempotency_key UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_media_asset_id TEXT,
  p_option_id TEXT,
  p_caption TEXT
)
RETURNS TABLE(job_id UUID, job_status TEXT, reused BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.social_publish_jobs%ROWTYPE;
  v_platform TEXT := pg_catalog.lower(pg_catalog.btrim(p_platform));
  v_media_asset_id TEXT := pg_catalog.btrim(p_media_asset_id);
  v_account_ids UUID[];
  v_social_account_id UUID;
  v_item_index INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_social_connection_id IS NULL OR p_idempotency_key IS NULL
     OR p_source_id IS NULL OR v_platform NOT IN ('instagram', 'facebook')
     OR pg_catalog.btrim(p_source_type) IS DISTINCT FROM 'smart_space_transform'
     OR pg_catalog.btrim(p_option_id) IS DISTINCT FROM 'smart-space-no-caption'
     OR p_caption IS DISTINCT FROM ''
     OR v_media_asset_id !~ '^[0-4]:transformation_video$' THEN
    RAISE EXCEPTION 'invalid_smart_space_transform_social_publish_job' USING ERRCODE = '22023';
  END IF;

  v_item_index := pg_catalog.split_part(v_media_asset_id, ':', 1)::INTEGER;
  IF NOT EXISTS (
    SELECT 1
      FROM public.virtual_staging_image_requests AS request
      JOIN public.virtual_staging_image_items AS item ON item.request_id = request.id
     WHERE request.user_id = p_user_id
       AND request.client_request_id = p_source_id
       AND request.status = 'completed'
       AND item.item_index = v_item_index
       AND item.status = 'completed'
       AND item.video_state = 'completed'
       AND item.video_output_path = p_user_id::TEXT || '/virtual-staging-images/outputs/'
         || p_source_id::TEXT || '/' || pg_catalog.lpad((v_item_index + 1)::TEXT, 2, '0') || '-transformation.mp4'
  ) THEN
    RAISE EXCEPTION 'invalid_smart_space_transform_media_identity' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.social_connections AS connection
     WHERE connection.id = p_social_connection_id
       AND connection.user_id = p_user_id
       AND connection.provider = 'meta'
       AND connection.connection_status = 'active'
  ) THEN
    RAISE EXCEPTION 'invalid_social_connection' USING ERRCODE = '22023';
  END IF;

  SELECT pg_catalog.array_agg(account.id ORDER BY account.id)
    INTO v_account_ids
    FROM public.social_accounts AS account
   WHERE account.user_id = p_user_id
     AND account.social_connection_id = p_social_connection_id
     AND account.provider = 'meta'
     AND account.platform = v_platform
     AND account.account_status = 'active';

  IF pg_catalog.array_length(v_account_ids, 1) IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'social_account_selection_required' USING ERRCODE = '22023';
  END IF;
  v_social_account_id := v_account_ids[1];

  INSERT INTO public.social_publish_jobs (
    user_id, social_connection_id, social_account_id, platform, idempotency_key,
    source_type, source_id, source_option_id, media_asset_id, caption_snapshot, status
  ) VALUES (
    p_user_id, p_social_connection_id, v_social_account_id, v_platform, p_idempotency_key,
    'smart_space_transform', p_source_id, 'smart-space-no-caption', v_media_asset_id, '', 'queued'
  )
  ON CONFLICT DO NOTHING
  RETURNING * INTO v_job;

  IF FOUND THEN
    RETURN QUERY SELECT v_job.id, v_job.status, FALSE;
    RETURN;
  END IF;

  SELECT job.*
    INTO STRICT v_job
    FROM public.social_publish_jobs AS job
   WHERE job.user_id = p_user_id
     AND (
       job.idempotency_key = p_idempotency_key
       OR (
         job.platform = v_platform
         AND job.source_type = 'smart_space_transform'
         AND job.source_id = p_source_id
         AND job.source_option_id = 'smart-space-no-caption'
         AND job.media_asset_id = v_media_asset_id
       )
     )
   ORDER BY (job.idempotency_key = p_idempotency_key) DESC, job.created_at
   LIMIT 1;

  IF v_job.social_connection_id IS DISTINCT FROM p_social_connection_id
     OR v_job.social_account_id IS DISTINCT FROM v_social_account_id
     OR v_job.platform IS DISTINCT FROM v_platform
     OR v_job.source_type IS DISTINCT FROM 'smart_space_transform'
     OR v_job.source_id IS DISTINCT FROM p_source_id
     OR v_job.source_option_id IS DISTINCT FROM 'smart-space-no-caption'
     OR v_job.media_asset_id IS DISTINCT FROM v_media_asset_id
     OR v_job.caption_snapshot IS DISTINCT FROM '' THEN
    RAISE EXCEPTION 'idempotency_key_intent_mismatch' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY SELECT v_job.id, v_job.status, TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_or_reuse_smart_space_transform_social_publish_job(
  UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_reuse_smart_space_transform_social_publish_job(
  UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT, TEXT, TEXT
) TO service_role;
