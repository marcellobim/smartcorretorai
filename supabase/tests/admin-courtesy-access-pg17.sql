\set ON_ERROR_STOP on

\ir trial-200-st-forward-pg17.sql

CREATE TABLE public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT
);

INSERT INTO auth.users(id) VALUES
  ('a0000000-0000-4000-8000-000000000001'),
  ('a0000000-0000-4000-8000-000000000002');
INSERT INTO public.admin_users(user_id) VALUES ('a0000000-0000-4000-8000-000000000001');

\ir ../migrations/20260824010000_create_admin_catalog_courtesy_access.sql

SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', FALSE);

-- Browser roles cannot call either Admin mutation or the economic reservation.
SELECT pg_catalog.set_config('request.jwt.claim.role', 'authenticated', FALSE);
DO $$ BEGIN
  BEGIN
    PERFORM public.set_admin_catalog_courtesy(
      'a0000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002', TRUE,
      'Tentativa sem backend protegido', 'a1000000-0000-4000-8000-000000000001');
    RAISE EXCEPTION 'authenticated role changed courtesy';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  IF pg_catalog.has_function_privilege('authenticated',
       'public.set_admin_catalog_courtesy(uuid,uuid,boolean,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated retained courtesy RPC execute';
  END IF;
END $$;
SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', FALSE);

-- Non-admin identity is rejected even behind service role.
DO $$ BEGIN
  BEGIN
    PERFORM public.set_admin_catalog_courtesy(
      'a0000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000002', TRUE,
      'Tentativa por usuario comum', 'a1000000-0000-4000-8000-000000000002');
    RAISE EXCEPTION 'non-admin changed courtesy';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- Administrative Smart Tokens alone remain unable to unlock a premium SKU.
INSERT INTO auth.users(id,email_confirmed_at) VALUES ('a2000000-0000-4000-8000-000000000001',pg_catalog.now());
INSERT INTO public.profiles(id) VALUES ('a2000000-0000-4000-8000-000000000001');
INSERT INTO public.credit_lots(
  user_id,source,original_amount,remaining_amount,status,idempotency_key,catalog_version,hidden_from_ui
) VALUES (
  'a2000000-0000-4000-8000-000000000001','admin',100,100,'active',
  'admin-only-balance','admin-support-v1',FALSE
);
DO $$ DECLARE v_before BIGINT; BEGIN
  SELECT pg_catalog.sum(remaining_amount) INTO v_before FROM public.credit_lots
   WHERE user_id='a2000000-0000-4000-8000-000000000001';
  BEGIN
    PERFORM public.reserve_credits_from_lots(
      'a2000000-0000-4000-8000-000000000001',30,'admin-alone-premium',NULL,NULL,
      '{"product_code":"virtual_staging","variant":"image","smart_token_cost":30}'::jsonb);
    RAISE EXCEPTION 'admin credits unlocked premium catalog';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'TRIAL_PRODUCT_NOT_ALLOWED' THEN RAISE; END IF; END;
  IF (SELECT pg_catalog.sum(remaining_amount) FROM public.credit_lots
       WHERE user_id='a2000000-0000-4000-8000-000000000001') <> v_before THEN
    RAISE EXCEPTION 'blocked premium request changed balance';
  END IF;
END $$;

-- Active courtesy unlocks the catalog, is idempotent, and consumes existing balance normally.
DO $$ DECLARE v_result TEXT; v_before BIGINT; BEGIN
  SELECT pg_catalog.sum(remaining_amount) INTO v_before FROM public.credit_lots
   WHERE user_id='a2000000-0000-4000-8000-000000000001';
  SELECT result INTO v_result FROM public.set_admin_catalog_courtesy(
    'a0000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001', TRUE,
    'Parceiro de lancamento homologado', 'a1000000-0000-4000-8000-000000000003');
  IF v_result <> 'created' THEN RAISE EXCEPTION 'courtesy was not created'; END IF;

  SELECT result INTO v_result FROM public.set_admin_catalog_courtesy(
    'a0000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001', TRUE,
    'Parceiro de lancamento homologado', 'a1000000-0000-4000-8000-000000000003');
  IF v_result <> 'already_processed' THEN RAISE EXCEPTION 'courtesy replay lost idempotency'; END IF;

  SELECT result INTO v_result FROM public.set_admin_catalog_courtesy(
    'a0000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001', TRUE,
    'Motivo novo sem transicao real', 'a1000000-0000-4000-8000-000000000004');
  IF v_result <> 'already_active' THEN RAISE EXCEPTION 'active state replay created ambiguity'; END IF;
  IF (SELECT pg_catalog.count(*) FROM public.admin_catalog_access_events
       WHERE user_id='a2000000-0000-4000-8000-000000000001') <> 1 THEN
    RAISE EXCEPTION 'replay duplicated courtesy audit';
  END IF;

  PERFORM public.reserve_credits_from_lots(
    'a2000000-0000-4000-8000-000000000001',30,'courtesy-premium',NULL,NULL,
    '{"product_code":"virtual_staging","variant":"image","smart_token_cost":30}'::jsonb);
  IF (SELECT pg_catalog.sum(remaining_amount) FROM public.credit_lots
       WHERE user_id='a2000000-0000-4000-8000-000000000001') <> v_before - 30 THEN
    RAISE EXCEPTION 'courtesy did not consume exactly the requested balance';
  END IF;
END $$;

-- Revocation is append-only, preserves balance, and immediately restores trial catalog rules.
DO $$ DECLARE v_result TEXT; v_before BIGINT; BEGIN
  SELECT pg_catalog.sum(remaining_amount) INTO v_before FROM public.credit_lots
   WHERE user_id='a2000000-0000-4000-8000-000000000001';
  SELECT result INTO v_result FROM public.set_admin_catalog_courtesy(
    'a0000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000001', FALSE,
    NULL, 'a1000000-0000-4000-8000-000000000005');
  IF v_result <> 'created' THEN RAISE EXCEPTION 'courtesy revocation was not created'; END IF;
  IF (SELECT pg_catalog.sum(remaining_amount) FROM public.credit_lots
       WHERE user_id='a2000000-0000-4000-8000-000000000001') <> v_before THEN
    RAISE EXCEPTION 'revocation changed Smart Token balance';
  END IF;
  BEGIN
    PERFORM public.reserve_credits_from_lots(
      'a2000000-0000-4000-8000-000000000001',30,'revoked-premium',NULL,NULL,
      '{"product_code":"virtual_staging","variant":"image","smart_token_cost":30}'::jsonb);
    RAISE EXCEPTION 'revoked courtesy still unlocked premium catalog';
  EXCEPTION WHEN OTHERS THEN IF SQLERRM <> 'TRIAL_PRODUCT_NOT_ALLOWED' THEN RAISE; END IF; END;
  PERFORM public.reserve_credits_from_lots(
    'a2000000-0000-4000-8000-000000000001',25,'revoked-trial-product',NULL,NULL,
    '{"product_code":"text_campaign","variant":"standard","smart_token_cost":25}'::jsonb);
  IF (SELECT pg_catalog.count(*) FROM public.admin_catalog_access_events
       WHERE user_id='a2000000-0000-4000-8000-000000000001') <> 2 THEN
    RAISE EXCEPTION 'grant and revoke audit history is incomplete';
  END IF;
END $$;

-- Courtesy without any balance never authorizes a generation economically.
INSERT INTO auth.users(id) VALUES ('a2000000-0000-4000-8000-000000000002');
INSERT INTO public.profiles(id) VALUES ('a2000000-0000-4000-8000-000000000002');
DO $$ BEGIN
  PERFORM public.set_admin_catalog_courtesy(
    'a0000000-0000-4000-8000-000000000001',
    'a2000000-0000-4000-8000-000000000002', TRUE,
    'Demonstracao homologada sem saldo', 'a1000000-0000-4000-8000-000000000006');
  BEGIN
    PERFORM public.reserve_credits_from_lots(
      'a2000000-0000-4000-8000-000000000002',30,'courtesy-no-balance',NULL,NULL,
      '{"product_code":"virtual_staging","variant":"image","smart_token_cost":30}'::jsonb);
    RAISE EXCEPTION 'courtesy created economic balance';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'Creditos insuficientes para esta geracao.' THEN RAISE; END IF;
  END;
END $$;

-- Confirmed Stripe purchase still unlocks the full catalog without courtesy.
INSERT INTO auth.users(id) VALUES ('a2000000-0000-4000-8000-000000000003');
INSERT INTO public.profiles(id) VALUES ('a2000000-0000-4000-8000-000000000003');
INSERT INTO public.credit_lots(
  user_id,source,original_amount,remaining_amount,status,idempotency_key,
  stripe_checkout_session_id,catalog_version,hidden_from_ui
) VALUES (
  'a2000000-0000-4000-8000-000000000003','purchase',40,40,'active',
  'paid-courtesy-regression','cs_test_courtesy_regression','stripe-test-v2',FALSE
);
DO $$ BEGIN
  PERFORM public.reserve_credits_from_lots(
    'a2000000-0000-4000-8000-000000000003',30,'paid-premium-regression',NULL,NULL,
    '{"product_code":"virtual_staging","variant":"image","smart_token_cost":30}'::jsonb);
  IF (SELECT remaining_amount FROM public.credit_lots
       WHERE user_id='a2000000-0000-4000-8000-000000000003') <> 10 THEN
    RAISE EXCEPTION 'paid access regressed';
  END IF;
END $$;

-- Confirmed subscription independently remains a legitimate full-catalog signal.
INSERT INTO auth.users(id) VALUES ('a2000000-0000-4000-8000-000000000004');
INSERT INTO public.profiles(id) VALUES ('a2000000-0000-4000-8000-000000000004');
INSERT INTO public.credit_lots(
  user_id,source,original_amount,remaining_amount,status,idempotency_key,
  stripe_invoice_id,catalog_version,hidden_from_ui
) VALUES (
  'a2000000-0000-4000-8000-000000000004','subscription',40,40,'active',
  'subscription-courtesy-regression','in_test_courtesy_regression','stripe-test-v2',FALSE
);
DO $$ BEGIN
  PERFORM public.reserve_credits_from_lots(
    'a2000000-0000-4000-8000-000000000004',30,'subscription-premium-regression',NULL,NULL,
    '{"product_code":"virtual_staging","variant":"image","smart_token_cost":30}'::jsonb);
  IF (SELECT remaining_amount FROM public.credit_lots
       WHERE user_id='a2000000-0000-4000-8000-000000000004') <> 10 THEN
    RAISE EXCEPTION 'subscription access regressed';
  END IF;
END $$;

SELECT 'admin_courtesy_access_pg17_ok' AS result;
