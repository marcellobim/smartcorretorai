BEGIN;

ALTER TABLE public.tiktok_publish_jobs
 ADD COLUMN provider_http_status integer CHECK (provider_http_status BETWEEN 100 AND 599),
 ADD COLUMN provider_error_code text CHECK (provider_error_code ~ '^[A-Za-z0-9_.-]{1,64}$'),
 ADD COLUMN provider_error_message text CHECK (provider_error_message IS NULL OR (length(provider_error_message) BETWEEN 1 AND 240 AND provider_error_message !~ '[[:cntrl:]]' AND provider_error_message !~* '(bearer|access[_ -]?token|refresh[_ -]?token|authorization|https?://|upload_url|open_id)')),
 ADD COLUMN provider_log_id text CHECK (provider_log_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 ADD COLUMN failure_stage text CHECK (failure_stage IS NULL OR failure_stage='init');

CREATE OR REPLACE FUNCTION public.tiktok_posting_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW) - ARRAY['publish_id','status','provider_status','provider_post_ids','init_attempts','upload_attempts','status_attempts','revision','claim_token','claim_expires_at','next_poll_at','init_started_at','upload_started_at','error_code','closure_reason','provider_http_status','provider_error_code','provider_error_message','provider_log_id','failure_stage','updated_at','completed_at'])
   IS DISTINCT FROM
   (to_jsonb(OLD) - ARRAY['publish_id','status','provider_status','provider_post_ids','init_attempts','upload_attempts','status_attempts','revision','claim_token','claim_expires_at','upload_started_at','next_poll_at','init_started_at','error_code','closure_reason','provider_http_status','provider_error_code','provider_error_message','provider_log_id','failure_stage','updated_at','completed_at'])
  THEN RAISE EXCEPTION 'posting_snapshot_immutable'; END IF;
  IF OLD.publish_id IS NOT NULL AND NEW.publish_id IS DISTINCT FROM OLD.publish_id THEN RAISE EXCEPTION 'posting_publish_id_immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION public.persist_tiktok_publish_init_diagnostic(
 p_id uuid,
 p_http_status integer,
 p_provider_error_code text,
 p_provider_error_message text,
 p_provider_log_id text
) RETURNS public.tiktok_publish_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE j public.tiktok_publish_jobs;
BEGIN
 IF p_http_status IS NULL OR p_provider_error_code IS NULL OR p_http_status NOT BETWEEN 100 AND 599 OR p_provider_error_code !~ '^[A-Za-z0-9_.-]{1,64}$' OR
    (p_provider_error_message IS NOT NULL AND (length(p_provider_error_message) NOT BETWEEN 1 AND 240 OR p_provider_error_message ~ '[[:cntrl:]]' OR p_provider_error_message ~* '(bearer|access[_ -]?token|refresh[_ -]?token|authorization|https?://|upload_url|open_id)')) OR
    (p_provider_log_id IS NOT NULL AND p_provider_log_id !~ '^[A-Za-z0-9_-]{1,128}$')
 THEN RAISE EXCEPTION 'posting_diagnostic_invalid'; END IF;
 UPDATE public.tiktok_publish_jobs SET
  provider_http_status=p_http_status,
  provider_error_code=p_provider_error_code,
  provider_error_message=coalesce(p_provider_error_message,provider_error_message),
  provider_log_id=coalesce(p_provider_log_id,provider_log_id),
  failure_stage='init',
  updated_at=clock_timestamp()
 WHERE id=p_id AND status='failed' AND error_code='init_provider_rejected' AND publish_id IS NULL
  AND init_attempts=1 AND upload_attempts=0
 RETURNING * INTO j;
 IF NOT FOUND THEN RAISE EXCEPTION 'posting_diagnostic_unavailable'; END IF;
 RETURN j;
END $$;

REVOKE ALL ON FUNCTION public.persist_tiktok_publish_init_diagnostic(uuid,integer,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.persist_tiktok_publish_init_diagnostic(uuid,integer,text,text,text) TO service_role;
COMMIT;
