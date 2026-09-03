\set ON_ERROR_STOP on

-- Executar somente em banco local descartavel, depois das migrations do projeto.
INSERT INTO public.profiles (id, nome, email, senha_hash)
VALUES
  ('10000000-0000-4000-8000-000000000092', 'Recovery owner', 'social-recovery-owner@example.test', 'not-a-real-password-hash'),
  ('10000000-0000-4000-8000-000000000093', 'Recovery stranger', 'social-recovery-stranger@example.test', 'not-a-real-password-hash');

INSERT INTO public.social_connections (id, user_id, platform, ig_username)
VALUES
  ('20000000-0000-4000-8000-000000000092', '10000000-0000-4000-8000-000000000092', 'instagram', 'broker_public'),
  ('20000000-0000-4000-8000-000000000093', '10000000-0000-4000-8000-000000000093', 'instagram', 'other_broker');

SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);

CREATE TEMP TABLE recovery_jobs AS
SELECT 'published'::TEXT AS fixture, job_id FROM public.create_or_reuse_social_publish_job(
  '10000000-0000-4000-8000-000000000092', '20000000-0000-4000-8000-000000000092',
  'instagram', '30000000-0000-4000-8000-000000000092', 'hero_generation',
  '40000000-0000-4000-8000-000000000092', 'Published post'
)
UNION ALL
SELECT 'failed', job_id FROM public.create_or_reuse_social_publish_job(
  '10000000-0000-4000-8000-000000000092', '20000000-0000-4000-8000-000000000092',
  'instagram', '30000000-0000-4000-8000-000000000093', 'hero_generation',
  '40000000-0000-4000-8000-000000000093', 'Failed post'
)
UNION ALL
SELECT 'processing', job_id FROM public.create_or_reuse_social_publish_job(
  '10000000-0000-4000-8000-000000000092', '20000000-0000-4000-8000-000000000092',
  'instagram', '30000000-0000-4000-8000-000000000094', 'hero_generation',
  '40000000-0000-4000-8000-000000000094', 'Processing post'
);

UPDATE public.social_publish_jobs
   SET status = 'published',
       external_publish_started_at = pg_catalog.clock_timestamp(),
       external_container_id = 'container-recovery-92',
       external_container_status = 'FINISHED',
       external_post_id = 'instagram-post-92',
       external_post_url = 'https://www.instagram.com/p/public-post-92/'
 WHERE id = (SELECT job_id FROM recovery_jobs WHERE fixture = 'published');

UPDATE public.social_publish_jobs
   SET status = 'failed',
       error_code = 'raw_provider_failure_must_not_escape'
 WHERE id = (SELECT job_id FROM recovery_jobs WHERE fixture = 'failed');

UPDATE public.social_publish_jobs
   SET status = 'processing',
       claim_token = '50000000-0000-4000-8000-000000000092',
       claimed_at = pg_catalog.clock_timestamp(),
       claim_expires_at = pg_catalog.clock_timestamp() + INTERVAL '5 minutes'
 WHERE id = (SELECT job_id FROM recovery_jobs WHERE fixture = 'processing');

CREATE TEMP TABLE recovery_before AS
SELECT * FROM public.social_publish_jobs
 WHERE user_id = '10000000-0000-4000-8000-000000000092';

-- 1. Owner correto recebe seu proprio job e conta social sanitizada.
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', false);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000092', false);
DO $$
DECLARE v_row RECORD;
BEGIN
  SELECT * INTO STRICT v_row FROM public.get_social_publish_job_recovery(
    (SELECT job_id FROM recovery_jobs WHERE fixture = 'published')
  );
  IF v_row.social_account <> 'broker_public' OR v_row.destination <> 'instagram' THEN
    RAISE EXCEPTION 'owner recovery returned wrong destination or account';
  END IF;
END;
$$;

-- 2. Outro usuario nao enxerga o job.
SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000093', false);
DO $$
BEGIN
  IF (
    SELECT pg_catalog.count(*) FROM public.get_social_publish_job_recovery(
      (SELECT job_id FROM recovery_jobs WHERE fixture = 'published')
    )
  ) <> 0 THEN
    RAISE EXCEPTION 'non-owner read another user job';
  END IF;
END;
$$;

SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000092', false);

-- 3. Job inexistente retorna conjunto vazio.
DO $$
BEGIN
  IF (
    SELECT pg_catalog.count(*) FROM public.get_social_publish_job_recovery(
      '60000000-0000-4000-8000-000000000092'
    )
  ) <> 0 THEN
    RAISE EXCEPTION 'missing job returned recovery data';
  END IF;
END;
$$;

-- 4. Published retorna id/link externos e status publico.
DO $$
DECLARE v_row RECORD;
BEGIN
  SELECT * INTO STRICT v_row FROM public.get_social_publish_job_recovery(
    (SELECT job_id FROM recovery_jobs WHERE fixture = 'published')
  );
  IF v_row.public_status <> 'published'
     OR v_row.external_post_id <> 'instagram-post-92'
     OR v_row.external_post_link <> 'https://www.instagram.com/p/public-post-92/'
     OR v_row.public_error_code IS NOT NULL THEN
    RAISE EXCEPTION 'published recovery contract mismatch';
  END IF;
END;
$$;

-- 5. Failed retorna somente erro publico allowlisted/fallback.
DO $$
DECLARE v_row RECORD;
BEGIN
  SELECT * INTO STRICT v_row FROM public.get_social_publish_job_recovery(
    (SELECT job_id FROM recovery_jobs WHERE fixture = 'failed')
  );
  IF v_row.public_status <> 'failed'
     OR v_row.public_error_code <> 'social_publish_failed'
     OR v_row.external_post_id IS NOT NULL
     OR v_row.external_post_link IS NOT NULL THEN
    RAISE EXCEPTION 'failed recovery leaked or mapped unsafe data';
  END IF;
END;
$$;

-- 6. Processing nao expoe token nem resultado externo.
DO $$
DECLARE v_row RECORD;
BEGIN
  SELECT * INTO STRICT v_row FROM public.get_social_publish_job_recovery(
    (SELECT job_id FROM recovery_jobs WHERE fixture = 'processing')
  );
  IF v_row.public_status <> 'processing'
     OR v_row.external_post_id IS NOT NULL
     OR v_row.external_post_link IS NOT NULL
     OR v_row.public_error_code IS NOT NULL THEN
    RAISE EXCEPTION 'processing recovery contract mismatch';
  END IF;
END;
$$;

-- 7. Todas as leituras anteriores preservam integralmente os jobs.
DO $$
BEGIN
  IF EXISTS (
    (SELECT * FROM recovery_before EXCEPT SELECT * FROM public.social_publish_jobs
      WHERE user_id = '10000000-0000-4000-8000-000000000092')
    UNION ALL
    (SELECT * FROM public.social_publish_jobs
      WHERE user_id = '10000000-0000-4000-8000-000000000092'
     EXCEPT SELECT * FROM recovery_before)
  ) THEN
    RAISE EXCEPTION 'recovery caused a job side effect';
  END IF;
END;
$$;

SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DELETE FROM public.social_publish_jobs
 WHERE user_id = '10000000-0000-4000-8000-000000000092';
DELETE FROM public.social_connections
 WHERE user_id IN ('10000000-0000-4000-8000-000000000092', '10000000-0000-4000-8000-000000000093');
DELETE FROM public.profiles
 WHERE id IN ('10000000-0000-4000-8000-000000000092', '10000000-0000-4000-8000-000000000093');

SELECT 'social_publish_jobs_recovery_ok' AS result;
