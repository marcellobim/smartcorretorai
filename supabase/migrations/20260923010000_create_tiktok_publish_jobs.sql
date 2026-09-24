-- Phase A only. Never applied by this task.
BEGIN;
CREATE TABLE public.tiktok_publish_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 connection_id uuid NOT NULL,
 environment text NOT NULL CHECK(environment = 'sandbox'),
 app_id text NOT NULL CHECK(app_id ~ '^[0-9a-f]{64}$'),
 connection_open_id text NOT NULL,
 creation_id uuid NOT NULL REFERENCES public.video_jobs(id),
 product text NOT NULL DEFAULT 'studio_ia_commercial' CHECK(product = 'studio_ia_commercial'),
 bucket text NOT NULL DEFAULT 'studio-videos' CHECK(bucket = 'studio-videos'),
 object_path text NOT NULL,
 object_etag text,
 object_version text,
 content_sha256 text NOT NULL CHECK(content_sha256 ~ '^[0-9a-f]{64}$'),
 content_type text NOT NULL CHECK(content_type = 'video/mp4'),
 content_length bigint NOT NULL CHECK(content_length > 0 AND content_length <= 52428800),
 width integer NOT NULL CHECK(width BETWEEN 360 AND 4096),
 height integer NOT NULL CHECK(height BETWEEN 360 AND 4096),
 duration_ms integer NOT NULL CHECK(duration_ms > 0 AND duration_ms <= 600000),
 codec text NOT NULL CHECK(codec IN ('h264','hevc')),
 idempotency_key uuid NOT NULL,
 request_fingerprint text NOT NULL CHECK(request_fingerprint ~ '^[0-9a-f]{64}$'),
 confirmed_options jsonb NOT NULL,
 creator_info_snapshot jsonb NOT NULL,
 creator_info_checked_at timestamptz NOT NULL,
 confirmed_at timestamptz NOT NULL,
 consent_version text NOT NULL CHECK(consent_version = 'tiktok-commercial-v1'),
 publish_id text CHECK(publish_id ~ '^[A-Za-z0-9_.~:-]{1,64}$'),
 status text NOT NULL DEFAULT 'awaiting_confirmation' CHECK(status IN (
 'awaiting_confirmation','queued','initializing','uploading','processing',
 'published','blocked','failed','reconciliation_required')),
 provider_status text CHECK(provider_status IN ('PROCESSING_UPLOAD','PROCESSING_DOWNLOAD','PUBLISH_COMPLETE','FAILED')),
 provider_post_ids text[] NOT NULL DEFAULT '{}',
 init_attempts integer NOT NULL DEFAULT 0 CHECK(init_attempts BETWEEN 0 AND 1),
 upload_attempts integer NOT NULL DEFAULT 0 CHECK(upload_attempts BETWEEN 0 AND 1),
 status_attempts integer NOT NULL DEFAULT 0 CHECK(status_attempts >= 0),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision > 0),
 claim_token uuid,
 claim_expires_at timestamptz,
 next_poll_at timestamptz,
 init_started_at timestamptz,
 upload_started_at timestamptz,
 error_code text CHECK(error_code IN ('preflight_failed','init_uncertain','upload_uncertain','lease_expired','provider_failed','persistence_uncertain')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 completed_at timestamptz,
 CONSTRAINT tiktok_posting_identity_fk FOREIGN KEY(connection_id,user_id,environment,app_id,connection_open_id)
 REFERENCES public.tiktok_connections(id,user_id,environment,app_id,open_id),
 CONSTRAINT tiktok_posting_path CHECK(object_path = user_id::text || '/' || creation_id::text || '/video.mp4'),
 CONSTRAINT tiktok_posting_idempotency UNIQUE(user_id,environment,app_id,idempotency_key),
 CONSTRAINT tiktok_posting_claim_pair CHECK((claim_token IS NULL) = (claim_expires_at IS NULL)),
 CONSTRAINT tiktok_posting_publication_required CHECK(status NOT IN ('uploading','processing','published') OR publish_id IS NOT NULL),
 CONSTRAINT tiktok_posting_time_order CHECK(creator_info_checked_at <= confirmed_at AND confirmed_at <= created_at),
 CONSTRAINT tiktok_posting_terminal_time CHECK((status IN ('published','blocked','failed')) = (completed_at IS NOT NULL)),
 CONSTRAINT tiktok_posting_options CHECK(
 jsonb_typeof(confirmed_options)='object' AND
 confirmed_options ?& ARRAY['title','privacy_level','disable_comment','disable_duet','disable_stitch','brand_content_toggle','brand_organic_toggle','is_aigc'] AND
 confirmed_options - ARRAY['title','privacy_level','disable_comment','disable_duet','disable_stitch','brand_content_toggle','brand_organic_toggle','is_aigc'] = '{}'::jsonb AND
 jsonb_typeof(confirmed_options->'title')='string' AND length(confirmed_options->>'title') <= 2200 AND
 confirmed_options->>'privacy_level' IN ('PUBLIC_TO_EVERYONE','MUTUAL_FOLLOW_FRIENDS','FOLLOWER_OF_CREATOR','SELF_ONLY') AND
 jsonb_typeof(confirmed_options->'disable_comment')='boolean' AND
 jsonb_typeof(confirmed_options->'disable_duet')='boolean' AND
 jsonb_typeof(confirmed_options->'disable_stitch')='boolean' AND
 jsonb_typeof(confirmed_options->'brand_content_toggle')='boolean' AND
 jsonb_typeof(confirmed_options->'brand_organic_toggle')='boolean' AND
 confirmed_options->'is_aigc'='true'::jsonb),
 CONSTRAINT tiktok_posting_creator CHECK(jsonb_typeof(creator_info_snapshot)='object' AND
 creator_info_snapshot ?& ARRAY['privacy_level_options','comment_disabled','duet_disabled','stitch_disabled','max_video_post_duration_sec'] AND
 creator_info_snapshot - ARRAY['privacy_level_options','comment_disabled','duet_disabled','stitch_disabled','max_video_post_duration_sec'] = '{}'::jsonb AND
 jsonb_typeof(creator_info_snapshot->'privacy_level_options')='array' AND
 jsonb_typeof(creator_info_snapshot->'comment_disabled')='boolean' AND
 jsonb_typeof(creator_info_snapshot->'duet_disabled')='boolean' AND
 jsonb_typeof(creator_info_snapshot->'stitch_disabled')='boolean' AND
 jsonb_typeof(creator_info_snapshot->'max_video_post_duration_sec')='number' AND
 (creator_info_snapshot->>'max_video_post_duration_sec')::numeric > 0 AND
 creator_info_snapshot->'privacy_level_options' <@ '["PUBLIC_TO_EVERYONE","MUTUAL_FOLLOW_FRIENDS","FOLLOWER_OF_CREATOR","SELF_ONLY"]'::jsonb AND
 jsonb_array_length(creator_info_snapshot->'privacy_level_options') BETWEEN 1 AND 4)
);
CREATE UNIQUE INDEX tiktok_posting_publish_id ON public.tiktok_publish_jobs(environment,app_id,publish_id) WHERE publish_id IS NOT NULL;
CREATE UNIQUE INDEX tiktok_posting_active_creation ON public.tiktok_publish_jobs(creation_id,connection_id)
 WHERE status NOT IN ('published','blocked','failed');
ALTER TABLE public.tiktok_publish_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tiktok_publish_jobs FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON TABLE public.tiktok_publish_jobs TO service_role;

-- All writes go through service-only security definer RPCs. No direct frontend/table writes.
CREATE FUNCTION public.tiktok_posting_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF (to_jsonb(NEW) - ARRAY['publish_id','status','provider_status','provider_post_ids','init_attempts','upload_attempts','status_attempts','revision','claim_token','claim_expires_at','next_poll_at','init_started_at','upload_started_at','error_code','updated_at','completed_at'])
   IS DISTINCT FROM
   (to_jsonb(OLD) - ARRAY['publish_id','status','provider_status','provider_post_ids','init_attempts','upload_attempts','status_attempts','revision','claim_token','claim_expires_at','next_poll_at','init_started_at','upload_started_at','error_code','updated_at','completed_at'])
  THEN RAISE EXCEPTION 'posting_snapshot_immutable'; END IF;
  IF OLD.publish_id IS NOT NULL AND NEW.publish_id IS DISTINCT FROM OLD.publish_id THEN RAISE EXCEPTION 'posting_publish_id_immutable'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tiktok_posting_immutable BEFORE UPDATE ON public.tiktok_publish_jobs FOR EACH ROW EXECUTE FUNCTION public.tiktok_posting_guard();

CREATE FUNCTION public.create_tiktok_publish_job(p_job jsonb) RETURNS public.tiktok_publish_jobs
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
 AND mode='dynamic_reel' AND output_video_path=j.object_path FOR SHARE;
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

CREATE FUNCTION public.claim_tiktok_publish_job(p_id uuid,p_revision bigint) RETURNS public.tiktok_publish_jobs
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE j public.tiktok_publish_jobs; v_now timestamptz:=clock_timestamp();
BEGIN
 SELECT * INTO j FROM public.tiktok_publish_jobs WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR j.revision IS DISTINCT FROM p_revision OR j.status IN ('published','blocked','failed') OR
 (j.claim_expires_at IS NOT NULL AND j.claim_expires_at>v_now) THEN RAISE EXCEPTION 'posting_cas_conflict'; END IF;
 UPDATE public.tiktok_publish_jobs SET
 status=CASE WHEN status IN ('initializing','uploading') THEN 'reconciliation_required' ELSE status END,
 error_code=CASE WHEN status IN ('initializing','uploading') THEN 'lease_expired' ELSE error_code END,
 claim_token=gen_random_uuid(),claim_expires_at=v_now+interval '120 seconds',revision=revision+1,updated_at=v_now
 WHERE id=p_id RETURNING * INTO j;
 RETURN j;
END $$;

CREATE FUNCTION public.transition_tiktok_publish_job(p_id uuid,p_revision bigint,p_claim uuid,p_next text,p_publish_id text DEFAULT NULL,p_provider_status text DEFAULT NULL,p_error_code text DEFAULT NULL)
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
  NOT EXISTS(SELECT 1 FROM public.tiktok_connections WHERE id=j.connection_id AND user_id=j.user_id AND
  environment=j.environment AND app_id=j.app_id AND connection_status='active' AND
  scopes @> ARRAY['user.info.basic','video.publish']::text[] AND access_token_expires_at>v_now+interval '2 minutes')
  THEN RAISE EXCEPTION 'posting_not_ready'; END IF;
 END IF;
 IF p_publish_id IS NOT NULL AND NOT (j.status='initializing' AND p_next='uploading') THEN RAISE EXCEPTION 'posting_publish_id_unexpected'; END IF;
 IF p_next='uploading' AND (p_publish_id IS NULL OR j.upload_attempts<>0) THEN RAISE EXCEPTION 'posting_publish_id_required'; END IF;
 IF p_next='published' AND p_provider_status IS DISTINCT FROM 'PUBLISH_COMPLETE' THEN RAISE EXCEPTION 'posting_provider_incomplete'; END IF;
 IF p_next='failed' AND p_provider_status IS DISTINCT FROM 'FAILED' THEN RAISE EXCEPTION 'posting_failure_unconfirmed'; END IF;
 UPDATE public.tiktok_publish_jobs SET status=p_next,
 publish_id=coalesce(publish_id,p_publish_id),provider_status=coalesce(p_provider_status,provider_status),error_code=p_error_code,
 init_attempts=init_attempts+CASE WHEN p_next='initializing' THEN 1 ELSE 0 END,
 upload_attempts=upload_attempts+CASE WHEN p_next='uploading' THEN 1 ELSE 0 END,
 status_attempts=status_attempts+CASE WHEN j.status IN ('processing','reconciliation_required') THEN 1 ELSE 0 END,
 init_started_at=CASE WHEN p_next='initializing' THEN v_now ELSE init_started_at END,
 upload_started_at=CASE WHEN p_next='uploading' THEN v_now ELSE upload_started_at END,
 next_poll_at=CASE WHEN p_next IN ('processing','reconciliation_required') THEN v_now+interval '10 seconds' ELSE NULL END,
 completed_at=CASE WHEN p_next IN ('published','blocked','failed') THEN v_now ELSE NULL END,
 revision=revision+1,updated_at=v_now WHERE id=p_id RETURNING * INTO j;
 RETURN j;
END $$;
REVOKE ALL ON FUNCTION public.tiktok_posting_guard() FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.create_tiktok_publish_job(jsonb) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.claim_tiktok_publish_job(uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.transition_tiktok_publish_job(uuid,bigint,uuid,text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.create_tiktok_publish_job(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_tiktok_publish_job(uuid,bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.transition_tiktok_publish_job(uuid,bigint,uuid,text,text,text,text) TO service_role;
COMMIT;