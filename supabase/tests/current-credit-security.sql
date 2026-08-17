BEGIN;

SELECT plan(39);

-- ANON: no credit mutation or balance disclosure, including a known UUID.
SELECT ok(NOT has_function_privilege('anon', 'public.add_credits(uuid,bigint,text,text,jsonb,timestamptz)', 'EXECUTE'), 'anon cannot add credits');
SELECT ok(NOT has_function_privilege('anon', 'public.consume_credits(uuid,bigint,text,jsonb)', 'EXECUTE'), 'anon cannot consume credits');
SELECT ok(NOT has_function_privilege('anon', 'public.reserve_credits(uuid,bigint,text,uuid,text,jsonb)', 'EXECUTE'), 'anon cannot reserve credits');
SELECT ok(NOT has_function_privilege('anon', 'public.consume_reserved_credits(uuid,text,text,jsonb)', 'EXECUTE'), 'anon cannot consume reservations');
SELECT ok(NOT has_function_privilege('anon', 'public.cancel_credit_reservation(uuid,text,text)', 'EXECUTE'), 'anon cannot cancel reservations');
SELECT ok(NOT has_function_privilege('anon', 'public.expire_user_credits(uuid)', 'EXECUTE'), 'anon cannot expire credits');
SELECT ok(NOT has_function_privilege('anon', 'public.get_credit_balance(uuid)', 'EXECUTE'), 'anon cannot read a known user balance');

-- AUTHENTICATED: no internal RPC remains callable for own or foreign UUIDs.
SELECT ok(NOT has_function_privilege('authenticated', 'public.add_credits(uuid,bigint,text,text,jsonb,timestamptz)', 'EXECUTE'), 'authenticated cannot add credits');
SELECT ok(NOT has_function_privilege('authenticated', 'public.consume_credits(uuid,bigint,text,jsonb)', 'EXECUTE'), 'authenticated cannot consume credits');
SELECT ok(NOT has_function_privilege('authenticated', 'public.reserve_credits(uuid,bigint,text,uuid,text,jsonb)', 'EXECUTE'), 'authenticated cannot reserve credits');
SELECT ok(NOT has_function_privilege('authenticated', 'public.consume_reserved_credits(uuid,text,text,jsonb)', 'EXECUTE'), 'authenticated cannot consume reservations');
SELECT ok(NOT has_function_privilege('authenticated', 'public.cancel_credit_reservation(uuid,text,text)', 'EXECUTE'), 'authenticated cannot cancel reservations');
SELECT ok(NOT has_function_privilege('authenticated', 'public.expire_user_credits(uuid)', 'EXECUTE'), 'authenticated cannot expire credits');
SELECT ok(NOT has_function_privilege('authenticated', 'public.get_credit_balance(uuid)', 'EXECUTE'), 'authenticated cannot read own or foreign balance through the internal RPC');

-- SERVICE_ROLE: preserve every legitimate backend call.
SELECT ok(has_function_privilege('service_role', 'public.add_credits(uuid,bigint,text,text,jsonb,timestamptz)', 'EXECUTE'), 'service_role can add credits');
SELECT ok(has_function_privilege('service_role', 'public.consume_credits(uuid,bigint,text,jsonb)', 'EXECUTE'), 'service_role can consume credits');
SELECT ok(has_function_privilege('service_role', 'public.reserve_credits(uuid,bigint,text,uuid,text,jsonb)', 'EXECUTE'), 'service_role can reserve credits');
SELECT ok(has_function_privilege('service_role', 'public.consume_reserved_credits(uuid,text,text,jsonb)', 'EXECUTE'), 'service_role can consume reservations');
SELECT ok(has_function_privilege('service_role', 'public.cancel_credit_reservation(uuid,text,text)', 'EXECUTE'), 'service_role can cancel reservations');
SELECT ok(has_function_privilege('service_role', 'public.expire_user_credits(uuid)', 'EXECUTE'), 'service_role can expire credits');
SELECT ok(has_function_privilege('service_role', 'public.get_credit_balance(uuid)', 'EXECUTE'), 'service_role can read balances');

-- All SECURITY DEFINER functions must have a fixed empty search_path.
SELECT is((SELECT proconfig FROM pg_proc WHERE oid = 'public.add_credits(uuid,bigint,text,text,jsonb,timestamptz)'::regprocedure), ARRAY['search_path=""']::text[], 'add_credits search_path is empty');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid = 'public.consume_credits(uuid,bigint,text,jsonb)'::regprocedure), ARRAY['search_path=""']::text[], 'consume_credits search_path is empty');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid = 'public.reserve_credits(uuid,bigint,text,uuid,text,jsonb)'::regprocedure), ARRAY['search_path=""']::text[], 'reserve_credits search_path is empty');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid = 'public.consume_reserved_credits(uuid,text,text,jsonb)'::regprocedure), ARRAY['search_path=""']::text[], 'consume_reserved_credits search_path is empty');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid = 'public.cancel_credit_reservation(uuid,text,text)'::regprocedure), ARRAY['search_path=""']::text[], 'cancel_credit_reservation search_path is empty');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid = 'public.expire_user_credits(uuid)'::regprocedure), ARRAY['search_path=""']::text[], 'expire_user_credits search_path is empty');
SELECT is((SELECT proconfig FROM pg_proc WHERE oid = 'public.get_credit_balance(uuid)'::regprocedure), ARRAY['search_path=""']::text[], 'get_credit_balance search_path is empty');

-- subscriptions: no anonymous access, authenticated self-read only, backend writes retained.
SELECT ok(NOT has_table_privilege('anon', 'public.subscriptions', 'SELECT'), 'anon cannot read subscriptions');
SELECT ok(NOT has_table_privilege('anon', 'public.subscriptions', 'INSERT'), 'anon cannot insert subscriptions');
SELECT ok(NOT has_table_privilege('anon', 'public.subscriptions', 'UPDATE'), 'anon cannot update subscriptions');
SELECT ok(NOT has_table_privilege('anon', 'public.subscriptions', 'DELETE'), 'anon cannot delete subscriptions');
SELECT ok(has_table_privilege('authenticated', 'public.subscriptions', 'SELECT'), 'authenticated retains subscription read');
SELECT ok(NOT has_table_privilege('authenticated', 'public.subscriptions', 'INSERT'), 'authenticated cannot insert subscriptions');
SELECT ok(NOT has_table_privilege('authenticated', 'public.subscriptions', 'UPDATE'), 'authenticated cannot update subscriptions');
SELECT ok(NOT has_table_privilege('authenticated', 'public.subscriptions', 'DELETE'), 'authenticated cannot delete subscriptions');
SELECT ok(has_table_privilege('service_role', 'public.subscriptions', 'SELECT,INSERT,UPDATE,DELETE'), 'service_role manages subscriptions');
SELECT is((SELECT count(*)::bigint FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscriptions' AND policyname = 'Service role gerencia assinaturas'), 0::bigint, 'public all-rows subscription policy is gone');
SELECT is((SELECT count(*)::bigint FROM pg_policies WHERE schemaname = 'public' AND tablename = 'subscriptions' AND cmd <> 'SELECT'), 0::bigint, 'subscriptions has no client write policy');

SELECT * FROM finish();
ROLLBACK;
