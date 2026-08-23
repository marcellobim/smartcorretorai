\set ON_ERROR_STOP on

CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN;
CREATE SCHEMA auth;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT pg_catalog.current_setting('request.jwt.claim.role', true)
$$;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.subscriptions(id uuid PRIMARY KEY);
CREATE TABLE public.profiles(
  id uuid PRIMARY KEY REFERENCES auth.users(id),
  saldo_creditos bigint NOT NULL DEFAULT 0,
  creditos_expiram_em timestamptz
);
CREATE TABLE public.credit_transactions(
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  tipo text NOT NULL,
  creditos bigint NOT NULL,
  saldo_resultante bigint NOT NULL,
  observacao text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);
CREATE TABLE public.credit_reservations(
  id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  campaign_id uuid,
  idempotency_key text NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  status text NOT NULL CHECK (status IN ('reserved','consumed','cancelled')),
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  consumed_at timestamptz,
  cancelled_at timestamptz,
  UNIQUE(user_id,idempotency_key)
);
CREATE TABLE public.hero_generations(id uuid PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid());

SELECT pg_catalog.set_config('request.jwt.claim.role', 'service_role', false);
\ir ../migrations/20260816010000_create_credit_lots_foundation.sql
ALTER TABLE public.credit_reservation_allocations
  ADD COLUMN consumed_amount bigint NOT NULL DEFAULT 0 CHECK (consumed_amount >= 0),
  ADD COLUMN refunded_amount bigint NOT NULL DEFAULT 0 CHECK (refunded_amount >= 0);
\ir ../migrations/20260817030000_create_real_estate_banner_economy.sql
\ir ../migrations/20260823010000_fix_real_estate_banner_request_ambiguity.sql

DO $$
DECLARE
  v_definition text;
  v_acl aclitem[];
BEGIN
  SELECT pg_catalog.pg_get_functiondef(p.oid), p.proacl
    INTO v_definition, v_acl
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='claim_real_estate_banner_request';
  IF v_definition NOT LIKE '%SECURITY DEFINER%' OR v_definition NOT LIKE '%SET search_path TO ''''%' THEN
    RAISE EXCEPTION 'security_contract_changed';
  END IF;
  IF pg_catalog.has_function_privilege('anon','public.claim_real_estate_banner_request(uuid,uuid,text,integer,integer,jsonb)','EXECUTE')
     OR pg_catalog.has_function_privilege('authenticated','public.claim_real_estate_banner_request(uuid,uuid,text,integer,integer,jsonb)','EXECUTE')
     OR NOT pg_catalog.has_function_privilege('service_role','public.claim_real_estate_banner_request(uuid,uuid,text,integer,integer,jsonb)','EXECUTE') THEN
    RAISE EXCEPTION 'rpc_permissions_changed';
  END IF;
END $$;

INSERT INTO auth.users(id) VALUES
  ('10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000004');
INSERT INTO public.profiles(id,saldo_creditos) SELECT id,150 FROM auth.users;
INSERT INTO public.credit_lots(user_id,source,original_amount,remaining_amount,idempotency_key,catalog_version)
SELECT id,'admin',150,150,'test-lot-'||id::text,'test-v1' FROM auth.users;

CREATE TEMP TABLE first_claim AS
SELECT * FROM public.claim_real_estate_banner_request(
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'test-v1',1,1,
  '[{"piece_id":"feed-1","format_id":"instagram_feed","format_group":"square_feed","creation_option":1,"resolution":"1024x1024","reference_count":1,"retry_of_item_id":null,"unit_cost":75}]'::jsonb
);

DO $$
BEGIN
  IF (SELECT count(*) FROM first_claim)<>1
     OR (SELECT request_status FROM first_claim)<>'preparing'
     OR (SELECT returned_item_count FROM first_claim)<>1
     OR (SELECT returned_quoted_tokens FROM first_claim)<>75
     OR (SELECT jsonb_array_length(returned_items) FROM first_claim)<>1 THEN
    RAISE EXCEPTION 'new_request_contract_failed';
  END IF;
END $$;

CREATE TEMP TABLE repeated_claim AS
SELECT * FROM public.claim_real_estate_banner_request(
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'test-v1',1,1,
  '[{"piece_id":"feed-1","format_id":"instagram_feed","format_group":"square_feed","creation_option":1,"resolution":"1024x1024","reference_count":1,"retry_of_item_id":null,"unit_cost":75}]'::jsonb
);

DO $$
BEGIN
  IF (SELECT request_id FROM repeated_claim)<>(SELECT request_id FROM first_claim)
     OR (SELECT count(*) FROM public.real_estate_banner_requests WHERE user_id='10000000-0000-0000-0000-000000000001')<>1
     OR (SELECT count(*) FROM public.real_estate_banner_items WHERE request_id=(SELECT request_id FROM first_claim))<>1 THEN
    RAISE EXCEPTION 'idempotency_failed';
  END IF;
END $$;

CREATE TEMP TABLE first_reservation AS
SELECT * FROM public.reserve_credits_from_lots(
  '10000000-0000-0000-0000-000000000001',75,
  'real_estate_banner:10000000-0000-0000-0000-000000000001:20000000-0000-0000-0000-000000000001',
  NULL,'real_estate_banner:batch','{}'::jsonb
);
SELECT public.attach_real_estate_banner_reservation(
  '10000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  (SELECT returned_claim_token FROM first_claim),
  (SELECT id FROM first_reservation)
);

DO $$
BEGIN
  IF (SELECT amount FROM first_reservation)<>75
     OR (SELECT status FROM first_reservation)<>'reserved'
     OR (SELECT saldo_creditos FROM public.profiles WHERE id='10000000-0000-0000-0000-000000000001')<>75
     OR (SELECT sum(amount) FROM public.real_estate_banner_item_allocations WHERE item_id=(SELECT (returned_items->0->>'id')::uuid FROM first_claim))<>75 THEN
    RAISE EXCEPTION 'reservation_contract_failed';
  END IF;
END $$;

CREATE TEMP TABLE batch_claim AS
SELECT * FROM public.claim_real_estate_banner_request(
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  'test-v1',2,1,
  '[{"piece_id":"feed-2","format_id":"instagram_feed","format_group":"square_feed","creation_option":1,"resolution":"1024x1024","reference_count":0,"retry_of_item_id":null,"unit_cost":75},{"piece_id":"story-2","format_id":"story_reels","format_group":"vertical","creation_option":1,"resolution":"1024x1536","reference_count":0,"retry_of_item_id":null,"unit_cost":75}]'::jsonb
);
CREATE TEMP TABLE batch_reservation AS
SELECT * FROM public.reserve_credits_from_lots(
  '10000000-0000-0000-0000-000000000002',150,
  'real_estate_banner:10000000-0000-0000-0000-000000000002:20000000-0000-0000-0000-000000000002',
  NULL,'real_estate_banner:batch','{}'::jsonb
);
SELECT public.attach_real_estate_banner_reservation(
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  (SELECT returned_claim_token FROM batch_claim),
  (SELECT id FROM batch_reservation)
);
SELECT * FROM public.begin_real_estate_banner_request(
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002',
  (SELECT returned_claim_token FROM batch_claim)
);
SELECT * FROM public.finalize_real_estate_banner_item(
  '10000000-0000-0000-0000-000000000002',
  (SELECT id FROM public.real_estate_banner_items WHERE request_id=(SELECT request_id FROM batch_claim) AND item_index=0),
  'completed','{}'::jsonb,'{}'::jsonb
);
SELECT * FROM public.finalize_real_estate_banner_item(
  '10000000-0000-0000-0000-000000000002',
  (SELECT id FROM public.real_estate_banner_items WHERE request_id=(SELECT request_id FROM batch_claim) AND item_index=1),
  'failed','{}'::jsonb,'{}'::jsonb
);
SELECT * FROM public.settle_real_estate_banner_request(
  '10000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000002'
);

DO $$
BEGIN
  IF (SELECT smart_tokens_consumed FROM public.real_estate_banner_requests WHERE id=(SELECT request_id FROM batch_claim))<>75
     OR (SELECT smart_tokens_refunded FROM public.real_estate_banner_requests WHERE id=(SELECT request_id FROM batch_claim))<>75
     OR (SELECT saldo_creditos FROM public.profiles WHERE id='10000000-0000-0000-0000-000000000002')<>75
     OR (SELECT creditos FROM public.credit_transactions WHERE user_id='10000000-0000-0000-0000-000000000002' AND tipo='consumo')<>-75 THEN
    RAISE EXCEPTION 'proportional_settlement_changed';
  END IF;
END $$;

DO $$
DECLARE
  v_before bigint;
BEGIN
  SELECT saldo_creditos INTO v_before FROM public.profiles WHERE id='10000000-0000-0000-0000-000000000003';
  PERFORM * FROM public.claim_real_estate_banner_request(
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    'test-v1',1,1,
    '[{"piece_id":"feed-3","format_id":"instagram_feed","format_group":"square_feed","creation_option":1,"resolution":"1024x1024","reference_count":0,"retry_of_item_id":null,"unit_cost":75}]'::jsonb
  );
  IF (SELECT saldo_creditos FROM public.profiles WHERE id='10000000-0000-0000-0000-000000000003')<>v_before
     OR EXISTS(SELECT 1 FROM public.credit_reservations WHERE user_id='10000000-0000-0000-0000-000000000003')
     OR EXISTS(SELECT 1 FROM public.credit_transactions WHERE user_id='10000000-0000-0000-0000-000000000003' AND tipo='consumo') THEN
    RAISE EXCEPTION 'pre_execute_failure_economy_changed';
  END IF;
  BEGIN
    PERFORM * FROM public.reserve_credits_from_lots(
      '10000000-0000-0000-0000-000000000003',999,
      'insufficient-test',NULL,'test','{}'::jsonb
    );
    RAISE EXCEPTION 'insufficient_balance_not_blocked';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM='insufficient_balance_not_blocked' THEN RAISE; END IF;
  END;
  IF EXISTS(SELECT 1 FROM public.credit_reservations WHERE user_id='10000000-0000-0000-0000-000000000003')
     OR (SELECT saldo_creditos FROM public.profiles WHERE id='10000000-0000-0000-0000-000000000003')<>v_before THEN
    RAISE EXCEPTION 'insufficient_balance_side_effect';
  END IF;
END $$;

SELECT 'real_estate_banner_request_ambiguity_postgres_ok' AS result;
