BEGIN;

-- The PULL transition explicitly records a deterministic INIT rejection before
-- TikTok returns a publish_id. Keep that contractual error code admissible.
ALTER TABLE public.tiktok_publish_jobs
  DROP CONSTRAINT tiktok_publish_jobs_error_code_check;

ALTER TABLE public.tiktok_publish_jobs
  ADD CONSTRAINT tiktok_publish_jobs_error_code_check
  CHECK (error_code IN (
    'preflight_failed',
    'init_uncertain',
    'upload_uncertain',
    'lease_expired',
    'provider_failed',
    'persistence_uncertain',
    'init_provider_rejected'
  ));

COMMIT;
