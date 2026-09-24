-- Local candidate only. Preserve the original Login Kit migration and basic RPCs.
BEGIN;
ALTER TABLE public.tiktok_oauth_states
 ADD COLUMN upgrade_connection_id uuid REFERENCES public.tiktok_connections(id) ON DELETE CASCADE,
 ADD COLUMN upgrade_token_version bigint;
ALTER TABLE public.tiktok_oauth_states DROP CONSTRAINT tiktok_oauth_states_flow_check;
ALTER TABLE public.tiktok_oauth_states ADD CONSTRAINT tiktok_oauth_states_flow_check
 CHECK(flow IN ('tiktok_login_kit','tiktok_direct_post_upgrade'));
ALTER TABLE public.tiktok_oauth_states ADD CONSTRAINT tiktok_upgrade_state_binding CHECK(
 (flow='tiktok_login_kit' AND upgrade_connection_id IS NULL AND upgrade_token_version IS NULL)
 OR (flow='tiktok_direct_post_upgrade' AND environment='sandbox' AND upgrade_connection_id IS NOT NULL AND upgrade_token_version IS NOT NULL AND upgrade_token_version>0)
);

-- Service-only membership predicate. Elevate only this read, not OAuth writes.
CREATE FUNCTION public.tiktok_upgrade_admin_allowed(p_user_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
 END IF;
 RETURN p_user_id IS NOT NULL AND EXISTS (
  SELECT 1 FROM public.admin_users AS admins WHERE admins.user_id = p_user_id
 );
END;
$$;
ALTER FUNCTION public.tiktok_upgrade_admin_allowed(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.tiktok_upgrade_admin_allowed(uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.tiktok_upgrade_admin_allowed(uuid) TO service_role;

CREATE FUNCTION public.register_tiktok_direct_post_state(
 p_state_hash text,p_user_id uuid,p_redirect_uri_hash text,p_environment text,p_app_id text
) RETURNS void LANGUAGE plpgsql SET search_path='' AS $$
DECLARE c public.tiktok_connections; v_now timestamptz:=pg_catalog.clock_timestamp();
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_environment IS DISTINCT FROM 'sandbox' OR p_app_id IS NULL OR p_app_id !~ '^[0-9a-f]{64}$'
 OR p_state_hash IS NULL OR p_state_hash !~ '^[0-9a-f]{64}$'
 OR p_redirect_uri_hash IS NULL OR p_redirect_uri_hash !~ '^[0-9a-f]{64}$'
 OR NOT public.tiktok_upgrade_admin_allowed(p_user_id)
 THEN RAISE EXCEPTION 'invalid_tiktok_upgrade'; END IF;
 SELECT * INTO c FROM public.tiktok_connections
 WHERE user_id=p_user_id AND environment=p_environment AND app_id=p_app_id AND connection_status='active'
 AND scopes @> ARRAY['user.info.basic']::text[] AND refresh_token_expires_at>v_now
 AND EXISTS(SELECT 1 FROM public.tiktok_accounts a WHERE a.tiktok_connection_id=tiktok_connections.id AND a.user_id=p_user_id AND a.account_status='active')
 ORDER BY updated_at DESC,id LIMIT 1 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'tiktok_upgrade_connection_missing'; END IF;
 INSERT INTO public.tiktok_oauth_states(
 state_hash,user_id,redirect_uri_hash,environment,app_id,provider,flow,expires_at,created_at,upgrade_connection_id,upgrade_token_version)
 VALUES(p_state_hash,p_user_id,p_redirect_uri_hash,p_environment,p_app_id,'tiktok','tiktok_direct_post_upgrade',
 v_now+interval '5 minutes',v_now,c.id,c.token_version);
END $$;

CREATE FUNCTION public.consume_tiktok_direct_post_state(
 p_state_hash text,p_redirect_uri_hash text,p_environment text,p_app_id text
) RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE s public.tiktok_oauth_states;
BEGIN
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'forbidden' USING ERRCODE='42501'; END IF;
 IF p_environment IS DISTINCT FROM 'sandbox' OR p_app_id IS NULL OR p_app_id !~ '^[0-9a-f]{64}$'
 OR p_state_hash IS NULL OR p_state_hash !~ '^[0-9a-f]{64}$'
 OR p_redirect_uri_hash IS NULL OR p_redirect_uri_hash !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
 UPDATE public.tiktok_oauth_states SET consumed_at=pg_catalog.clock_timestamp()
 WHERE state_hash=p_state_hash AND redirect_uri_hash=p_redirect_uri_hash
 AND environment=p_environment AND app_id=p_app_id AND provider='tiktok' AND flow='tiktok_direct_post_upgrade'
 AND consumed_at IS NULL AND expires_at>pg_catalog.clock_timestamp()
 RETURNING * INTO s;
 IF NOT FOUND THEN RETURN NULL; END IF;
 RETURN pg_catalog.jsonb_build_object('userId',s.user_id,'connectionId',s.upgrade_connection_id,'tokenVersion',s.upgrade_token_version);
END $$;
CREATE FUNCTION public.persist_tiktok_direct_post_upgrade(p_environment TEXT, p_app_id TEXT, p_login JSONB, p_connection_id UUID, p_expected_version BIGINT)
RETURNS UUID LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_existing public.tiktok_connections;
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_user UUID;
  v_open TEXT;
  v_connection UUID;
  v_access_seconds INTEGER;
  v_refresh_seconds INTEGER;
  v_access_expiry TIMESTAMPTZ;
  v_refresh_expiry TIMESTAMPTZ;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_environment IS DISTINCT FROM 'sandbox'
     OR p_app_id IS NULL OR p_app_id !~ '^[0-9a-f]{64}$'
     OR pg_catalog.jsonb_typeof(p_login) IS DISTINCT FROM 'object'
     OR p_login->>'environment' IS DISTINCT FROM p_environment
     OR p_login->>'appId' IS DISTINCT FROM p_app_id THEN
    RAISE EXCEPTION 'invalid_tiktok_login' USING ERRCODE = '22023';
  END IF;
  v_user := (p_login->>'userId')::UUID;
  v_open := p_login->>'openId';
  v_access_seconds := (p_login->>'accessTokenExpiresIn')::INTEGER;
  v_refresh_seconds := (p_login->>'refreshTokenExpiresIn')::INTEGER;
  IF v_user IS NULL OR v_open IS NULL OR pg_catalog.length(pg_catalog.btrim(v_open)) NOT BETWEEN 1 AND 255
     OR v_access_seconds IS NULL OR v_access_seconds NOT BETWEEN 1 AND 315360000
     OR v_refresh_seconds IS NULL OR v_refresh_seconds NOT BETWEEN 1 AND 315360000
     OR p_login->'scopes' IS DISTINCT FROM '["user.info.basic","video.publish"]'::JSONB
     OR pg_catalog.jsonb_typeof(p_login->'account') IS DISTINCT FROM 'object'
     OR p_login->'account'->>'openId' IS DISTINCT FROM v_open
     OR COALESCE(pg_catalog.jsonb_typeof(p_login->'account'->'displayName'), 'null') NOT IN ('string', 'null')
     OR COALESCE(pg_catalog.jsonb_typeof(p_login->'account'->'username'), 'null') NOT IN ('string', 'null')
     OR COALESCE(pg_catalog.jsonb_typeof(p_login->'account'->'avatarUrl'), 'null') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'invalid_tiktok_login' USING ERRCODE = '22023';
  END IF;
  v_access_expiry := v_now + v_access_seconds * INTERVAL '1 second';
  v_refresh_expiry := v_now + v_refresh_seconds * INTERVAL '1 second';
  IF NOT public.tiktok_envelope_valid(p_login->>'accessTokenCiphertext', p_login->>'accessTokenNonce', p_login->>'accessTokenAuthTag', v_access_expiry)
     OR NOT public.tiktok_envelope_valid(p_login->>'refreshTokenCiphertext', p_login->>'refreshTokenNonce', p_login->>'refreshTokenAuthTag', v_refresh_expiry)
     OR p_login->>'keyVersion' IS NULL THEN
    RAISE EXCEPTION 'invalid_tiktok_envelope' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing FROM public.tiktok_connections WHERE id=p_connection_id FOR UPDATE;
  IF NOT FOUND OR v_existing.user_id IS DISTINCT FROM v_user OR v_existing.open_id IS DISTINCT FROM v_open
     OR v_existing.environment IS DISTINCT FROM p_environment OR v_existing.app_id IS DISTINCT FROM p_app_id
     OR v_existing.token_version IS DISTINCT FROM p_expected_version OR p_expected_version IS NULL
     OR v_existing.connection_status IS DISTINCT FROM 'active'
     OR NOT public.tiktok_upgrade_admin_allowed(v_user)
  THEN RAISE EXCEPTION 'tiktok_upgrade_binding_mismatch' USING ERRCODE='42501'; END IF;

  INSERT INTO public.tiktok_connections AS existing (
    user_id, environment, app_id, open_id,
    access_token_ciphertext, access_token_nonce, access_token_auth_tag,
    refresh_token_ciphertext, refresh_token_nonce, refresh_token_auth_tag, key_version,
    access_token_expires_at, refresh_token_expires_at, scopes, connection_status
  ) VALUES (
    v_user, p_environment, p_app_id, v_open,
    p_login->>'accessTokenCiphertext', p_login->>'accessTokenNonce', p_login->>'accessTokenAuthTag',
    p_login->>'refreshTokenCiphertext', p_login->>'refreshTokenNonce', p_login->>'refreshTokenAuthTag', p_login->>'keyVersion',
    v_access_expiry, v_refresh_expiry, ARRAY['user.info.basic','video.publish'], 'active'
  )
  ON CONFLICT (environment, app_id, open_id) DO UPDATE SET
    access_token_ciphertext = EXCLUDED.access_token_ciphertext,
    access_token_nonce = EXCLUDED.access_token_nonce,
    access_token_auth_tag = EXCLUDED.access_token_auth_tag,
    refresh_token_ciphertext = EXCLUDED.refresh_token_ciphertext,
    refresh_token_nonce = EXCLUDED.refresh_token_nonce,
    refresh_token_auth_tag = EXCLUDED.refresh_token_auth_tag,
    key_version = EXCLUDED.key_version,
    access_token_expires_at = EXCLUDED.access_token_expires_at,
    refresh_token_expires_at = EXCLUDED.refresh_token_expires_at,
    scopes = EXCLUDED.scopes, connection_status = 'active', revoked_at = NULL
  WHERE existing.user_id = v_user
  RETURNING id INTO v_connection;
  IF v_connection IS NULL THEN
    RAISE EXCEPTION 'tiktok_connection_owner_mismatch' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.tiktok_accounts (
    user_id, environment, app_id, tiktok_connection_id, open_id, display_name, username, avatar_url, account_status
  ) VALUES (
    v_user, p_environment, p_app_id, v_connection, v_open,
    p_login->'account'->>'displayName', p_login->'account'->>'username', p_login->'account'->>'avatarUrl', 'active'
  )
  ON CONFLICT (tiktok_connection_id) DO UPDATE SET
    display_name = EXCLUDED.display_name, username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url, account_status = 'active';
  RETURN v_connection;
END;
$$;

REVOKE ALL ON FUNCTION public.register_tiktok_direct_post_state(text,uuid,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.consume_tiktok_direct_post_state(text,text,text,text) FROM PUBLIC,anon,authenticated,service_role;
REVOKE ALL ON FUNCTION public.persist_tiktok_direct_post_upgrade(text,text,jsonb,uuid,bigint) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.register_tiktok_direct_post_state(text,uuid,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_tiktok_direct_post_state(text,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.persist_tiktok_direct_post_upgrade(text,text,jsonb,uuid,bigint) TO service_role;
COMMIT;
