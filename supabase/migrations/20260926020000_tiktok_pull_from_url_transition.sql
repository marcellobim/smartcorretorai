BEGIN;
CREATE OR REPLACE FUNCTION public.transition_tiktok_publish_job(p_id uuid,p_revision bigint,p_claim uuid,p_next text,p_publish_id text DEFAULT NULL,p_provider_status text DEFAULT NULL,p_error_code text DEFAULT NULL) RETURNS public.tiktok_publish_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE j public.tiktok_publish_jobs; v_now timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO j FROM public.tiktok_publish_jobs WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR j.revision IS DISTINCT FROM p_revision OR j.claim_token IS DISTINCT FROM p_claim OR p_claim IS NULL OR j.claim_expires_at<=v_now THEN RAISE EXCEPTION 'posting_cas_conflict'; END IF;
 IF p_next IS NULL OR NOT ((j.status='awaiting_confirmation' AND p_next IN ('queued','blocked')) OR (j.status='queued' AND p_next IN ('initializing','blocked')) OR (j.status='initializing' AND p_next IN ('uploading','processing','failed','reconciliation_required')) OR (j.status='uploading' AND p_next IN ('processing','failed','reconciliation_required')) OR (j.status='processing' AND p_next IN ('processing','published','failed','reconciliation_required')) OR (j.status='reconciliation_required' AND p_next IN ('processing','published','failed'))) THEN RAISE EXCEPTION 'posting_transition_invalid'; END IF;
 IF p_publish_id IS NOT NULL AND NOT (j.status='initializing' AND p_next IN ('uploading','processing')) THEN RAISE EXCEPTION 'posting_publish_id_unexpected'; END IF;
 IF j.status='initializing' AND p_next IN ('uploading','processing') AND p_publish_id IS NULL THEN RAISE EXCEPTION 'posting_publish_id_required'; END IF;
 IF p_next='published' AND p_provider_status IS DISTINCT FROM 'PUBLISH_COMPLETE' THEN RAISE EXCEPTION 'posting_provider_incomplete'; END IF;
 IF p_next='failed' AND p_provider_status IS DISTINCT FROM 'FAILED' AND NOT (j.status='initializing' AND p_error_code='init_provider_rejected') THEN RAISE EXCEPTION 'posting_failure_unconfirmed'; END IF;
 UPDATE public.tiktok_publish_jobs SET status=p_next,publish_id=coalesce(publish_id,p_publish_id),provider_status=coalesce(p_provider_status,provider_status),error_code=p_error_code,init_attempts=init_attempts+CASE WHEN p_next='initializing' THEN 1 ELSE 0 END,upload_attempts=upload_attempts+CASE WHEN p_next='uploading' THEN 1 ELSE 0 END,status_attempts=status_attempts+CASE WHEN j.status IN ('processing','reconciliation_required') THEN 1 ELSE 0 END,init_started_at=CASE WHEN p_next='initializing' THEN v_now ELSE init_started_at END,upload_started_at=CASE WHEN p_next='uploading' THEN v_now ELSE upload_started_at END,next_poll_at=CASE WHEN p_next IN ('processing','reconciliation_required') THEN v_now+interval '10 seconds' ELSE NULL END,completed_at=CASE WHEN p_next IN ('published','blocked','failed') THEN v_now ELSE NULL END,revision=revision+1,updated_at=v_now WHERE id=p_id RETURNING * INTO j;
 RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.transition_tiktok_publish_job(uuid,bigint,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.transition_tiktok_publish_job(uuid,bigint,uuid,text,text,text,text) TO service_role;
COMMIT;
