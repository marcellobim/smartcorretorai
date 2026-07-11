-- Infraestrutura aditiva para workers concorrentes do Smart Video/Super Carrossel.
-- Preparada para deploy futuro; não altera contratos, RLS, bucket ou ownership.

ALTER TABLE public.video_jobs
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3 CHECK (max_attempts BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error_code TEXT;

CREATE INDEX IF NOT EXISTS idx_video_jobs_worker_claim
  ON public.video_jobs(status, lease_expires_at, created_at)
  WHERE mode IN ('smart_video', 'smart_carousel');

CREATE OR REPLACE FUNCTION public.claim_video_job(
  p_worker_id TEXT,
  p_lease_seconds INTEGER DEFAULT 120,
  p_job_id UUID DEFAULT NULL
)
RETURNS SETOF public.video_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.video_jobs%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;
  IF length(trim(coalesce(p_worker_id, ''))) < 3 OR p_lease_seconds NOT BETWEEN 30 AND 900 THEN
    RAISE EXCEPTION 'invalid_worker_claim';
  END IF;

  -- Jobs cujo processo morreu voltam à fila, sem ultrapassar o limite de tentativas.
  UPDATE public.video_jobs
     SET status = CASE WHEN attempt_count >= max_attempts THEN 'failed' ELSE 'queued' END,
         worker_id = NULL,
         lease_expires_at = NULL,
         heartbeat_at = NULL,
         error_message = CASE WHEN attempt_count >= max_attempts THEN 'worker_retry_limit_reached' ELSE error_message END,
         last_error_code = CASE WHEN attempt_count >= max_attempts THEN 'worker_retry_limit_reached' ELSE 'worker_lease_expired' END
   WHERE status IN ('processing', 'rendering')
     AND lease_expires_at < now();

  SELECT * INTO v_job
    FROM public.video_jobs
   WHERE mode IN ('smart_video', 'smart_carousel')
     AND status = 'queued'
     AND attempt_count < max_attempts
     AND (p_job_id IS NULL OR id = p_job_id)
   ORDER BY created_at ASC
   FOR UPDATE SKIP LOCKED
   LIMIT 1;

  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.video_jobs
     SET status = 'processing',
         worker_id = p_worker_id,
         lease_expires_at = now() + make_interval(secs => p_lease_seconds),
         heartbeat_at = now(),
         processing_started_at = coalesce(processing_started_at, now()),
         attempt_count = attempt_count + 1,
         error_message = NULL,
         last_error_code = NULL
   WHERE id = v_job.id
   RETURNING * INTO v_job;

  RETURN NEXT v_job;
END;
$$;

CREATE OR REPLACE FUNCTION public.heartbeat_video_job(p_job_id UUID, p_worker_id TEXT, p_lease_seconds INTEGER DEFAULT 120)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.video_jobs
     SET heartbeat_at = now(), lease_expires_at = now() + make_interval(secs => p_lease_seconds)
   WHERE id = p_job_id AND worker_id = p_worker_id AND status IN ('processing', 'rendering')
  RETURNING true;
$$;

CREATE OR REPLACE FUNCTION public.release_video_job(
  p_job_id UUID,
  p_worker_id TEXT,
  p_retryable BOOLEAN,
  p_error_code TEXT,
  p_error_message TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_updated BOOLEAN;
BEGIN
  UPDATE public.video_jobs
     SET status = CASE WHEN p_retryable AND attempt_count < max_attempts THEN 'queued' ELSE 'failed' END,
         worker_id = NULL, lease_expires_at = NULL, heartbeat_at = NULL,
         last_error_code = left(p_error_code, 100), error_message = left(p_error_message, 500)
   WHERE id = p_job_id AND worker_id = p_worker_id
  RETURNING true INTO v_updated;
  RETURN coalesce(v_updated, false);
END;
$$;

REVOKE ALL ON FUNCTION public.claim_video_job(TEXT, INTEGER, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.heartbeat_video_job(UUID, TEXT, INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_video_job(UUID, TEXT, BOOLEAN, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_video_job(TEXT, INTEGER, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.heartbeat_video_job(UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_video_job(UUID, TEXT, BOOLEAN, TEXT, TEXT) TO service_role;
