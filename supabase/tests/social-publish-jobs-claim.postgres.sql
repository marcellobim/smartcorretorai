\set ON_ERROR_STOP on

-- Executar somente em banco local descartavel, depois das migrations do projeto.
CREATE EXTENSION IF NOT EXISTS dblink;

INSERT INTO public.profiles (id, nome, email, senha_hash)
VALUES (
  '10000000-0000-4000-8000-000000000091',
  'Social publish claim test',
  'social-publish-claim@example.test',
  'not-a-real-password-hash'
);

INSERT INTO public.social_connections (id, user_id, platform)
VALUES (
  '20000000-0000-4000-8000-000000000091',
  '10000000-0000-4000-8000-000000000091',
  'instagram'
);

SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);

CREATE TEMP TABLE social_publish_claim_fixture AS
SELECT job_id
  FROM public.create_or_reuse_social_publish_job(
    '10000000-0000-4000-8000-000000000091',
    '20000000-0000-4000-8000-000000000091',
    'instagram',
    '30000000-0000-4000-8000-000000000091',
    'hero_generation',
    '40000000-0000-4000-8000-000000000091',
    'Mesmo post'
  );

CREATE TABLE public.social_publish_claim_concurrency_results (
  worker TEXT PRIMARY KEY,
  job_id UUID NOT NULL,
  claim_token UUID NOT NULL
);

CREATE OR REPLACE FUNCTION public.test_claim_social_publish_job()
RETURNS TABLE(job_id UUID, claim_token UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'service_role', TRUE);
  RETURN QUERY
  SELECT claimed.job_id, claimed.worker_claim_token
    FROM public.claim_social_publish_job(
      (SELECT j.id
         FROM public.social_publish_jobs AS j
        WHERE j.user_id = '10000000-0000-4000-8000-000000000091'
          AND j.idempotency_key = '30000000-0000-4000-8000-000000000091'),
      300
    ) AS claimed;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_delay_social_publish_job_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.status = 'queued' AND NEW.status = 'processing' THEN
    PERFORM pg_catalog.pg_sleep(1);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER test_delay_social_publish_job_claim
  BEFORE UPDATE ON public.social_publish_jobs
  FOR EACH ROW EXECUTE FUNCTION public.test_delay_social_publish_job_claim();

-- 1. Dois claims realmente simultaneos: somente o vencedor retorna e persiste token.
SELECT dblink_connect('social_claim_c1', 'dbname=' || pg_catalog.current_database());
SELECT dblink_connect('social_claim_c2', 'dbname=' || pg_catalog.current_database());
SELECT dblink_send_query(
  'social_claim_c1',
  $q$INSERT INTO public.social_publish_claim_concurrency_results(worker, job_id, claim_token)
     SELECT 'first', job_id, claim_token FROM public.test_claim_social_publish_job()$q$
);
SELECT dblink_send_query(
  'social_claim_c2',
  $q$INSERT INTO public.social_publish_claim_concurrency_results(worker, job_id, claim_token)
     SELECT 'second', job_id, claim_token FROM public.test_claim_social_publish_job()$q$
);
SELECT * FROM dblink_get_result('social_claim_c1') AS t(status TEXT);
SELECT * FROM dblink_get_result('social_claim_c2') AS t(status TEXT);

DO $$
DECLARE
  v_job public.social_publish_jobs%ROWTYPE;
BEGIN
  SELECT j.* INTO STRICT v_job
    FROM public.social_publish_jobs AS j
   WHERE j.user_id = '10000000-0000-4000-8000-000000000091'
     AND j.idempotency_key = '30000000-0000-4000-8000-000000000091';

  IF (SELECT pg_catalog.count(*) FROM public.social_publish_claim_concurrency_results) <> 1 THEN
    RAISE EXCEPTION 'exactly one concurrent claim must win';
  END IF;
  IF v_job.claim_token IS DISTINCT FROM (
    SELECT claim_token FROM public.social_publish_claim_concurrency_results
  ) THEN
    RAISE EXCEPTION 'winning claim token was not persisted';
  END IF;
END;
$$;

SELECT dblink_disconnect('social_claim_c1');
SELECT dblink_disconnect('social_claim_c2');
DROP TRIGGER test_delay_social_publish_job_claim ON public.social_publish_jobs;

-- 2. Claim ainda ativo nao pode ser roubado.
DO $$
DECLARE
  v_job_id UUID := (SELECT job_id FROM social_publish_claim_fixture);
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.claim_social_publish_job(v_job_id, 300)) <> 0 THEN
    RAISE EXCEPTION 'active claim was stolen';
  END IF;
END;
$$;

-- 3. Claim expirado pode ser recuperado, gerando token novo.
DO $$
DECLARE
  v_job_id UUID := (SELECT job_id FROM social_publish_claim_fixture);
  v_old_token UUID;
  v_new_token UUID;
BEGIN
  SELECT claim_token INTO STRICT v_old_token
    FROM public.social_publish_jobs WHERE id = v_job_id;

  UPDATE public.social_publish_jobs
     SET claimed_at = pg_catalog.clock_timestamp() - INTERVAL '10 minutes',
         claim_expires_at = pg_catalog.clock_timestamp() - INTERVAL '1 second'
   WHERE id = v_job_id;

  SELECT worker_claim_token INTO STRICT v_new_token
    FROM public.claim_social_publish_job(v_job_id, 300);

  IF v_new_token = v_old_token THEN
    RAISE EXCEPTION 'expired claim reused its old token';
  END IF;
END;
$$;

-- 4. Token errado nao autoriza transicao.
DO $$
DECLARE
  v_job_id UUID := (SELECT job_id FROM social_publish_claim_fixture);
BEGIN
  IF (
    SELECT pg_catalog.count(*)
      FROM public.transition_claimed_social_publish_job(
        v_job_id,
        '50000000-0000-4000-8000-000000000091',
        'processing',
        'publishing'
      )
  ) <> 0 THEN
    RAISE EXCEPTION 'wrong token changed job state';
  END IF;
END;
$$;

-- 5. Estado esperado incompatível nao autoriza transicao.
DO $$
DECLARE
  v_job_id UUID := (SELECT job_id FROM social_publish_claim_fixture);
  v_claim_token UUID := (SELECT claim_token FROM public.social_publish_jobs WHERE id = v_job_id);
BEGIN
  IF (
    SELECT pg_catalog.count(*)
      FROM public.transition_claimed_social_publish_job(
        v_job_id,
        v_claim_token,
        'publishing',
        'published'
      )
  ) <> 0 THEN
    RAISE EXCEPTION 'unexpected source state changed job state';
  END IF;
END;
$$;

DROP FUNCTION public.test_delay_social_publish_job_claim();
DROP FUNCTION public.test_claim_social_publish_job();
DROP TABLE public.social_publish_claim_concurrency_results;
DELETE FROM public.social_publish_jobs
 WHERE user_id = '10000000-0000-4000-8000-000000000091';
DELETE FROM public.social_connections
 WHERE id = '20000000-0000-4000-8000-000000000091';
DELETE FROM public.profiles
 WHERE id = '10000000-0000-4000-8000-000000000091';

SELECT 'social_publish_jobs_claim_ok' AS result;
