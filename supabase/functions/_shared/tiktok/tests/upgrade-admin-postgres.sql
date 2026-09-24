-- PREPARED ONLY: not executed in this checkpoint.
-- Run only after separately authorizing and verifying laboratory ofqshqfmqpddtjwjwvxf.
-- Requires the corrected OAuth migration and existing synthetic Admin fixture.
-- Run as the migration owner. All fixture/ACL changes roll back.
BEGIN;
DO $preflight$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.admin_users WHERE user_id='11111111-1111-4111-8111-111111111111') THEN
  RAISE EXCEPTION 'ASSERT_SYNTHETIC_ADMIN_MISSING';
 END IF;
 IF EXISTS(SELECT 1 FROM public.tiktok_connections WHERE app_id=repeat('9',64) AND open_id='oauth-upgrade-synthetic-only') THEN
  RAISE EXCEPTION 'ASSERT_FIXTURE_COLLISION';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_proc p, LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
 WHERE p.oid='public.tiktok_upgrade_admin_allowed(uuid)'::regprocedure AND a.grantee=0) THEN
  RAISE EXCEPTION 'ASSERT_PUBLIC_EXECUTE';
 END IF;
END $preflight$;
REVOKE ALL ON TABLE public.admin_users FROM service_role;
SELECT set_config('request.jwt.claim.role','service_role',true);
SET LOCAL ROLE service_role;
DO $test$
DECLARE c uuid; result jsonb; rejected boolean; non_admin uuid:=gen_random_uuid();
 basic jsonb:='{"environment":"sandbox","appId":"9999999999999999999999999999999999999999999999999999999999999999","userId":"11111111-1111-4111-8111-111111111111","openId":"oauth-upgrade-synthetic-only","accessTokenCiphertext":"MGkGpIyRYC2JVxho0UPwvzse","accessTokenNonce":"m1nWyVRi/3setFVd","accessTokenAuthTag":"Idtu4nIyf/I/U5roKik65g==","refreshTokenCiphertext":"KJFheJisO3etYR3c8MPoSMe0cQ==","refreshTokenNonce":"IbYoHktvAmQzjQ1I","refreshTokenAuthTag":"shhJKFDKmb77RHL3225BBg==","keyVersion":"synthetic-v1","accessTokenExpiresIn":3600,"refreshTokenExpiresIn":86400,"scopes":["user.info.basic"],"account":{"openId":"oauth-upgrade-synthetic-only","displayName":"Synthetic OAuth Upgrade","username":null,"avatarUrl":null}}'::jsonb;
 upgraded jsonb:='{"environment":"sandbox","appId":"9999999999999999999999999999999999999999999999999999999999999999","userId":"11111111-1111-4111-8111-111111111111","openId":"oauth-upgrade-synthetic-only","accessTokenCiphertext":"LeabFqeLcBWj3qIS2dvby0dX","accessTokenNonce":"/vXIpfE7m6scKGbW","accessTokenAuthTag":"jgfRAumY7zI6NqufkgRFZQ==","refreshTokenCiphertext":"Gbzl0ZTWeRKXR9sv7p9nYMVzFg==","refreshTokenNonce":"RNtRzg+0hF2DzgFD","refreshTokenAuthTag":"8Uk9gZ0oB1kiB4DWBa8HGg==","keyVersion":"synthetic-v1","accessTokenExpiresIn":7200,"refreshTokenExpiresIn":172800,"scopes":["user.info.basic","video.publish"],"account":{"openId":"oauth-upgrade-synthetic-only","displayName":"Synthetic OAuth Upgrade","username":null,"avatarUrl":null}}'::jsonb;
BEGIN
 IF has_table_privilege(current_user,'public.admin_users','SELECT') THEN RAISE EXCEPTION 'ASSERT_DIRECT_READ_EXPOSURE'; END IF;
 IF public.tiktok_upgrade_admin_allowed(non_admin) OR public.tiktok_upgrade_admin_allowed(NULL) THEN RAISE EXCEPTION 'ASSERT_NON_ADMIN'; END IF;
 IF NOT public.tiktok_upgrade_admin_allowed((basic->>'userId')::uuid) THEN RAISE EXCEPTION 'ASSERT_ADMIN'; END IF;
 rejected:=false;
 BEGIN
  PERFORM 1 FROM public.admin_users LIMIT 1;
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'ASSERT_LIST_EXPOSURE'; END IF;
 rejected:=false;
 BEGIN
  PERFORM public.register_tiktok_direct_post_state(repeat('6',64),non_admin,repeat('7',64),'sandbox',repeat('9',64));
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM<>'invalid_tiktok_upgrade' THEN RAISE; END IF;
  rejected:=true;
 END;
 IF NOT rejected THEN RAISE EXCEPTION 'ASSERT_NON_ADMIN_REGISTRATION'; END IF;
 c:=public.persist_tiktok_login('sandbox',repeat('9',64),basic);
 PERFORM public.register_tiktok_direct_post_state(repeat('6',64),(basic->>'userId')::uuid,repeat('7',64),'sandbox',repeat('9',64));
 result:=public.consume_tiktok_direct_post_state(repeat('6',64),repeat('7',64),'sandbox',repeat('9',64));
 IF result IS NULL OR (result->>'connectionId')::uuid<>c THEN RAISE EXCEPTION 'ASSERT_STATE_BINDING'; END IF;
 IF public.persist_tiktok_direct_post_upgrade('sandbox',repeat('9',64),upgraded,c,(result->>'tokenVersion')::bigint)<>c THEN
  RAISE EXCEPTION 'ASSERT_PERSISTENCE';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.tiktok_connections WHERE id=c AND scopes=ARRAY['user.info.basic','video.publish'] AND token_version=2) THEN
  RAISE EXCEPTION 'ASSERT_UPGRADE';
 END IF;
END $test$;
RESET ROLE;

SET LOCAL ROLE anon;
-- Even spoofing the claim cannot bypass SQL EXECUTE ACL.
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $negative$
DECLARE rejected boolean; stmt text;
BEGIN
 FOREACH stmt IN ARRAY ARRAY[
  'SELECT public.tiktok_upgrade_admin_allowed(''11111111-1111-4111-8111-111111111111''::uuid)',
  'SELECT public.register_tiktok_direct_post_state(NULL,NULL,NULL,NULL,NULL)',
  'SELECT public.consume_tiktok_direct_post_state(NULL,NULL,NULL,NULL)',
  'SELECT public.persist_tiktok_direct_post_upgrade(NULL,NULL,NULL,NULL,NULL)',
  'SELECT 1 FROM public.admin_users LIMIT 1'
 ] LOOP
  rejected:=false;
  BEGIN EXECUTE stmt; EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'ASSERT_FORBIDDEN_DIRECT_CALL'; END IF;
 END LOOP;
END $negative$;
RESET ROLE;

SET LOCAL ROLE authenticated;
-- Even spoofing the claim cannot bypass SQL EXECUTE ACL.
SELECT set_config('request.jwt.claim.role','service_role',true);
DO $negative$
DECLARE rejected boolean; stmt text;
BEGIN
 FOREACH stmt IN ARRAY ARRAY[
  'SELECT public.tiktok_upgrade_admin_allowed(''11111111-1111-4111-8111-111111111111''::uuid)',
  'SELECT public.register_tiktok_direct_post_state(NULL,NULL,NULL,NULL,NULL)',
  'SELECT public.consume_tiktok_direct_post_state(NULL,NULL,NULL,NULL)',
  'SELECT public.persist_tiktok_direct_post_upgrade(NULL,NULL,NULL,NULL,NULL)',
  'SELECT 1 FROM public.admin_users LIMIT 1'
 ] LOOP
  rejected:=false;
  BEGIN EXECUTE stmt; EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'ASSERT_FORBIDDEN_DIRECT_CALL'; END IF;
 END LOOP;
END $negative$;
RESET ROLE;

SELECT set_config('request.jwt.claim.role','authenticated',true);
SET LOCAL ROLE service_role;
DO $claim$
DECLARE rejected boolean:=false;
BEGIN
 BEGIN PERFORM public.tiktok_upgrade_admin_allowed('11111111-1111-4111-8111-111111111111');
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'ASSERT_CLAIM_GUARD'; END IF;
END $claim$;
RESET ROLE;
SELECT 'admin_upgrade_permission_regression_passed' AS result;
ROLLBACK;
