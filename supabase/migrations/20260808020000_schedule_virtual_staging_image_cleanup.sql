-- New Virtual Staging inputs and results are temporary. This hourly job invokes
-- the internal cleanup Edge Function. Before applying, provision `project_url`
-- and `service_role_key` in Supabase Vault and deploy the function.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  existing_job_id BIGINT;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'virtual-staging-images-cleanup-hourly';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'virtual-staging-images-cleanup-hourly',
  '27 * * * *',
  $schedule$
    SELECT net.http_post(
      url := (
        SELECT decrypted_secret
        FROM vault.decrypted_secrets
        WHERE name = 'project_url'
      ) || '/functions/v1/virtual-staging-images-cleanup',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'service_role_key'
        )
      ),
      body := '{}'::jsonb
    );
  $schedule$
);
