\set ON_ERROR_STOP on

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;

CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT,
  email_confirmed_at TIMESTAMPTZ,
  raw_user_meta_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE TABLE auth.identities (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL
);

CREATE FUNCTION auth.uid()
RETURNS UUID LANGUAGE sql STABLE
AS $$ SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.sub', true), '')::UUID $$;

CREATE FUNCTION auth.jwt()
RETURNS JSONB LANGUAGE sql STABLE
AS $$ SELECT COALESCE(NULLIF(pg_catalog.current_setting('request.jwt.claims', true), ''), '{}')::JSONB $$;

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY,
  nome TEXT NOT NULL,
  full_name TEXT,
  email TEXT NOT NULL UNIQUE,
  senha_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  plano TEXT NOT NULL DEFAULT 'starter',
  avatar_url TEXT
);

CREATE TABLE public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE public.credit_reservations (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE
);

\ir ../migrations/20260823050000_create_user_legal_acceptances.sql
\ir ../migrations/20260824020000_prepare_google_oauth_onboarding.sql

INSERT INTO auth.users (id, email, email_confirmed_at, raw_user_meta_data)
VALUES (
  '40000000-0000-4000-8000-000000000001',
  'oauth@example.test',
  pg_catalog.now(),
  '{"name":"OAuth User","picture":"https://example.test/avatar.png"}'::JSONB
);
INSERT INTO auth.identities (user_id, provider)
VALUES ('40000000-0000-4000-8000-000000000001', 'google');

DO $$
DECLARE v_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO STRICT v_profile FROM public.profiles WHERE id = '40000000-0000-4000-8000-000000000001';
  IF v_profile.nome <> 'OAuth User' OR v_profile.full_name <> 'OAuth User'
     OR v_profile.avatar_url <> 'https://example.test/avatar.png'
     OR v_profile.senha_hash IS NOT NULL THEN
    RAISE EXCEPTION 'OAuth profile was not created safely';
  END IF;
END;
$$;

SELECT pg_catalog.set_config('request.jwt.claim.sub', '40000000-0000-4000-8000-000000000001', false);
SELECT pg_catalog.set_config(
  'request.jwt.claims',
  '{"sub":"40000000-0000-4000-8000-000000000001","app_metadata":{"provider":"google"},"amr":[{"method":"oauth","timestamp":1787529600}]}'::TEXT,
  false
);

SET ROLE authenticated;
DO $$ BEGIN
  IF public.get_auth_onboarding_state() <> 'needs_acceptance' THEN
    RAISE EXCEPTION 'new Google user bypassed legal onboarding';
  END IF;
END $$;
RESET ROLE;

DO $$
BEGIN
  BEGIN
    INSERT INTO public.credit_reservations (user_id, idempotency_key)
    VALUES ('40000000-0000-4000-8000-000000000001', 'before-acceptance');
    RAISE EXCEPTION 'Google user reserved credits before acceptance';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;

SET ROLE authenticated;
DO $$ BEGIN
  IF public.accept_current_legal_documents() IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'OAuth legal acceptance failed';
  END IF;
  IF public.get_auth_onboarding_state() <> 'accepted' THEN
    RAISE EXCEPTION 'accepted OAuth user remained blocked';
  END IF;
END $$;
RESET ROLE;

INSERT INTO public.credit_reservations (user_id, idempotency_key)
VALUES ('40000000-0000-4000-8000-000000000001', 'after-acceptance');

DO $$
BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.user_legal_acceptances
      WHERE user_id = '40000000-0000-4000-8000-000000000001'
        AND acceptance_context = 'oauth_onboarding') <> 1 THEN
    RAISE EXCEPTION 'OAuth acceptance evidence is missing or duplicated';
  END IF;
END;
$$;

INSERT INTO auth.users (id, email, raw_user_meta_data)
VALUES ('40000000-0000-4000-8000-000000000002', 'admin@example.test', '{"nome":"Admin"}'::JSONB);
INSERT INTO public.admin_users(user_id) VALUES ('40000000-0000-4000-8000-000000000002');

DO $$
BEGIN
  BEGIN
    INSERT INTO auth.identities (user_id, provider)
    VALUES ('40000000-0000-4000-8000-000000000002', 'google');
    RAISE EXCEPTION 'Admin received a Google identity';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;

  IF EXISTS (SELECT 1 FROM auth.identities WHERE user_id = '40000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'blocked Admin Google identity persisted';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = '40000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'traditional Admin profile was broken';
  END IF;
END;
$$;

SELECT 'google_oauth_onboarding_pg17_ok' AS result;
