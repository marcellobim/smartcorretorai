\set ON_ERROR_STOP on

-- Executar somente em banco local descartavel, depois das migrations do projeto.
INSERT INTO public.profiles (id, nome, email, senha_hash)
VALUES
  ('10000000-0000-4000-8000-000000000095', 'Caption owner', 'caption-owner@example.test', 'not-a-real-password-hash'),
  ('10000000-0000-4000-8000-000000000096', 'Caption stranger', 'caption-stranger@example.test', 'not-a-real-password-hash');

INSERT INTO public.properties (
  id, user_id, titulo, tipo, finalidade, preco, bairro, cidade, estado
) VALUES (
  '70000000-0000-4000-8000-000000000095',
  '10000000-0000-4000-8000-000000000095',
  'Imovel snapshot', 'Apartamento', 'Venda', 500000, 'Centro', 'Sao Paulo', 'SP'
);

INSERT INTO public.hero_generations (id, user_id, property_id, status, texts)
VALUES (
  '40000000-0000-4000-8000-000000000095',
  '10000000-0000-4000-8000-000000000095',
  '70000000-0000-4000-8000-000000000095',
  'completed',
  '{"caption":"  Legenda confirmada pelo usuario  "}'::jsonb
);

INSERT INTO public.social_connections (id, user_id, platform, ig_username)
VALUES
  ('20000000-0000-4000-8000-000000000095', '10000000-0000-4000-8000-000000000095', 'instagram', 'caption_owner'),
  ('20000000-0000-4000-8000-000000000096', '10000000-0000-4000-8000-000000000096', 'instagram', 'caption_stranger');

SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);

CREATE TEMP TABLE caption_cancel_jobs AS
SELECT 'caption'::TEXT AS fixture, job_id FROM public.create_or_reuse_social_publish_job(
  '10000000-0000-4000-8000-000000000095', '20000000-0000-4000-8000-000000000095',
  'instagram', '30000000-0000-4000-8000-000000000095', 'hero_generation',
  '40000000-0000-4000-8000-000000000095',
  (SELECT texts->>'caption' FROM public.hero_generations WHERE id = '40000000-0000-4000-8000-000000000095')
)
UNION ALL
SELECT 'queued', job_id FROM public.create_or_reuse_social_publish_job(
  '10000000-0000-4000-8000-000000000095', '20000000-0000-4000-8000-000000000095',
  'instagram', '30000000-0000-4000-8000-000000000096', 'hero_generation',
  '40000000-0000-4000-8000-000000000095', 'Queued caption'
)
UNION ALL
SELECT 'processing', job_id FROM public.create_or_reuse_social_publish_job(
  '10000000-0000-4000-8000-000000000095', '20000000-0000-4000-8000-000000000095',
  'instagram', '30000000-0000-4000-8000-000000000097', 'hero_generation',
  '40000000-0000-4000-8000-000000000095', 'Processing caption'
)
UNION ALL
SELECT 'publishing', job_id FROM public.create_or_reuse_social_publish_job(
  '10000000-0000-4000-8000-000000000095', '20000000-0000-4000-8000-000000000095',
  'instagram', '30000000-0000-4000-8000-000000000098', 'hero_generation',
  '40000000-0000-4000-8000-000000000095', 'Publishing caption'
)
UNION ALL
SELECT 'published', job_id FROM public.create_or_reuse_social_publish_job(
  '10000000-0000-4000-8000-000000000095', '20000000-0000-4000-8000-000000000095',
  'instagram', '30000000-0000-4000-8000-000000000099', 'hero_generation',
  '40000000-0000-4000-8000-000000000095', 'Published caption'
)
UNION ALL
SELECT 'other_owner', job_id FROM public.create_or_reuse_social_publish_job(
  '10000000-0000-4000-8000-000000000095', '20000000-0000-4000-8000-000000000095',
  'instagram', '30000000-0000-4000-8000-000000000100', 'hero_generation',
  '40000000-0000-4000-8000-000000000095', 'Owner-only cancellation'
);

-- Prepara processing, publishing e published somente pelas RPCs de worker.
SELECT * FROM public.claim_social_publish_job(
  (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'processing'), 300
);

CREATE TEMP TABLE publishing_claim AS
SELECT * FROM public.claim_social_publish_job(
  (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'publishing'), 300
);
INSERT INTO public.social_media_leases(
  id, job_id, user_id, bucket_id, object_path, content_type, content_length,
  opaque_token_hash, status, expires_at
) VALUES (
  '80000000-0000-4000-8000-000000000098',
  (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'publishing'),
  '10000000-0000-4000-8000-000000000095',
  'private-media', '10000000-0000-4000-8000-000000000095/jobs/publishing.jpg',
  'image/jpeg', 12345, pg_catalog.repeat('a', 64), 'active', pg_catalog.now() + INTERVAL '24 hours'
);
SELECT * FROM public.start_social_publish_job_container_polling(
  (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'publishing'),
  (SELECT worker_claim_token FROM publishing_claim),
  'container-publishing-95',
  pg_catalog.clock_timestamp() + INTERVAL '1 second',
  '80000000-0000-4000-8000-000000000098', 3600
);

CREATE TEMP TABLE published_claim AS
SELECT * FROM public.claim_social_publish_job(
  (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'published'), 300
);

INSERT INTO public.social_media_leases(
  id, job_id, user_id, bucket_id, object_path, content_type, content_length,
  opaque_token_hash, status, expires_at
) VALUES (
    '80000000-0000-4000-8000-000000000099',
    (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'published'),
    '10000000-0000-4000-8000-000000000095',
    'private-media', '10000000-0000-4000-8000-000000000095/jobs/published.jpg',
    'image/jpeg', 12345, pg_catalog.repeat('b', 64), 'active', pg_catalog.now() + INTERVAL '24 hours'
  );

SELECT * FROM public.start_social_publish_job_container_polling(
  (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'published'),
  (SELECT worker_claim_token FROM published_claim),
  'container-published-95',
  pg_catalog.clock_timestamp() + INTERVAL '1 second',
  '80000000-0000-4000-8000-000000000099', 3600
);
SELECT * FROM public.record_social_publish_job_poll_result(
  (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'published'),
  (SELECT worker_claim_token FROM published_claim),
  'publishing', 'container-published-95', 'FINISHED', NULL
);
SELECT * FROM public.transition_claimed_social_publish_job(
  (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'published'),
  (SELECT worker_claim_token FROM published_claim), 'publishing', 'published'
);

SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', false);
SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000095', false);

-- 1. Snapshot preserva exatamente espacos e conteudo confirmados.
DO $$
DECLARE v_caption TEXT;
BEGIN
  BEGIN
    UPDATE public.social_publish_jobs
       SET caption_snapshot = 'mutated snapshot'
     WHERE id = (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'caption');
    RAISE EXCEPTION 'caption snapshot mutation was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  SELECT caption_snapshot INTO STRICT v_caption
    FROM public.get_social_publish_job_recovery(
      (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'caption')
    );
  IF v_caption <> '  Legenda confirmada pelo usuario  ' THEN
    RAISE EXCEPTION 'caption snapshot was not preserved exactly';
  END IF;
END;
$$;

-- 2. Alterar o texto original nao modifica o snapshot persistido no job.
UPDATE public.hero_generations
   SET texts = '{"caption":"Texto original alterado depois"}'::jsonb
 WHERE id = '40000000-0000-4000-8000-000000000095';
DO $$
DECLARE v_caption TEXT;
BEGIN
  SELECT caption_snapshot INTO STRICT v_caption
    FROM public.get_social_publish_job_recovery(
      (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'caption')
    );
  IF v_caption <> '  Legenda confirmada pelo usuario  ' THEN
    RAISE EXCEPTION 'source text mutation changed caption snapshot';
  END IF;
END;
$$;

-- 3. Queued pode cancelar.
DO $$
DECLARE v_status TEXT;
BEGIN
  SELECT job_status INTO STRICT v_status FROM public.cancel_social_publish_job(
    (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'queued'), 'queued'
  );
  IF v_status <> 'cancelled' THEN RAISE EXCEPTION 'queued cancellation failed'; END IF;
END;
$$;

-- 4. Processing sem efeito externo pode cancelar e invalida o lease.
DO $$
DECLARE v_job public.social_publish_jobs%ROWTYPE;
BEGIN
  PERFORM * FROM public.cancel_social_publish_job(
    (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'processing'), 'processing'
  );
  SELECT j.* INTO STRICT v_job FROM public.social_publish_jobs AS j
   WHERE j.id = (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'processing');
  IF v_job.status <> 'cancelled' OR v_job.claim_token IS NOT NULL THEN
    RAISE EXCEPTION 'safe processing cancellation failed';
  END IF;
END;
$$;

-- 5. Publishing/inicio irreversivel bloqueia cancelamento simples.
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.cancel_social_publish_job(
      (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'publishing'), 'publishing'
    );
    RAISE EXCEPTION 'irreversible publishing cancellation was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  IF (SELECT status FROM public.social_publish_jobs WHERE id =
    (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'publishing')) <> 'publishing' THEN
    RAISE EXCEPTION 'publishing state changed during blocked cancellation';
  END IF;
END;
$$;

-- 6. Published e terminal e nao cancela.
DO $$
BEGIN
  BEGIN
    PERFORM * FROM public.cancel_social_publish_job(
      (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'published'), 'published'
    );
    RAISE EXCEPTION 'published cancellation was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;
  IF (SELECT status FROM public.social_publish_jobs WHERE id =
    (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'published')) <> 'published' THEN
    RAISE EXCEPTION 'published terminal state changed';
  END IF;
END;
$$;

-- 7. Outro usuario nao cancela job do owner.
SELECT pg_catalog.set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000096', false);
DO $$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.cancel_social_publish_job(
    (SELECT job_id FROM caption_cancel_jobs WHERE fixture = 'other_owner'), 'queued'
  )) <> 0 THEN
    RAISE EXCEPTION 'non-owner cancelled another user job';
  END IF;
END;
$$;

SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
DELETE FROM public.social_publish_jobs
 WHERE user_id = '10000000-0000-4000-8000-000000000095';
DELETE FROM public.social_connections
 WHERE user_id IN ('10000000-0000-4000-8000-000000000095', '10000000-0000-4000-8000-000000000096');
DELETE FROM public.hero_generations WHERE id = '40000000-0000-4000-8000-000000000095';
DELETE FROM public.properties WHERE id = '70000000-0000-4000-8000-000000000095';
DELETE FROM public.profiles
 WHERE id IN ('10000000-0000-4000-8000-000000000095', '10000000-0000-4000-8000-000000000096');

SELECT 'social_publish_jobs_caption_cancel_ok' AS result;
