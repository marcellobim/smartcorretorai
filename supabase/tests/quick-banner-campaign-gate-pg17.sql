\set ON_ERROR_STOP on

CREATE SCHEMA IF NOT EXISTS auth;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.role', TRUE), '') $$;

CREATE TABLE public.credit_reservations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  amount BIGINT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE public.quick_banner_delivery_requests (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  client_request_id UUID NOT NULL,
  claim_token UUID NOT NULL,
  reservation_id UUID NULL,
  status TEXT NOT NULL,
  admin_bypass BOOLEAN NOT NULL DEFAULT FALSE,
  smart_tokens_quoted BIGINT NOT NULL,
  smart_tokens_reserved BIGINT NOT NULL,
  UNIQUE (user_id, client_request_id)
);

\ir ../migrations/20260823010000_harden_quick_banner_campaign_provider_gate.sql

SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', FALSE);

INSERT INTO public.credit_reservations(id,user_id,amount,status) VALUES
  ('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',90,'reserved');
INSERT INTO public.quick_banner_delivery_requests(
  id,user_id,client_request_id,claim_token,reservation_id,status,smart_tokens_quoted,smart_tokens_reserved
) VALUES (
  '30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
  '10000000-0000-4000-8000-000000000001','prepared',90,90
);

DO $$
DECLARE v_claim RECORD;
BEGIN
  SELECT * INTO v_claim FROM public.claim_quick_banner_campaign_generation(
    '20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'
  );
  IF NOT v_claim.execution_claimed OR v_claim.generation_status <> 'processing' THEN
    RAISE EXCEPTION 'first claim was not atomic';
  END IF;
  SELECT * INTO v_claim FROM public.claim_quick_banner_campaign_generation(
    '20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'
  );
  IF v_claim.execution_claimed OR v_claim.generation_status <> 'processing' THEN
    RAISE EXCEPTION 'replay duplicated execution claim';
  END IF;
END $$;

DO $$
DECLARE v_result RECORD;
BEGIN
  SELECT * INTO v_result FROM public.complete_quick_banner_campaign_generation(
    '20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001',
    '{"status":200,"body":{"success":true}}'::jsonb
  );
  IF v_result.generation_status <> 'completed' OR v_result.generation_result->>'status' <> '200' THEN
    RAISE EXCEPTION 'completion was not persisted';
  END IF;
END $$;

INSERT INTO public.credit_reservations(id,user_id,amount,status) VALUES
  ('10000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',45,'cancelled');
INSERT INTO public.quick_banner_delivery_requests(
  id,user_id,client_request_id,claim_token,reservation_id,status,smart_tokens_quoted,smart_tokens_reserved
) VALUES (
  '30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000002','prepared',45,45
);

DO $$
BEGIN
  BEGIN
    PERFORM public.claim_quick_banner_campaign_generation(
      '20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002'
    );
    RAISE EXCEPTION 'cancelled reservation reached provider claim';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'cancelled reservation reached provider claim' THEN RAISE; END IF;
  END;
  IF (SELECT campaign_generation_status FROM public.quick_banner_delivery_requests WHERE client_request_id='40000000-0000-4000-8000-000000000002') <> 'pending' THEN
    RAISE EXCEPTION 'failed claim did not roll back';
  END IF;
END $$;

SELECT pg_catalog.set_config('request.jwt.claim.role', 'anon', FALSE);
DO $$
BEGIN
  BEGIN
    PERFORM public.claim_quick_banner_campaign_generation(
      '20000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001'
    );
    RAISE EXCEPTION 'anonymous role reached economic claim';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;

SELECT 'quick_banner_campaign_gate_pg17_ok' AS result;
