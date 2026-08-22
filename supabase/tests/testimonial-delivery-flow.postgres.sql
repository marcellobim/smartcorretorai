\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id UUID PRIMARY KEY);
CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.role', true), '')
$$;
CREATE TABLE public.testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
);

\ir ../migrations/20260822020000_create_testimonial_delivery_flow.sql

INSERT INTO auth.users(id) VALUES
  ('11111111-1111-4111-8111-111111111111'),
  ('22222222-2222-4222-8222-222222222222');
INSERT INTO public.testimonials(id, user_id, body) VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', '11111111-1111-4111-8111-111111111111', 'Primeiro'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', '11111111-1111-4111-8111-111111111111', 'Segundo');

DO $$
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  BEGIN
    PERFORM public.claim_testimonial_email(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'received'
    );
    RAISE EXCEPTION 'authenticated role unexpectedly claimed email';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;

SELECT set_config('request.jwt.claim.role', 'service_role', false);

DO $$
BEGIN
  IF public.claim_testimonial_email(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'received'
  ) IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'first claim failed'; END IF;
  IF public.claim_testimonial_email(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'received'
  ) IS DISTINCT FROM FALSE THEN RAISE EXCEPTION 'active claim duplicated'; END IF;

  PERFORM public.complete_testimonial_email(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'received', TRUE, 'provider-1', NULL
  );
  IF public.claim_testimonial_email(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', 'received'
  ) IS DISTINCT FROM FALSE THEN RAISE EXCEPTION 'sent email reclaimed'; END IF;

  IF public.claim_testimonial_email(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bonus_granted'
  ) IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'bonus claim failed'; END IF;
  PERFORM public.complete_testimonial_email(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bonus_granted', FALSE, NULL, 'resend_delivery_failed'
  );
  IF public.claim_testimonial_email(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', 'bonus_granted'
  ) IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'failed email was not retryable'; END IF;
END;
$$;

DO $$
DECLARE
  v_attempts INTEGER;
BEGIN
  SELECT attempts INTO v_attempts
    FROM public.testimonial_email_deliveries
   WHERE testimonial_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
     AND template = 'bonus_granted';
  IF v_attempts <> 2 THEN RAISE EXCEPTION 'retry attempts expected 2, got %', v_attempts; END IF;
END;
$$;

UPDATE public.testimonials
   SET submission_idempotency_key = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
 WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';

DO $$
BEGIN
  BEGIN
    UPDATE public.testimonials
       SET submission_idempotency_key = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     WHERE id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2';
    RAISE EXCEPTION 'same-user idempotency key unexpectedly duplicated';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;
END;
$$;

INSERT INTO public.testimonials(user_id, body, submission_idempotency_key)
VALUES (
  '22222222-2222-4222-8222-222222222222',
  'Outro usuário pode usar a mesma chave',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
);

SELECT 'testimonial_delivery_flow_ok' AS result;
