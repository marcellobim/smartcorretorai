\set ON_ERROR_STOP on

-- Executar somente em banco local descartavel, depois das migrations do projeto.
CREATE EXTENSION IF NOT EXISTS dblink;

INSERT INTO public.profiles (id, nome, email, senha_hash)
VALUES (
  '10000000-0000-4000-8000-000000000090',
  'Social publish concurrency test',
  'social-publish-concurrency@example.test',
  'not-a-real-password-hash'
);

INSERT INTO public.social_connections (id, user_id, platform)
VALUES (
  '20000000-0000-4000-8000-000000000090',
  '10000000-0000-4000-8000-000000000090',
  'instagram'
);

CREATE TABLE public.social_publish_jobs_concurrency_results (
  worker TEXT PRIMARY KEY,
  job_id UUID NOT NULL
);

CREATE OR REPLACE FUNCTION public.test_create_social_publish_job()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.role', 'service_role', TRUE);
  SELECT job_id INTO STRICT v_job_id
    FROM public.create_or_reuse_social_publish_job(
      '10000000-0000-4000-8000-000000000090',
      '20000000-0000-4000-8000-000000000090',
      'instagram',
      '30000000-0000-4000-8000-000000000090',
      'hero_generation',
      '40000000-0000-4000-8000-000000000090',
      'Mesmo post'
    );
  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_delay_social_publish_job_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.idempotency_key = '30000000-0000-4000-8000-000000000090' THEN
    PERFORM pg_catalog.pg_sleep(1);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER test_delay_social_publish_job_insert
  BEFORE INSERT ON public.social_publish_jobs
  FOR EACH ROW EXECUTE FUNCTION public.test_delay_social_publish_job_insert();

SELECT dblink_connect('social_job_c1', 'dbname=' || pg_catalog.current_database());
SELECT dblink_connect('social_job_c2', 'dbname=' || pg_catalog.current_database());
SELECT dblink_send_query(
  'social_job_c1',
  $q$INSERT INTO public.social_publish_jobs_concurrency_results(worker, job_id)
     VALUES ('first', public.test_create_social_publish_job())$q$
);
SELECT dblink_send_query(
  'social_job_c2',
  $q$INSERT INTO public.social_publish_jobs_concurrency_results(worker, job_id)
     VALUES ('second', public.test_create_social_publish_job())$q$
);
SELECT * FROM dblink_get_result('social_job_c1') AS t(status TEXT);
SELECT * FROM dblink_get_result('social_job_c2') AS t(status TEXT);

DO $$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.social_publish_jobs_concurrency_results) <> 2 THEN
    RAISE EXCEPTION 'both concurrent creates must return a job';
  END IF;
  IF (SELECT pg_catalog.count(DISTINCT job_id) FROM public.social_publish_jobs_concurrency_results) <> 1 THEN
    RAISE EXCEPTION 'concurrent creates returned different jobs';
  END IF;
  IF (
    SELECT pg_catalog.count(*)
      FROM public.social_publish_jobs
     WHERE user_id = '10000000-0000-4000-8000-000000000090'
       AND idempotency_key = '30000000-0000-4000-8000-000000000090'
  ) <> 1 THEN
    RAISE EXCEPTION 'concurrent creates inserted duplicate jobs';
  END IF;
END;
$$;

SELECT dblink_disconnect('social_job_c1');
SELECT dblink_disconnect('social_job_c2');

DROP TRIGGER test_delay_social_publish_job_insert ON public.social_publish_jobs;
DROP FUNCTION public.test_delay_social_publish_job_insert();
DROP FUNCTION public.test_create_social_publish_job();
DROP TABLE public.social_publish_jobs_concurrency_results;
DELETE FROM public.social_publish_jobs
 WHERE user_id = '10000000-0000-4000-8000-000000000090';
DELETE FROM public.social_connections
 WHERE id = '20000000-0000-4000-8000-000000000090';
DELETE FROM public.profiles
 WHERE id = '10000000-0000-4000-8000-000000000090';

SELECT 'social_publish_jobs_concurrency_ok' AS result;
