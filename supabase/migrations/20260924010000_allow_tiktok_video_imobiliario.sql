-- Add the real Video Imobiliario product while preserving every Phase A job and RPC ACL.
BEGIN;
ALTER TABLE public.tiktok_publish_jobs DROP CONSTRAINT tiktok_publish_jobs_product_check;
ALTER TABLE public.tiktok_publish_jobs ADD CONSTRAINT tiktok_publish_jobs_product_check
 CHECK(product IN ('studio_ia_commercial','video_imobiliario'));
ALTER TABLE public.tiktok_publish_jobs DROP CONSTRAINT tiktok_posting_path;
ALTER TABLE public.tiktok_publish_jobs ADD CONSTRAINT tiktok_posting_path CHECK(
 (product='studio_ia_commercial' AND object_path=user_id::text || '/' || creation_id::text || '/video.mp4') OR
 (product='video_imobiliario' AND object_path=user_id::text || '/' || creation_id::text || '/smart-tour.mp4')
);
CREATE OR REPLACE FUNCTION public.create_tiktok_publish_job(p_job jsonb) RETURNS public.tiktok_publish_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE j public.tiktok_publish_jobs; existing public.tiktok_publish_jobs; v_now timestamptz := clock_timestamp();
BEGIN
 IF jsonb_typeof(p_job) IS DISTINCT FROM 'object' OR
 p_job - ARRAY['user_id','connection_id','environment','app_id','connection_open_id','creation_id','product','bucket','object_path','object_etag','object_version','content_sha256','content_type','content_length','width','height','duration_ms','codec','idempotency_key','request_fingerprint','confirmed_options','creator_info_snapshot','creator_info_checked_at','confirmed_at','consent_version'] <> '{}'::jsonb
 THEN RAISE EXCEPTION 'posting_input_invalid'; END IF;
 j := jsonb_populate_record(NULL::public.tiktok_publish_jobs,p_job);
 -- Serialize same-key requests even across different creations (unique insert race).
 PERFORM pg_advisory_xact_lock(hashtextextended(j.user_id::text || ':' || j.environment || ':' || j.app_id || ':' || j.idempotency_key::text,0));
 SELECT * INTO existing FROM public.tiktok_publish_jobs
 WHERE user_id=j.user_id AND environment=j.environment AND app_id=j.app_id AND idempotency_key=j.idempotency_key FOR UPDATE;
 IF FOUND THEN
  IF existing.request_fingerprint IS DISTINCT FROM j.request_fingerprint THEN RAISE EXCEPTION 'posting_idempotency_conflict'; END IF;
  RETURN existing;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=j.user_id) THEN RAISE EXCEPTION 'posting_admin_required'; END IF;
 PERFORM 1 FROM public.video_jobs WHERE id=j.creation_id AND user_id=j.user_id AND status='completed'
 AND output_video_path=j.object_path AND (
  (j.product='studio_ia_commercial' AND mode='dynamic_reel') OR
  (j.product='video_imobiliario' AND mode='smart_tour_gemini_omni')
 ) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'posting_creation_invalid'; END IF;
 PERFORM 1 FROM public.tiktok_connections WHERE id=j.connection_id AND user_id=j.user_id
 AND environment='sandbox' AND environment=j.environment AND app_id=j.app_id AND open_id=j.connection_open_id AND connection_status='active' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'posting_connection_invalid'; END IF;
 IF j.creator_info_checked_at IS NULL OR j.confirmed_at IS NULL OR j.confirmed_at > v_now OR
 j.creator_info_checked_at > j.confirmed_at OR j.creator_info_checked_at < v_now-interval '5 minutes' THEN RAISE EXCEPTION 'posting_consent_stale'; END IF;
 IF NOT (j.creator_info_snapshot->'privacy_level_options' ? (j.confirmed_options->>'privacy_level')) OR
 j.duration_ms > (j.creator_info_snapshot->>'max_video_post_duration_sec')::numeric*1000 OR
 ((j.creator_info_snapshot->>'comment_disabled')::boolean AND NOT (j.confirmed_options->>'disable_comment')::boolean) OR
 ((j.creator_info_snapshot->>'duet_disabled')::boolean AND NOT (j.confirmed_options->>'disable_duet')::boolean) OR
 ((j.creator_info_snapshot->>'stitch_disabled')::boolean AND NOT (j.confirmed_options->>'disable_stitch')::boolean) OR
 ((j.confirmed_options->>'brand_content_toggle')::boolean AND j.confirmed_options->>'privacy_level'='SELF_ONLY')
 THEN RAISE EXCEPTION 'posting_options_invalid'; END IF;
 j.id:=gen_random_uuid(); j.status:='awaiting_confirmation'; j.created_at:=v_now; j.updated_at:=v_now;
 j.init_attempts:=0; j.upload_attempts:=0; j.status_attempts:=0; j.revision:=1; j.provider_post_ids:='{}';
 INSERT INTO public.tiktok_publish_jobs SELECT j.*;
 RETURN j;
END $$;

COMMIT;
