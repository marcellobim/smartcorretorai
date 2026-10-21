-- Delivery-only metadata and one recoverable campaign transformation video per
-- Virtual Staging request. This migration never changes Smart Token accounting.

ALTER TABLE public.virtual_staging_image_requests
  ADD COLUMN IF NOT EXISTS delivery_metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE TABLE IF NOT EXISTS public.virtual_staging_consolidated_videos (
  request_id UUID PRIMARY KEY REFERENCES public.virtual_staging_image_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state TEXT NOT NULL DEFAULT 'not_requested' CHECK (state IN ('not_requested', 'submitting', 'rendering', 'completed', 'failed_retryable', 'failed_unknown')),
  renderer TEXT,
  idempotency_key TEXT,
  render_id TEXT,
  output_path TEXT,
  failure_reason TEXT,
  claim_token UUID,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.virtual_staging_consolidated_videos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.virtual_staging_consolidated_videos FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.virtual_staging_consolidated_videos TO service_role;

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
  IF NOT FOUND OR v_request.status <> 'completed' OR v_request.completed_count <> v_request.image_count THEN RAISE EXCEPTION 'smart_space_request_not_completed'; END IF;
  IF EXISTS (SELECT 1 FROM public.virtual_staging_image_items WHERE request_id=v_request.id AND (status <> 'completed' OR stage_state <> 'completed' OR COALESCE(result->>'delivery_status','') <> 'completed')) THEN
    RAISE EXCEPTION 'smart_space_images_not_completed';
  END IF;
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

CREATE OR REPLACE FUNCTION public.register_smart_space_consolidated_video_render(
  p_user_id UUID,p_client_request_id UUID,p_claim_token UUID,p_render_id TEXT
) RETURNS SETOF public.virtual_staging_consolidated_videos
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_video public.virtual_staging_consolidated_videos%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
  SELECT video.* INTO v_video FROM public.virtual_staging_consolidated_videos video JOIN public.virtual_staging_image_requests request ON request.id=video.request_id
   WHERE request.user_id=p_user_id AND request.client_request_id=p_client_request_id FOR UPDATE OF video;
  IF NOT FOUND OR v_video.state <> 'submitting' OR v_video.claim_token IS DISTINCT FROM p_claim_token THEN RAISE EXCEPTION 'invalid_video_claim'; END IF;
  UPDATE public.virtual_staging_consolidated_videos SET state='rendering',render_id=p_render_id,updated_at=pg_catalog.now()
   WHERE request_id=v_video.request_id RETURNING * INTO v_video;
  RETURN NEXT v_video;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_smart_space_consolidated_video_render(
  p_user_id UUID,p_client_request_id UUID,p_claim_token UUID,p_output_path TEXT
) RETURNS SETOF public.virtual_staging_consolidated_videos
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_video public.virtual_staging_consolidated_videos%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
  SELECT video.* INTO v_video FROM public.virtual_staging_consolidated_videos video JOIN public.virtual_staging_image_requests request ON request.id=video.request_id
   WHERE request.user_id=p_user_id AND request.client_request_id=p_client_request_id FOR UPDATE OF video;
  IF NOT FOUND OR v_video.state <> 'rendering' OR v_video.claim_token IS DISTINCT FROM p_claim_token THEN RAISE EXCEPTION 'invalid_video_claim'; END IF;
  IF p_output_path <> p_user_id::TEXT || '/virtual-staging-images/outputs/' || p_client_request_id::TEXT || '/campaign-transformation.mp4' THEN RAISE EXCEPTION 'invalid_video_output_path'; END IF;
  UPDATE public.virtual_staging_consolidated_videos SET state='completed',output_path=p_output_path,failure_reason=NULL,claim_token=NULL,updated_at=pg_catalog.now()
   WHERE request_id=v_video.request_id RETURNING * INTO v_video;
  RETURN NEXT v_video;
END; $$;

CREATE OR REPLACE FUNCTION public.fail_smart_space_consolidated_video_render(
  p_user_id UUID,p_client_request_id UUID,p_claim_token UUID,p_reason TEXT,p_retryable BOOLEAN DEFAULT FALSE
) RETURNS SETOF public.virtual_staging_consolidated_videos
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_video public.virtual_staging_consolidated_videos%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'unauthorized' USING ERRCODE='42501'; END IF;
  SELECT video.* INTO v_video FROM public.virtual_staging_consolidated_videos video JOIN public.virtual_staging_image_requests request ON request.id=video.request_id
   WHERE request.user_id=p_user_id AND request.client_request_id=p_client_request_id FOR UPDATE OF video;
  IF NOT FOUND OR v_video.state NOT IN ('submitting','rendering') OR v_video.claim_token IS DISTINCT FROM p_claim_token THEN RAISE EXCEPTION 'invalid_video_claim'; END IF;
  UPDATE public.virtual_staging_consolidated_videos SET state=CASE WHEN p_retryable THEN 'failed_retryable' ELSE 'failed_unknown' END,
    failure_reason=pg_catalog.left(COALESCE(p_reason,'video_render_failed'),120),claim_token=NULL,updated_at=pg_catalog.now()
   WHERE request_id=v_video.request_id RETURNING * INTO v_video;
  RETURN NEXT v_video;
END; $$;

REVOKE EXECUTE ON FUNCTION public.claim_smart_space_consolidated_video_render(UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.register_smart_space_consolidated_video_render(UUID,UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_smart_space_consolidated_video_render(UUID,UUID,UUID,TEXT) FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_smart_space_consolidated_video_render(UUID,UUID,UUID,TEXT,BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_smart_space_consolidated_video_render(UUID,UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.register_smart_space_consolidated_video_render(UUID,UUID,UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_smart_space_consolidated_video_render(UUID,UUID,UUID,TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_smart_space_consolidated_video_render(UUID,UUID,UUID,TEXT,BOOLEAN) TO service_role;
