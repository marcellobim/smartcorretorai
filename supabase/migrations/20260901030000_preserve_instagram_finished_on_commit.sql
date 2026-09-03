-- Preserve the provider FINISHED evidence while atomically guarding media_publish.
CREATE OR REPLACE FUNCTION public.begin_autonomous_social_publish(
  p_job_id UUID,
  p_claim_token UUID,
  p_external_container_id TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
DECLARE v_changed UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501'; END IF;
  UPDATE public.social_publish_jobs AS j
     SET status = 'publishing',
         external_publish_started_at = COALESCE(j.external_publish_started_at, v_now),
         external_commit_started_at = v_now,
         external_container_id = COALESCE(p_external_container_id, j.external_container_id),
         external_container_status = CASE
           WHEN j.platform = 'instagram' THEN j.external_container_status
           ELSE NULL
         END,
         updated_at = v_now
   WHERE j.id = p_job_id
     AND j.claim_token = p_claim_token
     AND j.claim_expires_at > v_now
     AND j.external_commit_started_at IS NULL
     AND (
       (j.platform = 'facebook' AND j.status IN ('queued', 'processing', 'retry_scheduled') AND p_external_container_id IS NULL)
       OR
       (j.platform = 'instagram' AND j.status = 'publishing' AND j.external_container_status = 'FINISHED'
         AND j.external_container_id = p_external_container_id)
     )
  RETURNING j.id INTO v_changed;
  RETURN v_changed IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.begin_autonomous_social_publish(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_autonomous_social_publish(UUID, UUID, TEXT) TO service_role;
CREATE OR REPLACE FUNCTION public.mark_social_external_commit_from_legacy_worker()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.external_commit_started_at IS NULL AND (
    (NEW.platform = 'facebook' AND NEW.status = 'publishing' AND NEW.external_publish_started_at IS NOT NULL)
    OR (NEW.status = 'reconciliation_required' AND OLD.status IS DISTINCT FROM 'reconciliation_required')
  ) THEN
    NEW.external_commit_started_at := pg_catalog.clock_timestamp();
  END IF;
  IF NEW.platform = 'instagram' AND NEW.status = 'published' AND NEW.external_post_id IS NOT NULL THEN
    NEW.external_container_status := 'FINISHED';
  END IF;
  RETURN NEW;
END;
$$;
UPDATE public.social_publish_jobs
   SET external_container_status = 'FINISHED'
 WHERE platform = 'instagram'
   AND status = 'published'
   AND external_post_id IS NOT NULL
   AND external_container_id IS NOT NULL
   AND external_container_status IS DISTINCT FROM 'FINISHED';
