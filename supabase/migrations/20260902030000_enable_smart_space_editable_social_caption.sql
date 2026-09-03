-- Free, optional, immutable external caption for all Smart Space social sources.
-- This migration changes no media, worker, balance, reservation or Smart Token flow.

CREATE OR REPLACE FUNCTION public.create_or_reuse_smart_space_social_publish_job_v2(
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
  v_source_type TEXT := pg_catalog.btrim(p_source_type);
  v_media_asset_id TEXT := pg_catalog.btrim(p_media_asset_id);
  v_option_id TEXT := pg_catalog.btrim(p_option_id);
  v_account_ids UUID[];
  v_social_account_id UUID;
  v_item_index INTEGER;
  v_stage_kind TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_social_connection_id IS NULL OR p_idempotency_key IS NULL
     OR p_source_id IS NULL OR v_platform NOT IN ('instagram', 'facebook')
     OR v_source_type NOT IN ('smart_space_image', 'smart_space_transform', 'smart_space_life', 'smart_space_broker')
     OR v_option_id IS DISTINCT FROM 'smart-space-no-caption'
     OR p_caption IS NULL OR pg_catalog.length(p_caption) > 2200 THEN
    RAISE EXCEPTION 'invalid_smart_space_social_publish_job' USING ERRCODE = '22023';
  END IF;

  IF v_source_type = 'smart_space_image' THEN
    IF v_media_asset_id !~ '^[0-4]:[a-z0-9_]{1,40}$' THEN
      RAISE EXCEPTION 'invalid_smart_space_media_identity' USING ERRCODE = '22023';
    END IF;
    v_item_index := pg_catalog.split_part(v_media_asset_id, ':', 1)::INTEGER;
    v_stage_kind := pg_catalog.split_part(v_media_asset_id, ':', 2);
    IF NOT EXISTS (
      SELECT 1
        FROM public.virtual_staging_image_requests AS request
        JOIN public.virtual_staging_image_items AS item ON item.request_id = request.id
        CROSS JOIN LATERAL pg_catalog.jsonb_array_elements(COALESCE(item.result->'stages', '[]'::JSONB)) AS stage
       WHERE request.user_id = p_user_id
         AND request.client_request_id = p_source_id
         AND request.status = 'completed'
         AND item.item_index = v_item_index
         AND item.status = 'completed'
         AND stage->>'kind' = v_stage_kind
         AND stage->>'output_path' LIKE p_user_id::TEXT || '/virtual-staging-images/results/' || item.id::TEXT || '/%'
    ) THEN
      RAISE EXCEPTION 'invalid_smart_space_media_identity' USING ERRCODE = '22023';
    END IF;
  ELSIF v_source_type = 'smart_space_transform' THEN
    IF v_media_asset_id !~ '^[0-4]:transformation_video$' THEN
      RAISE EXCEPTION 'invalid_smart_space_transform_media_identity' USING ERRCODE = '22023';
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
  ELSE
    IF v_media_asset_id IS DISTINCT FROM p_source_id::TEXT OR NOT EXISTS (
      SELECT 1
        FROM public.video_jobs AS job
        JOIN public.gemini_video_economy_requests AS request
          ON request.user_id = job.user_id AND request.client_request_id = job.id
       WHERE job.id = p_source_id
         AND job.user_id = p_user_id
         AND job.status = 'completed'
         AND job.mode = 'virtual_staging_gemini_omni'
         AND job.output_video_path = p_user_id::TEXT || '/' || p_source_id::TEXT || '/virtual-staging.mp4'
         AND request.status = 'completed'
         AND request.product_code = CASE WHEN v_source_type = 'smart_space_life' THEN 'life_in_property' ELSE 'broker_presentation' END
    ) THEN
      RAISE EXCEPTION 'invalid_smart_space_media_identity' USING ERRCODE = '22023';
    END IF;
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
    v_source_type, p_source_id, v_option_id, v_media_asset_id, p_caption, 'queued'
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
         AND job.source_type = v_source_type
         AND job.source_id = p_source_id
         AND job.source_option_id = v_option_id
         AND job.media_asset_id = v_media_asset_id
       )
     )
   ORDER BY (job.idempotency_key = p_idempotency_key) DESC, job.created_at
   LIMIT 1;

  IF v_job.social_connection_id IS DISTINCT FROM p_social_connection_id
     OR v_job.social_account_id IS DISTINCT FROM v_social_account_id
     OR v_job.platform IS DISTINCT FROM v_platform
     OR v_job.source_type IS DISTINCT FROM v_source_type
     OR v_job.source_id IS DISTINCT FROM p_source_id
     OR v_job.source_option_id IS DISTINCT FROM v_option_id
     OR v_job.media_asset_id IS DISTINCT FROM v_media_asset_id
     OR v_job.caption_snapshot IS DISTINCT FROM p_caption THEN
    RAISE EXCEPTION 'idempotency_key_intent_mismatch' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY SELECT v_job.id, v_job.status, TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_or_reuse_smart_space_social_publish_job_v2(
  UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT, TEXT, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_reuse_smart_space_social_publish_job_v2(
  UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT, TEXT, TEXT
) TO service_role;
