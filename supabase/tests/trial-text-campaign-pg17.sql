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

SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', FALSE);

-- Unconfirmed accounts receive nothing; confirmation grants exactly once.
INSERT INTO auth.users(id) VALUES ('10000000-0000-4000-8000-000000000001');
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.credit_lots WHERE user_id='10000000-0000-4000-8000-000000000001') THEN
    RAISE EXCEPTION 'unconfirmed account received trial';
  END IF;
END $$;

UPDATE auth.users SET email_confirmed_at=pg_catalog.now() WHERE id='10000000-0000-4000-8000-000000000001';
INSERT INTO public.profiles(id) VALUES ('10000000-0000-4000-8000-000000000001');

DO $$ DECLARE v_lot public.credit_lots%ROWTYPE; BEGIN
  SELECT * INTO STRICT v_lot FROM public.credit_lots WHERE user_id='10000000-0000-4000-8000-000000000001';
  IF v_lot.source <> 'trial' OR v_lot.original_amount <> 25 OR v_lot.remaining_amount <> 25
     OR v_lot.expires_at IS NOT NULL OR NOT v_lot.hidden_from_ui
     OR v_lot.metadata->>'benefit_version' <> 'v1' THEN
    RAISE EXCEPTION 'invalid confirmed-email trial lot';
  END IF;
  IF (SELECT saldo_creditos FROM public.profiles WHERE id=v_lot.user_id) <> 25 THEN
    RAISE EXCEPTION 'profile did not receive combined trial balance';
  END IF;
END $$;

UPDATE auth.users SET email_confirmed_at=email_confirmed_at, last_sign_in_at=pg_catalog.now()
 WHERE id='10000000-0000-4000-8000-000000000001';
DO $$ BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.credit_lots WHERE user_id='10000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'login or confirmation replay duplicated trial';
  END IF;
  BEGIN
    INSERT INTO public.credit_lots(user_id,source,original_amount,remaining_amount,status,idempotency_key,hidden_from_ui)
    VALUES('10000000-0000-4000-8000-000000000001','trial',25,25,'active','trial:other',TRUE);
    RAISE EXCEPTION 'second trial lot bypassed unique protection';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END $$;

-- Browser roles cannot call the financial barrier or forge another user/amount.
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', FALSE);
DO $$ BEGIN
  BEGIN
    PERFORM public.reserve_credits_from_lots(
      '10000000-0000-4000-8000-000000000001',1,'browser-forgery',NULL,NULL,
      '{"product_code":"text_campaign","variant":"standard","smart_token_cost":25}'::jsonb
    );
    RAISE EXCEPTION 'authenticated browser reached private reservation RPC';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', FALSE);

-- Every non-allowlisted current SKU is blocked even if a forged cost is only 1 ST.
DO $$ DECLARE v_sku TEXT; v_parts TEXT[]; BEGIN
  FOREACH v_sku IN ARRAY ARRAY[
    'real_estate_video:standard','life_in_property:standard','broker_presentation:standard',
    'short_videos:standard','real_estate_commercial:standard','creative_video:standard',
    'real_estate_banner:item','quick_banners:item','virtual_staging:image','smart_carousel:standard'
  ] LOOP
    v_parts := pg_catalog.string_to_array(v_sku, ':');
    BEGIN
      PERFORM public.reserve_credits_from_lots(
        '10000000-0000-4000-8000-000000000001',1,'blocked:'||v_sku,NULL,NULL,
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

-- Product, variant, declared cost and amount are all exact for trial use.
DO $$ BEGIN
  BEGIN
    PERFORM public.reserve_credits_from_lots(
      '10000000-0000-4000-8000-000000000001',1,'forged-amount',NULL,NULL,
      '{"product_code":"text_campaign","variant":"standard","smart_token_cost":25}'::jsonb
    );
    RAISE EXCEPTION 'forged trial amount succeeded';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'TRIAL_PRODUCT_NOT_ALLOWED' THEN RAISE; END IF; END;
  BEGIN
    PERFORM public.reserve_credits_from_lots(
      '10000000-0000-4000-8000-000000000001',25,'forged-price',NULL,NULL,
      '{"product_code":"text_campaign","variant":"standard","smart_token_cost":1}'::jsonb
    );
    RAISE EXCEPTION 'forged trial price succeeded';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'TRIAL_PRODUCT_NOT_ALLOWED' THEN RAISE; END IF; END;
END $$;

-- The one allowed campaign reserves exactly 25, is replay-safe, and then is exhausted.
DO $$ DECLARE v_first UUID; v_replay UUID; BEGIN
  SELECT id INTO v_first FROM public.reserve_credits_from_lots(
    '10000000-0000-4000-8000-000000000001',25,'trial-text-campaign',NULL,'text_campaign:standard',
    '{"product_code":"text_campaign","variant":"standard","smart_token_cost":25}'::jsonb
  );
  SELECT id INTO v_replay FROM public.reserve_credits_from_lots(
    '10000000-0000-4000-8000-000000000001',25,'trial-text-campaign',NULL,'text_campaign:standard',
    '{"product_code":"text_campaign","variant":"standard","smart_token_cost":25}'::jsonb
  );
  IF v_first IS DISTINCT FROM v_replay THEN RAISE EXCEPTION 'reservation replay changed identity'; END IF;
  IF (SELECT pg_catalog.count(*) FROM public.credit_reservations WHERE idempotency_key='trial-text-campaign') <> 1 THEN
    RAISE EXCEPTION 'reservation replay duplicated row';
  END IF;
  IF (SELECT COALESCE(pg_catalog.sum(amount),0) FROM public.credit_reservation_allocations WHERE reservation_id=v_first) <> 25 THEN
    RAISE EXCEPTION 'trial reservation allocation is not exactly 25';
  END IF;
  BEGIN
    PERFORM public.reserve_credits_from_lots(
      '10000000-0000-4000-8000-000000000001',25,'second-text-campaign',NULL,NULL,
      '{"product_code":"text_campaign","variant":"standard","smart_token_cost":25}'::jsonb
    );
    RAISE EXCEPTION 'exhausted trial funded a second campaign';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Creditos insuficientes para esta geracao.' THEN RAISE; END IF;
  END;
END $$;

-- First confirmed purchase unlocks all SKUs; Stripe replay stays idempotent.
INSERT INTO auth.users(id,email_confirmed_at) VALUES ('10000000-0000-4000-8000-000000000002',pg_catalog.now());
INSERT INTO public.profiles(id) VALUES ('10000000-0000-4000-8000-000000000002');
DO $$ DECLARE v_result TEXT; BEGIN
  SELECT result INTO v_result FROM public.grant_stripe_credit_lot(
    '10000000-0000-4000-8000-000000000002',20,'purchase',pg_catalog.now()+INTERVAL '30 days',
    'stripe-test-v1',NULL,'cs_test_trial_purchase','{}'::jsonb
  );
  IF v_result <> 'created' THEN RAISE EXCEPTION 'purchase lot was not created'; END IF;
  SELECT result INTO v_result FROM public.grant_stripe_credit_lot(
    '10000000-0000-4000-8000-000000000002',20,'purchase',pg_catalog.now()+INTERVAL '30 days',
    'stripe-test-v1',NULL,'cs_test_trial_purchase','{}'::jsonb
  );
  IF v_result <> 'already_processed' THEN RAISE EXCEPTION 'Stripe purchase replay lost idempotency'; END IF;
END $$;

DO $$ DECLARE v_reservation UUID; BEGIN
  SELECT id INTO v_reservation FROM public.reserve_credits_from_lots(
    '10000000-0000-4000-8000-000000000002',30,'paid-virtual-staging',NULL,NULL,
    '{"product_code":"virtual_staging","variant":"image","smart_token_cost":30}'::jsonb
  );
  IF (SELECT remaining_amount FROM public.credit_lots WHERE user_id='10000000-0000-4000-8000-000000000002' AND source='trial') <> 15 THEN
    RAISE EXCEPTION 'unused trial remainder did not persist as paid-account bonus';
  END IF;
  IF (SELECT pg_catalog.count(*) FROM public.credit_lots WHERE user_id='10000000-0000-4000-8000-000000000002' AND source='purchase') <> 1 THEN
    RAISE EXCEPTION 'Stripe replay duplicated purchase lot';
  END IF;
END $$;

-- A confirmed subscription is independently sufficient paid evidence.
INSERT INTO auth.users(id,email_confirmed_at) VALUES ('10000000-0000-4000-8000-000000000003',pg_catalog.now());
INSERT INTO public.profiles(id) VALUES ('10000000-0000-4000-8000-000000000003');
DO $$ BEGIN
  PERFORM public.grant_stripe_credit_lot(
    '10000000-0000-4000-8000-000000000003',40,'subscription',pg_catalog.now()+INTERVAL '30 days',
    'stripe-test-v1','in_test_trial_subscription',NULL,'{}'::jsonb
  );
  PERFORM public.reserve_credits_from_lots(
    '10000000-0000-4000-8000-000000000003',30,'paid-banner',NULL,NULL,
    '{"product_code":"virtual_staging","variant":"image","smart_token_cost":30}'::jsonb
  );
  IF (SELECT remaining_amount FROM public.credit_lots WHERE user_id='10000000-0000-4000-8000-000000000003' AND source='trial') <> 25 THEN
    RAISE EXCEPTION 'FEFO failed to preserve non-expiring trial behind subscription lot';
  END IF;
END $$;

-- Real concurrent reservation attempts serialize on the profile row.
CREATE OR REPLACE FUNCTION public.test_reserve_trial(p_user UUID,p_key TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_id UUID;
BEGIN
  PERFORM pg_catalog.set_config('request.jwt.claim.role','service_role',TRUE);
  SELECT id INTO v_id FROM public.reserve_credits_from_lots(
    p_user,25,p_key,NULL,NULL,
    '{"product_code":"text_campaign","variant":"standard","smart_token_cost":25}'::jsonb
  );
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.test_delay_trial_reservation()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF NEW.idempotency_key LIKE 'concurrent-%' THEN PERFORM pg_catalog.pg_sleep(1); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER test_delay_trial_reservation BEFORE INSERT ON public.credit_reservations
FOR EACH ROW EXECUTE FUNCTION public.test_delay_trial_reservation();

INSERT INTO auth.users(id,email_confirmed_at) VALUES ('10000000-0000-4000-8000-000000000004',pg_catalog.now());
INSERT INTO public.profiles(id) VALUES ('10000000-0000-4000-8000-000000000004');
SELECT dblink_connect('trial_c1','dbname='||pg_catalog.current_database());
SELECT dblink_connect('trial_c2','dbname='||pg_catalog.current_database());
SELECT dblink_send_query('trial_c1',$q$SELECT public.test_reserve_trial('10000000-0000-4000-8000-000000000004','concurrent-same')::text$q$);
SELECT dblink_send_query('trial_c2',$q$SELECT public.test_reserve_trial('10000000-0000-4000-8000-000000000004','concurrent-same')::text$q$);
SELECT * FROM dblink_get_result('trial_c1') AS t(reservation_id TEXT);
SELECT * FROM dblink_get_result('trial_c2') AS t(reservation_id TEXT);
DO $$ BEGIN
  IF (SELECT pg_catalog.count(*) FROM public.credit_reservations WHERE user_id='10000000-0000-4000-8000-000000000004') <> 1 THEN
    RAISE EXCEPTION 'concurrent replay duplicated reservation';
  END IF;
END $$;
SELECT dblink_disconnect('trial_c1');
SELECT dblink_disconnect('trial_c2');

SELECT 'trial_text_campaign_pg17_ok' AS result;
