-- A finished multi-image request may contain a failed or partial item. The
-- campaign video is delivery-only and must include every fully completed pair
-- instead of being blocked by an unrelated unsuccessful item.

CREATE OR REPLACE FUNCTION public.claim_smart_space_consolidated_video_render(
  p_user_id UUID, p_client_request_id UUID, p_idempotency_key TEXT
) RETURNS TABLE(returned_video JSONB, claimed BOOLEAN, claim_token UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_request public.virtual_staging_image_requests%ROWTYPE; v_video public.virtual_staging_consolidated_videos%ROWTYPE;
  v_token UUID := NULL; v_claimed BOOLEAN := FALSE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
  IF p_idempotency_key IS NULL OR pg_catalog.length(p_idempotency_key) > 160 THEN RAISE EXCEPTION 'invalid_video_key'; END IF;
  SELECT * INTO v_request FROM public.virtual_staging_image_requests
   WHERE user_id=p_user_id AND client_request_id=p_client_request_id FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'completed' OR v_request.completed_count < 1 THEN RAISE EXCEPTION 'smart_space_request_without_completed_items'; END IF;
  INSERT INTO public.virtual_staging_consolidated_videos(request_id,user_id,idempotency_key)
    VALUES(v_request.id,p_user_id,p_idempotency_key)
    ON CONFLICT (request_id) DO NOTHING;
  SELECT * INTO v_video FROM public.virtual_staging_consolidated_videos WHERE request_id=v_request.id FOR UPDATE;
  IF v_video.idempotency_key IS NOT NULL AND v_video.idempotency_key <> p_idempotency_key THEN RAISE EXCEPTION 'consolidated_video_intent_mismatch'; END IF;
  IF v_video.state IN ('not_requested','failed_retryable') THEN
    v_token:=pg_catalog.gen_random_uuid(); v_claimed:=TRUE;
    UPDATE public.virtual_staging_consolidated_videos SET state='submitting',renderer='creatomate-renderscript',idempotency_key=p_idempotency_key,
      claim_token=v_token,claimed_at=pg_catalog.now(),failure_reason=NULL,updated_at=pg_catalog.now()
      WHERE request_id=v_request.id RETURNING * INTO v_video;
  END IF;
  RETURN QUERY SELECT pg_catalog.to_jsonb(v_video),v_claimed,v_token;
END; $$;

REVOKE EXECUTE ON FUNCTION public.claim_smart_space_consolidated_video_render(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_smart_space_consolidated_video_render(UUID,UUID,TEXT) TO service_role;
