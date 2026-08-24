\set ON_ERROR_STOP on

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;

CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email_confirmed_at TIMESTAMPTZ,
  raw_user_meta_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE FUNCTION auth.uid()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::UUID
$$;

-- Simulate the safe frontend-first rollout window. Only the exact declaration
-- may be reconciled, using Auth's server timestamp.
INSERT INTO auth.users (id, raw_user_meta_data, created_at)
VALUES (
  '30000000-0000-4000-8000-000000000010',
  '{"legal_acceptance":{"accepted":true,"terms_version":"2026-08","privacy_version":"2026-08","context":"signup"}}'::JSONB,
  pg_catalog.now() - INTERVAL '10 seconds'
), (
  '30000000-0000-4000-8000-000000000011',
  '{}'::JSONB,
  pg_catalog.now() - INTERVAL '10 seconds'
);

\ir ../migrations/20260823050000_create_user_legal_acceptances.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.user_legal_acceptances
    WHERE user_id = '30000000-0000-4000-8000-000000000010'
      AND accepted_at < pg_catalog.now()
  ) THEN
    RAISE EXCEPTION 'explicit rollout-window acceptance was not reconciled';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_legal_acceptances
    WHERE user_id = '30000000-0000-4000-8000-000000000011'
  ) THEN
    RAISE EXCEPTION 'legacy user without declaration was backfilled';
  END IF;
END;
$$;

-- No checkbox/declaration: account may exist, but no acceptance is fabricated.
INSERT INTO auth.users (id, raw_user_meta_data)
VALUES ('30000000-0000-4000-8000-000000000001', '{}'::JSONB);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_legal_acceptances
    WHERE user_id = '30000000-0000-4000-8000-000000000001'
  ) THEN
    RAISE EXCEPTION 'acceptance was fabricated for a missing declaration';
  END IF;
END;
$$;

-- A real signup records the published pair even before email confirmation.
INSERT INTO auth.users (id, email_confirmed_at, raw_user_meta_data)
VALUES (
  '30000000-0000-4000-8000-000000000002',
  NULL,
  '{"legal_acceptance":{"accepted":true,"terms_version":"2026-08","privacy_version":"2026-08","context":"signup","accepted_at":"2000-01-01T00:00:00Z","user_id":"30000000-0000-4000-8000-000000000099"}}'::JSONB
);

DO $$
DECLARE
  v_row public.user_legal_acceptances%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_row
  FROM public.user_legal_acceptances
  WHERE user_id = '30000000-0000-4000-8000-000000000002';

  IF v_row.terms_version <> '2026-08' OR v_row.privacy_version <> '2026-08' THEN
    RAISE EXCEPTION 'wrong legal versions recorded';
  END IF;
  IF v_row.accepted_at < pg_catalog.now() - INTERVAL '1 minute' THEN
    RAISE EXCEPTION 'client timestamp was trusted';
  END IF;
  IF v_row.acceptance_context <> 'signup' THEN
    RAISE EXCEPTION 'wrong acceptance context';
  END IF;
END;
$$;

-- Invalid declared versions abort account creation and leave no orphan evidence.
DO $$
BEGIN
  BEGIN
    INSERT INTO auth.users (id, raw_user_meta_data)
    VALUES (
      '30000000-0000-4000-8000-000000000003',
      '{"legal_acceptance":{"accepted":true,"terms_version":"future-forged","privacy_version":"2026-08","context":"signup"}}'::JSONB
    );
    RAISE EXCEPTION 'invalid legal declaration was accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '30000000-0000-4000-8000-000000000003')
     OR EXISTS (SELECT 1 FROM public.user_legal_acceptances WHERE user_id = '30000000-0000-4000-8000-000000000003')
  THEN
    RAISE EXCEPTION 'failed signup left an orphan row';
  END IF;
END;
$$;

-- Duplicate pair is idempotent; a future version can coexist historically.
INSERT INTO public.user_legal_acceptances (user_id, terms_version, privacy_version, acceptance_context)
VALUES ('30000000-0000-4000-8000-000000000002', '2026-08', '2026-08', 'signup')
ON CONFLICT (user_id, terms_version, privacy_version) DO NOTHING;

INSERT INTO public.user_legal_acceptances (user_id, terms_version, privacy_version, acceptance_context)
VALUES ('30000000-0000-4000-8000-000000000002', '2026-09', '2026-08', 'signup');

DO $$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.user_legal_acceptances
      WHERE user_id = '30000000-0000-4000-8000-000000000002') <> 2 THEN
    RAISE EXCEPTION 'history or idempotency contract failed';
  END IF;
END;
$$;

-- Authenticated users can read only themselves and cannot forge or mutate evidence.
SET ROLE authenticated;
SELECT pg_catalog.set_config('request.jwt.claim.sub', '30000000-0000-4000-8000-000000000002', false);

DO $$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.user_legal_acceptances) <> 2 THEN
    RAISE EXCEPTION 'own acceptance history is not visible';
  END IF;

  BEGIN
    INSERT INTO public.user_legal_acceptances (user_id, terms_version, privacy_version, acceptance_context)
    VALUES ('30000000-0000-4000-8000-000000000001', '2026-08', '2026-08', 'signup');
    RAISE EXCEPTION 'user A forged acceptance for user B';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  BEGIN
    UPDATE public.user_legal_acceptances SET accepted_at = '2000-01-01'::TIMESTAMPTZ
    WHERE user_id = '30000000-0000-4000-8000-000000000002';
    RAISE EXCEPTION 'accepted_at was mutable';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;

RESET ROLE;

SELECT 'legal_acceptance_pg17_ok' AS result;
