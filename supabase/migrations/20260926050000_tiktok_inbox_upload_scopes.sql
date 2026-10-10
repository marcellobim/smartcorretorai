-- Inbox/Draft capability.  This migration changes no data and never grants a
-- browser role access to TikTok credentials or publish jobs.
BEGIN;

ALTER TABLE public.tiktok_publish_jobs DROP CONSTRAINT tiktok_publish_jobs_provider_status_check;
ALTER TABLE public.tiktok_publish_jobs ADD CONSTRAINT tiktok_publish_jobs_provider_status_check
 CHECK(provider_status IN ('PROCESSING_UPLOAD','PROCESSING_DOWNLOAD','SEND_TO_USER_INBOX','PUBLISH_COMPLETE','FAILED'));
-- Production does not record 20260926040000. Inbox uses the same safe,
-- deterministic pre-publish rejection and therefore carries this narrow
-- constraint extension in its own self-contained migration.
ALTER TABLE public.tiktok_publish_jobs DROP CONSTRAINT tiktok_publish_jobs_error_code_check;
ALTER TABLE public.tiktok_publish_jobs ADD CONSTRAINT tiktok_publish_jobs_error_code_check
 CHECK(error_code IN ('preflight_failed','init_uncertain','init_invalid_upload_url','upload_uncertain','lease_expired','provider_failed','persistence_uncertain','init_provider_rejected'));
ALTER TABLE public.tiktok_publish_jobs DROP CONSTRAINT tiktok_publish_jobs_status_check;
ALTER TABLE public.tiktok_publish_jobs ADD CONSTRAINT tiktok_publish_jobs_status_check
 CHECK(status IN ('awaiting_confirmation','queued','initializing','uploading','processing','inbox_delivered','published','blocked','failed','reconciliation_required'));
ALTER TABLE public.tiktok_publish_jobs DROP CONSTRAINT tiktok_posting_terminal_time;
ALTER TABLE public.tiktok_publish_jobs ADD CONSTRAINT tiktok_posting_terminal_time
 CHECK((status IN ('inbox_delivered','published','blocked','failed')) = (completed_at IS NOT NULL));
DROP INDEX public.tiktok_posting_active_creation;
CREATE UNIQUE INDEX tiktok_posting_active_creation ON public.tiktok_publish_jobs(creation_id,connection_id)
 WHERE status NOT IN ('inbox_delivered','published','blocked','failed');

DO $$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.persist_tiktok_login(text,text,jsonb)'::regprocedure) INTO definition;
 IF position($old$       AND p_login->'scopes' IS DISTINCT FROM '["user.info.basic","video.publish"]'::JSONB$old$ in definition)=0 THEN
   RAISE EXCEPTION 'tiktok_login_scope_contract_not_found';
 END IF;
 definition:=replace(definition,
 $old$       AND p_login->'scopes' IS DISTINCT FROM '["user.info.basic","video.publish"]'::JSONB$old$,
$new$       AND p_login->'scopes' IS DISTINCT FROM '["user.info.basic","video.publish"]'::JSONB
       AND p_login->'scopes' IS DISTINCT FROM '["user.info.basic","video.upload"]'::JSONB
       AND p_login->'scopes' IS DISTINCT FROM '["user.info.basic","video.publish","video.upload"]'::JSONB$new$);
 definition:=replace(definition,
 $old$    CASE WHEN p_login->'scopes' = '["user.info.basic","video.publish"]'::JSONB
      THEN ARRAY['user.info.basic','video.publish']::TEXT[]
      ELSE ARRAY['user.info.basic']::TEXT[]
    END,$old$,
$new$    CASE WHEN p_login->'scopes' = '["user.info.basic","video.publish"]'::JSONB THEN ARRAY['user.info.basic','video.publish']::TEXT[]
         WHEN p_login->'scopes' = '["user.info.basic","video.upload"]'::JSONB THEN ARRAY['user.info.basic','video.upload']::TEXT[]
         WHEN p_login->'scopes' = '["user.info.basic","video.publish","video.upload"]'::JSONB THEN ARRAY['user.info.basic','video.publish','video.upload']::TEXT[]
         ELSE ARRAY['user.info.basic']::TEXT[] END,$new$);
 EXECUTE definition;

 SELECT pg_get_functiondef('public.persist_tiktok_direct_post_upgrade(text,text,jsonb,uuid,bigint)'::regprocedure) INTO definition;
 IF position($old$OR p_login->'scopes' IS DISTINCT FROM '["user.info.basic","video.publish"]'::JSONB$old$ in definition)=0 THEN
   RAISE EXCEPTION 'tiktok_upgrade_scope_contract_not_found';
 END IF;
 definition:=replace(definition,
 $old$OR p_login->'scopes' IS DISTINCT FROM '["user.info.basic","video.publish"]'::JSONB$old$,
$new$OR (p_login->'scopes' IS DISTINCT FROM '["user.info.basic","video.publish"]'::JSONB
         AND p_login->'scopes' IS DISTINCT FROM '["user.info.basic","video.upload"]'::JSONB
         AND p_login->'scopes' IS DISTINCT FROM '["user.info.basic","video.publish","video.upload"]'::JSONB)$new$);
 definition:=replace(definition,
 $old$    v_access_expiry, v_refresh_expiry, ARRAY['user.info.basic','video.publish'], 'active'$old$,
 $new$    v_access_expiry, v_refresh_expiry,
    CASE WHEN p_login->'scopes'='["user.info.basic","video.upload"]'::jsonb THEN ARRAY['user.info.basic','video.upload']
         WHEN p_login->'scopes'='["user.info.basic","video.publish","video.upload"]'::jsonb THEN ARRAY['user.info.basic','video.publish','video.upload']
         ELSE ARRAY['user.info.basic','video.publish'] END, 'active'$new$);
 EXECUTE definition;

 SELECT pg_get_functiondef('public.transition_tiktok_publish_job(uuid,bigint,uuid,text,text,text,text)'::regprocedure) INTO definition;
 IF position($old$scopes @> ARRAY['user.info.basic','video.publish']::text[]$old$ in definition)=0 THEN
   RAISE EXCEPTION 'tiktok_publish_scope_contract_not_found';
 END IF;
 definition:=replace(definition,
 $old$scopes @> ARRAY['user.info.basic','video.publish']::text[]$old$,
 $new$(scopes @> ARRAY['user.info.basic','video.publish']::text[] OR scopes @> ARRAY['user.info.basic','video.upload']::text[])$new$);
 definition:=replace(definition,
 $old$(j.status='processing' AND p_next IN ('processing','published','failed','reconciliation_required'))$old$,
 $new$(j.status='processing' AND p_next IN ('processing','inbox_delivered','published','failed','reconciliation_required'))$new$);
 definition:=replace(definition,
 $old$IF p_next='published' AND p_provider_status IS DISTINCT FROM 'PUBLISH_COMPLETE' THEN RAISE EXCEPTION 'posting_provider_incomplete'; END IF;$old$,
 $new$IF p_next='published' AND p_provider_status IS DISTINCT FROM 'PUBLISH_COMPLETE' THEN RAISE EXCEPTION 'posting_provider_incomplete'; END IF;
 IF p_next='inbox_delivered' AND p_provider_status IS DISTINCT FROM 'SEND_TO_USER_INBOX' THEN RAISE EXCEPTION 'posting_provider_incomplete'; END IF;$new$);
 definition:=replace(definition,
 $old$completed_at=CASE WHEN p_next IN ('published','blocked','failed') THEN v_now ELSE NULL END,$old$,
 $new$completed_at=CASE WHEN p_next IN ('inbox_delivered','published','blocked','failed') THEN v_now ELSE NULL END,$new$);
 definition:=replace(definition,
 $old$j.status IN ('published','blocked','failed')$old$,
 $new$j.status IN ('inbox_delivered','published','blocked','failed')$new$);
 EXECUTE definition;
END $$;

REVOKE ALL ON FUNCTION public.persist_tiktok_login(text,text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.persist_tiktok_direct_post_upgrade(text,text,jsonb,uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.transition_tiktok_publish_job(uuid,bigint,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.persist_tiktok_login(text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_tiktok_direct_post_upgrade(text,text,jsonb,uuid,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_tiktok_publish_job(uuid,bigint,uuid,text,text,text,text) TO service_role;
COMMIT;
