BEGIN;

ALTER TABLE public.tiktok_publish_jobs
 ADD COLUMN closure_reason text,
 ADD CONSTRAINT tiktok_posting_closure_reason CHECK (closure_reason IS NULL OR closure_reason='init_no_publish_id_irrecoverable');

ALTER TABLE public.tiktok_publish_jobs DROP CONSTRAINT tiktok_publish_jobs_error_code_check;
ALTER TABLE public.tiktok_publish_jobs ADD CONSTRAINT tiktok_publish_jobs_error_code_check CHECK(error_code IN (
 'preflight_failed','init_uncertain','upload_uncertain','lease_expired','provider_failed','persistence_uncertain',
 'init_timeout','init_abort','init_transport_error','init_http_ambiguous','init_provider_ambiguous',
 'init_provider_rejected','init_invalid_json','init_missing_publish_id','init_invalid_upload_url'
));

CREATE OR REPLACE FUNCTION public.tiktok_posting_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW) - ARRAY['publish_id','status','provider_status','provider_post_ids','init_attempts','upload_attempts','status_attempts','revision','claim_token','claim_expires_at','next_poll_at','init_started_at','upload_started_at','error_code','closure_reason','updated_at','completed_at'])
   IS DISTINCT FROM
   (to_jsonb(OLD) - ARRAY['publish_id','status','provider_status','provider_post_ids','init_attempts','upload_attempts','status_attempts','revision','claim_token','claim_expires_at','next_poll_at','init_started_at','upload_started_at','error_code','closure_reason','updated_at','completed_at'])
  THEN RAISE EXCEPTION 'posting_snapshot_immutable'; END IF;
  IF OLD.publish_id IS NOT NULL AND NEW.publish_id IS DISTINCT FROM OLD.publish_id THEN RAISE EXCEPTION 'posting_publish_id_immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.transition_tiktok_publish_job(p_id uuid,p_revision bigint,p_claim uuid,p_next text,p_publish_id text DEFAULT NULL,p_provider_status text DEFAULT NULL,p_error_code text DEFAULT NULL)
RETURNS public.tiktok_publish_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE j public.tiktok_publish_jobs; v_now timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO j FROM public.tiktok_publish_jobs WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR j.revision IS DISTINCT FROM p_revision OR j.claim_token IS DISTINCT FROM p_claim OR p_claim IS NULL OR j.claim_expires_at<=v_now THEN RAISE EXCEPTION 'posting_cas_conflict'; END IF;
 IF p_next IS NULL THEN RAISE EXCEPTION 'posting_transition_invalid'; END IF;
 IF NOT (
 (j.status='awaiting_confirmation' AND p_next IN ('queued','blocked')) OR
 (j.status='queued' AND p_next IN ('initializing','blocked')) OR
 (j.status='initializing' AND p_next IN ('uploading','failed','reconciliation_required')) OR
 (j.status='uploading' AND p_next IN ('processing','failed','reconciliation_required')) OR
 (j.status='processing' AND p_next IN ('processing','published','failed','reconciliation_required')) OR
 (j.status='reconciliation_required' AND j.publish_id IS NOT NULL AND p_next IN ('processing','published','failed'))
 ) THEN RAISE EXCEPTION 'posting_transition_invalid'; END IF;
 IF p_next='initializing' THEN
  IF j.init_attempts<>0 OR j.creator_info_checked_at < v_now-interval '5 minutes' OR NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id=j.user_id) OR
  NOT EXISTS(SELECT 1 FROM public.tiktok_connections WHERE id=j.connection_id AND user_id=j.user_id AND environment=j.environment AND app_id=j.app_id AND connection_status='active' AND scopes @> ARRAY['user.info.basic','video.publish']::text[] AND access_token_expires_at>v_now+interval '2 minutes')
  THEN RAISE EXCEPTION 'posting_not_ready'; END IF;
 END IF;
 IF p_publish_id IS NOT NULL AND NOT (j.status='initializing' AND p_next='uploading') THEN RAISE EXCEPTION 'posting_publish_id_unexpected'; END IF;
 IF p_next='uploading' AND (p_publish_id IS NULL OR j.upload_attempts<>0) THEN RAISE EXCEPTION 'posting_publish_id_required'; END IF;
 IF p_next='published' AND p_provider_status IS DISTINCT FROM 'PUBLISH_COMPLETE' THEN RAISE EXCEPTION 'posting_provider_incomplete'; END IF;
 IF p_next='failed' AND p_provider_status IS DISTINCT FROM 'FAILED' AND NOT (j.status='initializing' AND p_error_code='init_provider_rejected') THEN RAISE EXCEPTION 'posting_failure_unconfirmed'; END IF;
 UPDATE public.tiktok_publish_jobs SET status=p_next,publish_id=coalesce(publish_id,p_publish_id),provider_status=coalesce(p_provider_status,provider_status),error_code=p_error_code,
 init_attempts=init_attempts+CASE WHEN p_next='initializing' THEN 1 ELSE 0 END,upload_attempts=upload_attempts+CASE WHEN p_next='uploading' THEN 1 ELSE 0 END,
 status_attempts=status_attempts+CASE WHEN j.status IN ('processing','reconciliation_required') THEN 1 ELSE 0 END,
 init_started_at=CASE WHEN p_next='initializing' THEN v_now ELSE init_started_at END,upload_started_at=CASE WHEN p_next='uploading' THEN v_now ELSE upload_started_at END,
 next_poll_at=CASE WHEN p_next IN ('processing','reconciliation_required') THEN v_now+interval '10 seconds' ELSE NULL END,
 completed_at=CASE WHEN p_next IN ('published','blocked','failed') THEN v_now ELSE NULL END,revision=revision+1,updated_at=v_now WHERE id=p_id RETURNING * INTO j;
 RETURN j;
END $$;

CREATE FUNCTION public.close_irrecoverable_tiktok_publish_job(p_id uuid,p_user_id uuid,p_environment text,p_app_id text)
RETURNS public.tiktok_publish_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE j public.tiktok_publish_jobs; v_now timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO j FROM public.tiktok_publish_jobs WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR j.user_id IS DISTINCT FROM p_user_id OR j.environment IS DISTINCT FROM p_environment OR j.app_id IS DISTINCT FROM p_app_id
 OR j.status IS DISTINCT FROM 'reconciliation_required' OR j.publish_id IS NOT NULL OR j.init_attempts<>1 OR j.upload_attempts<>0
 OR j.error_code NOT IN ('init_uncertain','init_timeout','init_abort','init_transport_error','init_http_ambiguous','init_provider_ambiguous','init_invalid_json','init_missing_publish_id')
 OR (j.claim_expires_at IS NOT NULL AND j.claim_expires_at>v_now)
 THEN RAISE EXCEPTION 'posting_irrecoverable_close_invalid'; END IF;
 -- FILE_UPLOAD cannot become a visible TikTok post without a successful upload; this job has no upload attempt or publish id.
 UPDATE public.tiktok_publish_jobs SET status='failed',closure_reason='init_no_publish_id_irrecoverable',
 claim_token=NULL,claim_expires_at=NULL,next_poll_at=NULL,completed_at=v_now,revision=revision+1,updated_at=v_now
 WHERE id=p_id RETURNING * INTO j;
 RETURN j;
END $$;

REVOKE ALL ON FUNCTION public.close_irrecoverable_tiktok_publish_job(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.close_irrecoverable_tiktok_publish_job(uuid,uuid,text,text) TO service_role;
COMMIT;
