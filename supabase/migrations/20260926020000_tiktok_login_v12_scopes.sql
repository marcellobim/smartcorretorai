-- Accept only the two V12 Login Kit scope contracts and persist the granted set.
CREATE OR REPLACE FUNCTION public.persist_tiktok_login(p_environment TEXT, p_app_id TEXT, p_login JSONB)
RETURNS UUID LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
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
  IF p_environment IS NULL OR p_environment NOT IN ('sandbox', 'production')
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
     OR (
       p_login->'scopes' IS DISTINCT FROM '["user.info.basic"]'::JSONB
       AND p_login->'scopes' IS DISTINCT FROM '["user.info.basic","video.publish"]'::JSONB
     )
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

  INSERT INTO public.tiktok_connections AS existing (
    user_id, environment, app_id, open_id,
    access_token_ciphertext, access_token_nonce, access_token_auth_tag,
    refresh_token_ciphertext, refresh_token_nonce, refresh_token_auth_tag, key_version,
    access_token_expires_at, refresh_token_expires_at, scopes, connection_status
  ) VALUES (
    v_user, p_environment, p_app_id, v_open,
    p_login->>'accessTokenCiphertext', p_login->>'accessTokenNonce', p_login->>'accessTokenAuthTag',
    p_login->>'refreshTokenCiphertext', p_login->>'refreshTokenNonce', p_login->>'refreshTokenAuthTag', p_login->>'keyVersion',
    v_access_expiry, v_refresh_expiry,
    CASE WHEN p_login->'scopes' = '["user.info.basic","video.publish"]'::JSONB
      THEN ARRAY['user.info.basic','video.publish']::TEXT[]
      ELSE ARRAY['user.info.basic']::TEXT[]
    END,
    'active'
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
