\set ON_ERROR_STOP on

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS dblink;
CREATE SCHEMA IF NOT EXISTS auth;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN CREATE ROLE service_role; END IF;
END $$;

CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT
LANGUAGE sql STABLE
AS $$ SELECT NULLIF(pg_catalog.current_setting('request.jwt.claim.role', TRUE), '') $$;

CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email_confirmed_at TIMESTAMPTZ NULL,
  last_sign_in_at TIMESTAMPTZ NULL
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  saldo_creditos BIGINT NOT NULL DEFAULT 0,
  creditos_expiram_em TIMESTAMPTZ NULL
);

CREATE TABLE public.credit_reservations (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID NULL,
  idempotency_key TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('reserved', 'consumed', 'cancelled')),
  reason TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  consumed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  UNIQUE(user_id, idempotency_key)
);

CREATE TABLE public.credit_lots (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('subscription', 'purchase', 'trial', 'admin', 'migration')),
  original_amount BIGINT NOT NULL CHECK (original_amount > 0),
  remaining_amount BIGINT NOT NULL CHECK (remaining_amount >= 0 AND remaining_amount <= original_amount),
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'expired', 'revoked')),
  idempotency_key TEXT NOT NULL,
  financial_reference TEXT NULL,
  subscription_id UUID NULL,
  stripe_invoice_id TEXT NULL,
  stripe_checkout_session_id TEXT NULL,
  catalog_version TEXT NULL,
  hidden_from_ui BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT credit_lots_trial_hidden_check CHECK (source <> 'trial' OR hidden_from_ui = TRUE),
  CONSTRAINT credit_lots_user_idempotency_unique UNIQUE(user_id, idempotency_key)
);

CREATE UNIQUE INDEX idx_credit_lots_stripe_invoice_unique
  ON public.credit_lots(stripe_invoice_id) WHERE stripe_invoice_id IS NOT NULL;
CREATE UNIQUE INDEX idx_credit_lots_stripe_checkout_unique
  ON public.credit_lots(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;

CREATE TABLE public.credit_reservation_allocations (
  reservation_id UUID NOT NULL REFERENCES public.credit_reservations(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.credit_lots(id) ON DELETE RESTRICT,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'consumed', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  consumed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  PRIMARY KEY(reservation_id, lot_id)
);

CREATE OR REPLACE FUNCTION public.sync_credit_balance_cache_from_lots(p_user_id UUID)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN RETURN 0; END; $$;

CREATE OR REPLACE FUNCTION public.expire_credit_lots_for_user(p_user_id UUID)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Nao autorizado' USING ERRCODE='42501'; END IF;
  RETURN 0;
END; $$;

\ir ../migrations/20260818010000_grant_stripe_credit_lot.sql
\ir ../migrations/20260823030000_create_confirmed_email_text_campaign_trial.sql

-- This account legitimately received v1 before the forward migration.
INSERT INTO auth.users(id) VALUES ('20000000-0000-4000-8000-000000000001');
UPDATE auth.users SET email_confirmed_at=pg_catalog.now() WHERE id='20000000-0000-4000-8000-000000000001';
INSERT INTO public.profiles(id) VALUES ('20000000-0000-4000-8000-000000000001');

\ir ../migrations/20260823040000_expand_confirmed_email_trial_to_200_st.sql

SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', FALSE);

-- Existing 25 ST trials are not topped up, replaced or duplicated.
UPDATE auth.users SET last_sign_in_at=pg_catalog.now(), email_confirmed_at=email_confirmed_at
 WHERE id='20000000-0000-4000-8000-000000000001';
DO $$ DECLARE v_lot public.credit_lots%ROWTYPE; BEGIN
  SELECT * INTO STRICT v_lot FROM public.credit_lots WHERE user_id='20000000-0000-4000-8000-000000000001';
  IF v_lot.original_amount <> 25 OR v_lot.remaining_amount <> 25
     OR v_lot.metadata->>'benefit_version' <> 'v1'
     OR (SELECT pg_catalog.count(*) FROM public.credit_lots WHERE user_id=v_lot.user_id) <> 1 THEN
    RAISE EXCEPTION 'v1 trial was retroactively changed';
  END IF;
END $$;

-- New unconfirmed accounts receive zero; the confirmation transition grants exactly 200 once.
INSERT INTO auth.users(id) VALUES ('20000000-0000-4000-8000-000000000002');
INSERT INTO public.profiles(id) VALUES ('20000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.credit_lots WHERE user_id='20000000-0000-4000-8000-000000000002') THEN
    RAISE EXCEPTION 'unconfirmed account received v2 trial';
  END IF;
END $$;
UPDATE auth.users SET email_confirmed_at=pg_catalog.now() WHERE id='20000000-0000-4000-8000-000000000002';
DO $$ DECLARE v_lot public.credit_lots%ROWTYPE; BEGIN
  SELECT * INTO STRICT v_lot FROM public.credit_lots WHERE user_id='20000000-0000-4000-8000-000000000002';
  IF v_lot.source <> 'trial' OR v_lot.original_amount <> 200 OR v_lot.remaining_amount <> 200
     OR v_lot.expires_at IS NOT NULL OR NOT v_lot.hidden_from_ui
     OR v_lot.metadata->>'benefit_version' <> 'v2' OR v_lot.metadata->>'smart_tokens' <> '200'
     OR (SELECT saldo_creditos FROM public.profiles WHERE id=v_lot.user_id) <> 200 THEN
    RAISE EXCEPTION 'invalid v2 trial lot';
  END IF;
END $$;
UPDATE auth.users SET email_confirmed_at=email_confirmed_at, last_sign_in_at=pg_catalog.now()
 WHERE id='20000000-0000-4000-8000-000000000002';
DO $$ BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.credit_lots WHERE user_id='20000000-0000-4000-8000-000000000002') <> 1 THEN
    RAISE EXCEPTION 'login replay duplicated v2 trial';
  END IF;
END $$;

-- Browser roles cannot forge identity, amount or catalog metadata.
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', FALSE);
DO $$ BEGIN
  BEGIN
    PERFORM public.reserve_credits_from_lots(
      '20000000-0000-4000-8000-000000000002',25,'browser-forgery',NULL,NULL,
      '{"product_code":"text_campaign","variant":"standard","smart_token_cost":25}'::jsonb
    );
    RAISE EXCEPTION 'authenticated browser reached private reservation RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', FALSE);

-- Gemini, Veo, Virtual Staging, real-estate banners and unknown SKUs fail closed.
DO $$ DECLARE v_sku TEXT; v_parts TEXT[]; BEGIN
  FOREACH v_sku IN ARRAY ARRAY[
    'real_estate_video:standard','real_estate_commercial:standard','creative_video:standard',
    'virtual_staging:image','real_estate_banner:item','unknown:standard'
  ] LOOP
    v_parts := pg_catalog.string_to_array(v_sku, ':');
    BEGIN
      PERFORM public.reserve_credits_from_lots(
        '20000000-0000-4000-8000-000000000002',1,'blocked:'||v_sku,NULL,NULL,
        pg_catalog.jsonb_build_object('product_code',v_parts[1],'variant',v_parts[2],'smart_token_cost',1)
      );
      RAISE EXCEPTION 'blocked SKU used trial: %', v_sku;
    EXCEPTION WHEN OTHERS THEN
      IF SQLERRM <> 'TRIAL_PRODUCT_NOT_ALLOWED' THEN RAISE; END IF;
    END;
  END LOOP;
  IF EXISTS (SELECT 1 FROM public.credit_reservations WHERE idempotency_key LIKE 'blocked:%') THEN
    RAISE EXCEPTION 'blocked SKU created a reservation';
  END IF;
END $$;

-- Forged cost, quantity and carousel shape do not enter the allowlist.
DO $$ BEGIN
  BEGIN
    PERFORM public.reserve_credits_from_lots(
      '20000000-0000-4000-8000-000000000002',1,'forged-text',NULL,NULL,
      '{"product_code":"text_campaign","variant":"standard","smart_token_cost":25}'::jsonb);
    RAISE EXCEPTION 'forged text cost succeeded';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'TRIAL_PRODUCT_NOT_ALLOWED' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.reserve_credits_from_lots(
      '20000000-0000-4000-8000-000000000002',45,'forged-banner',NULL,NULL,
      '{"product_code":"quick_banners","variant":"item","unit_cost":1,"item_count":1,"smart_token_cost":45}'::jsonb);
    RAISE EXCEPTION 'forged banner unit cost succeeded';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'TRIAL_PRODUCT_NOT_ALLOWED' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.reserve_credits_from_lots(
      '20000000-0000-4000-8000-000000000002',100,'forged-carousel',NULL,NULL,
      '{"product_code":"smart_carousel","image_count":4,"catalog_version":"test"}'::jsonb);
    RAISE EXCEPTION 'forged carousel shape succeeded';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'TRIAL_PRODUCT_NOT_ALLOWED' THEN RAISE; END IF; END;
END $$;

-- All three canonical products debit the shared 200 ST trial normally.
DO $$ DECLARE v_first UUID; v_replay UUID; BEGIN
  SELECT id INTO v_first FROM public.reserve_credits_from_lots(
    '20000000-0000-4000-8000-000000000002',25,'allowed-text',NULL,NULL,
    '{"product_code":"text_campaign","variant":"standard","smart_token_cost":25}'::jsonb);
  SELECT id INTO v_replay FROM public.reserve_credits_from_lots(
    '20000000-0000-4000-8000-000000000002',25,'allowed-text',NULL,NULL,
    '{"product_code":"text_campaign","variant":"standard","smart_token_cost":25}'::jsonb);
  IF v_first IS DISTINCT FROM v_replay THEN RAISE EXCEPTION 'text replay changed reservation'; END IF;

  PERFORM public.reserve_credits_from_lots(
    '20000000-0000-4000-8000-000000000002',45,'allowed-banner',NULL,NULL,
    '{"product_code":"quick_banners","variant":"item","unit_cost":45,"item_count":1,"smart_token_cost":45}'::jsonb);
  PERFORM public.reserve_credits_from_lots(
    '20000000-0000-4000-8000-000000000002',100,'allowed-carousel',NULL,NULL,
    '{"product_code":"smart_carousel","image_count":8,"catalog_version":"test-catalog"}'::jsonb);

  IF (SELECT remaining_amount FROM public.credit_lots WHERE user_id='20000000-0000-4000-8000-000000000002') <> 30 THEN
    RAISE EXCEPTION 'allowed products did not debit 170 ST exactly';
  END IF;
  BEGIN
    PERFORM public.reserve_credits_from_lots(
      '20000000-0000-4000-8000-000000000002',45,'insufficient-banner',NULL,NULL,
      '{"product_code":"quick_banners","variant":"item","unit_cost":45,"item_count":1,"smart_token_cost":45}'::jsonb);
    RAISE EXCEPTION 'insufficient trial funded another banner';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Creditos insuficientes para esta geracao.' THEN RAISE; END IF;
  END;
END $$;

-- Canonical quick-banner batches are quoted as item_count * 45.
INSERT INTO auth.users(id,email_confirmed_at) VALUES ('20000000-0000-4000-8000-000000000003',pg_catalog.now());
INSERT INTO public.profiles(id) VALUES ('20000000-0000-4000-8000-000000000003');
DO $$ BEGIN
  PERFORM public.reserve_credits_from_lots(
    '20000000-0000-4000-8000-000000000003',180,'allowed-banner-batch',NULL,NULL,
    '{"product_code":"quick_banners","variant":"item","unit_cost":45,"item_count":4,"smart_token_cost":180}'::jsonb);
  IF (SELECT remaining_amount FROM public.credit_lots WHERE user_id='20000000-0000-4000-8000-000000000003') <> 20 THEN
    RAISE EXCEPTION 'four-banner batch did not debit 180 ST';
  END IF;
END $$;

-- First confirmed purchase unlocks other SKUs and preserves unused trial as bonus.
INSERT INTO auth.users(id,email_confirmed_at) VALUES ('20000000-0000-4000-8000-000000000004',pg_catalog.now());
INSERT INTO public.profiles(id) VALUES ('20000000-0000-4000-8000-000000000004');
DO $$ DECLARE v_result TEXT; BEGIN
  SELECT result INTO v_result FROM public.grant_stripe_credit_lot(
    '20000000-0000-4000-8000-000000000004',20,'purchase',pg_catalog.now()+INTERVAL '30 days',
    'stripe-test-v2',NULL,'cs_test_trial_v2_purchase','{}'::jsonb);
  IF v_result <> 'created' THEN RAISE EXCEPTION 'purchase lot was not created'; END IF;
  SELECT result INTO v_result FROM public.grant_stripe_credit_lot(
    '20000000-0000-4000-8000-000000000004',20,'purchase',pg_catalog.now()+INTERVAL '30 days',
    'stripe-test-v2',NULL,'cs_test_trial_v2_purchase','{}'::jsonb);
  IF v_result <> 'already_processed' THEN RAISE EXCEPTION 'Stripe replay lost idempotency'; END IF;
  PERFORM public.reserve_credits_from_lots(
    '20000000-0000-4000-8000-000000000004',30,'paid-staging',NULL,NULL,
    '{"product_code":"virtual_staging","variant":"image","smart_token_cost":30}'::jsonb);
  IF (SELECT remaining_amount FROM public.credit_lots WHERE user_id='20000000-0000-4000-8000-000000000004' AND source='trial') <> 190 THEN
    RAISE EXCEPTION 'unused trial did not remain as paid-account bonus';
  END IF;
END $$;

-- A confirmed subscription independently unlocks the account, preserving FEFO.
INSERT INTO auth.users(id,email_confirmed_at) VALUES ('20000000-0000-4000-8000-000000000005',pg_catalog.now());
INSERT INTO public.profiles(id) VALUES ('20000000-0000-4000-8000-000000000005');
DO $$ BEGIN
  PERFORM public.grant_stripe_credit_lot(
    '20000000-0000-4000-8000-000000000005',40,'subscription',pg_catalog.now()+INTERVAL '30 days',
    'stripe-test-v2','in_test_trial_v2_subscription',NULL,'{}'::jsonb);
  PERFORM public.reserve_credits_from_lots(
    '20000000-0000-4000-8000-000000000005',30,'paid-banner',NULL,NULL,
    '{"product_code":"real_estate_banner","variant":"item","smart_token_cost":75}'::jsonb);
  IF (SELECT remaining_amount FROM public.credit_lots WHERE user_id='20000000-0000-4000-8000-000000000005' AND source='trial') <> 200 THEN
    RAISE EXCEPTION 'FEFO did not consume expiring subscription first';
  END IF;
END $$;

-- Concurrent confirmation updates serialize and still create one grant.
INSERT INTO auth.users(id) VALUES ('20000000-0000-4000-8000-000000000006');
INSERT INTO public.profiles(id) VALUES ('20000000-0000-4000-8000-000000000006');
SELECT dblink_connect('trial_g1','dbname='||pg_catalog.current_database());
SELECT dblink_connect('trial_g2','dbname='||pg_catalog.current_database());
SELECT dblink_send_query('trial_g1',$q$UPDATE auth.users SET email_confirmed_at=pg_catalog.now() WHERE id='20000000-0000-4000-8000-000000000006'$q$);
SELECT dblink_send_query('trial_g2',$q$UPDATE auth.users SET email_confirmed_at=pg_catalog.now() WHERE id='20000000-0000-4000-8000-000000000006'$q$);
SELECT * FROM dblink_get_result('trial_g1') AS t(status TEXT);
SELECT * FROM dblink_get_result('trial_g2') AS t(status TEXT);
DO $$ BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.credit_lots WHERE user_id='20000000-0000-4000-8000-000000000006') <> 1
     OR (SELECT original_amount FROM public.credit_lots WHERE user_id='20000000-0000-4000-8000-000000000006') <> 200 THEN
    RAISE EXCEPTION 'concurrent confirmation duplicated or corrupted grant';
  END IF;
END $$;
SELECT dblink_disconnect('trial_g1');
SELECT dblink_disconnect('trial_g2');

SELECT 'trial_200_st_forward_pg17_ok' AS result;
