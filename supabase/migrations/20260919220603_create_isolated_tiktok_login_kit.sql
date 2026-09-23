-- Non-null boolean predicate: no partial envelope can pass through SQL UNKNOWN.
CREATE FUNCTION public.tiktok_envelope_valid(c TEXT, n TEXT, t TEXT, e TIMESTAMPTZ)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF c IS NULL AND n IS NULL AND t IS NULL AND e IS NULL THEN RETURN TRUE; END IF;
  IF c IS NULL OR n IS NULL OR t IS NULL OR e IS NULL THEN RETURN FALSE; END IF;
  IF NOT pg_catalog.isfinite(e) OR pg_catalog.length(c) NOT BETWEEN 1 AND 16384
     OR c !~ '^[A-Za-z0-9+/]+={0,2}$'
     OR n !~ '^[A-Za-z0-9+/]{16}$'
     OR t !~ '^[A-Za-z0-9+/]{22}==$' THEN RETURN FALSE; END IF;
  RETURN pg_catalog.length(pg_catalog.decode(c, 'base64')) > 0
    AND pg_catalog.length(pg_catalog.decode(n, 'base64')) = 12
    AND pg_catalog.length(pg_catalog.decode(t, 'base64')) = 16
    AND pg_catalog.replace(pg_catalog.encode(pg_catalog.decode(c, 'base64'), 'base64'), E'\n', '') = c
    AND pg_catalog.encode(pg_catalog.decode(t, 'base64'), 'base64') = t;
EXCEPTION WHEN OTHERS THEN RETURN FALSE;
END;
$$;
REVOKE ALL ON FUNCTION public.tiktok_envelope_valid(TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tiktok_envelope_valid(TEXT, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

-- Isolated persistence for TikTok Login Kit.
-- This migration does not connect TikTok to the existing social publishing system.

CREATE TABLE public.tiktok_oauth_states (
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  app_id TEXT NOT NULL CHECK (app_id ~ '^[0-9a-f]{64}$'),
  state_hash TEXT PRIMARY KEY
    CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  user_id UUID NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri_hash TEXT NOT NULL
    CHECK (redirect_uri_hash ~ '^[0-9a-f]{64}$'),
  provider TEXT NOT NULL DEFAULT 'tiktok'
    CHECK (provider = 'tiktok'),
  flow TEXT NOT NULL DEFAULT 'tiktok_login_kit'
    CHECK (flow = 'tiktok_login_kit'),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT tiktok_oauth_states_short_ttl_check
    CHECK (
      expires_at > created_at
      AND expires_at <= created_at + INTERVAL '5 minutes'
    ),
  CONSTRAINT tiktok_oauth_states_consumed_at_check
    CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX tiktok_oauth_states_unconsumed_expiry_idx
  ON public.tiktok_oauth_states (expires_at)
  WHERE consumed_at IS NULL;

CREATE INDEX tiktok_oauth_states_user_created_idx
  ON public.tiktok_oauth_states (user_id, created_at DESC);

ALTER TABLE public.tiktok_oauth_states ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tiktok_oauth_states
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tiktok_oauth_states
  TO service_role;

CREATE FUNCTION public.register_tiktok_oauth_state(
  p_state_hash TEXT,
  p_user_id UUID,
  p_redirect_uri_hash TEXT,
  p_environment TEXT,
  p_app_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL
     OR p_state_hash IS NULL
     OR p_state_hash !~ '^[0-9a-f]{64}$'
     OR p_redirect_uri_hash IS NULL
     OR p_redirect_uri_hash !~ '^[0-9a-f]{64}$'
     OR p_environment IS NULL OR p_environment NOT IN ('sandbox', 'production')
     OR p_app_id IS NULL OR p_app_id !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid_tiktok_oauth_state_registration'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.tiktok_oauth_states (
    environment, app_id,
    state_hash,
    user_id,
    redirect_uri_hash,
    provider,
    flow,
    expires_at,
    created_at
  ) VALUES (
    p_environment, p_app_id,
    p_state_hash,
    p_user_id,
    p_redirect_uri_hash,
    'tiktok',
    'tiktok_login_kit',
    v_now + INTERVAL '5 minutes',
    v_now
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.register_tiktok_oauth_state(TEXT, UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_tiktok_oauth_state(TEXT, UUID, TEXT, TEXT, TEXT)
  TO service_role;

CREATE FUNCTION public.consume_tiktok_oauth_state(
  p_state_hash TEXT,
  p_redirect_uri_hash TEXT,
  p_environment TEXT,
  p_app_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_user_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_state_hash IS NULL
     OR p_state_hash !~ '^[0-9a-f]{64}$'
     OR p_redirect_uri_hash IS NULL
     OR p_redirect_uri_hash !~ '^[0-9a-f]{64}$'
     OR p_environment IS NULL OR p_environment NOT IN ('sandbox', 'production')
     OR p_app_id IS NULL OR p_app_id !~ '^[0-9a-f]{64}$' THEN
    RETURN NULL;
  END IF;

  UPDATE public.tiktok_oauth_states
     SET consumed_at = pg_catalog.clock_timestamp()
   WHERE state_hash = p_state_hash
     AND environment = p_environment
     AND app_id = p_app_id
     AND redirect_uri_hash = p_redirect_uri_hash
     AND provider = 'tiktok'
     AND flow = 'tiktok_login_kit'
     AND consumed_at IS NULL
     AND expires_at > pg_catalog.clock_timestamp()
  RETURNING user_id INTO v_user_id;

  RETURN v_user_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_tiktok_oauth_state(TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_tiktok_oauth_state(TEXT, TEXT, TEXT, TEXT)
  TO service_role;

CREATE TABLE public.tiktok_connections (
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  app_id TEXT NOT NULL CHECK (app_id ~ '^[0-9a-f]{64}$'),
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'tiktok'
    CHECK (provider = 'tiktok'),
  open_id TEXT NOT NULL
    CHECK (pg_catalog.length(pg_catalog.btrim(open_id)) BETWEEN 1 AND 255),
  access_token_ciphertext TEXT,
  access_token_nonce TEXT,
  access_token_auth_tag TEXT,
  refresh_token_ciphertext TEXT,
  refresh_token_nonce TEXT,
  refresh_token_auth_tag TEXT,
  key_version TEXT
    CONSTRAINT tiktok_connections_key_version_format_check
    CHECK (
      key_version IS NULL
      OR key_version ~ '^[A-Za-z0-9._-]{1,64}$'
    ),
  access_token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  connection_status TEXT NOT NULL DEFAULT 'active'
    CHECK (
      connection_status IN (
        'active',
        'expired',
        'revoked',
        'reconnect_required'
      )
    ),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  token_version BIGINT NOT NULL DEFAULT 1 CHECK (token_version > 0),
  last_refreshed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.transaction_timestamp(),
  CONSTRAINT tiktok_connections_open_id_unique UNIQUE (environment, app_id, open_id),
  CONSTRAINT tiktok_connections_identity_unique UNIQUE (id, user_id, environment, app_id, open_id),
  CONSTRAINT tiktok_connections_access_envelope_check CHECK (
    public.tiktok_envelope_valid(access_token_ciphertext, access_token_nonce, access_token_auth_tag, access_token_expires_at)
  ),
  CONSTRAINT tiktok_connections_refresh_envelope_check CHECK (
    public.tiktok_envelope_valid(refresh_token_ciphertext, refresh_token_nonce, refresh_token_auth_tag, refresh_token_expires_at)
  ),
  CONSTRAINT tiktok_connections_key_version_check CHECK (
    (
      access_token_ciphertext IS NULL
      AND refresh_token_ciphertext IS NULL
      AND key_version IS NULL
    )
    OR
    (
      access_token_ciphertext IS NOT NULL
      AND refresh_token_ciphertext IS NOT NULL
      AND key_version IS NOT NULL
    )
  ),
  CONSTRAINT tiktok_connections_distinct_nonces_check CHECK (
    access_token_nonce IS NULL
    OR refresh_token_nonce IS NULL
    OR access_token_nonce <> refresh_token_nonce
  ),
  CONSTRAINT tiktok_connections_active_tokens_check CHECK (
    connection_status <> 'active'
    OR (
      access_token_ciphertext IS NOT NULL
      AND refresh_token_ciphertext IS NOT NULL
    )
  ),
  CONSTRAINT tiktok_connections_revocation_check CHECK (
    (
      connection_status = 'revoked'
      AND revoked_at IS NOT NULL
      AND access_token_ciphertext IS NULL
      AND refresh_token_ciphertext IS NULL
    )
    OR
    (
      connection_status <> 'revoked'
      AND revoked_at IS NULL
    )
  ),
  CONSTRAINT tiktok_connections_scopes_check CHECK (
    pg_catalog.cardinality(scopes) <= 100
    AND pg_catalog.array_position(scopes, NULL) IS NULL
  ),
  CONSTRAINT tiktok_connections_timestamps_check CHECK (
    updated_at >= created_at
    AND connected_at >= created_at
    AND (last_refreshed_at IS NULL OR last_refreshed_at >= created_at)
    AND (revoked_at IS NULL OR revoked_at >= created_at)
  )
);

CREATE INDEX tiktok_connections_user_status_idx
  ON public.tiktok_connections (user_id, connection_status);

CREATE INDEX tiktok_connections_refresh_expiry_idx
  ON public.tiktok_connections (refresh_token_expires_at)
  WHERE refresh_token_ciphertext IS NOT NULL;

ALTER TABLE public.tiktok_connections ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tiktok_connections
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tiktok_connections
  TO service_role;

CREATE TABLE public.tiktok_accounts (
  environment TEXT NOT NULL CHECK (environment IN ('sandbox', 'production')),
  app_id TEXT NOT NULL CHECK (app_id ~ '^[0-9a-f]{64}$'),
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL
    REFERENCES auth.users(id) ON DELETE CASCADE,
  tiktok_connection_id UUID NOT NULL,
  open_id TEXT NOT NULL
    CHECK (pg_catalog.length(pg_catalog.btrim(open_id)) BETWEEN 1 AND 255),
  display_name TEXT
    CHECK (
      display_name IS NULL
      OR pg_catalog.length(pg_catalog.btrim(display_name)) BETWEEN 1 AND 200
    ),
  username TEXT
    CHECK (
      username IS NULL
      OR pg_catalog.length(pg_catalog.btrim(username)) BETWEEN 1 AND 100
    ),
  avatar_url TEXT
    CHECK (
      avatar_url IS NULL
      OR (
        pg_catalog.length(avatar_url) <= 2048
        AND avatar_url ~ '^https://'
      )
    ),
  account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'unavailable', 'disconnected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT tiktok_accounts_connection_unique
    UNIQUE (tiktok_connection_id),
  CONSTRAINT tiktok_accounts_user_open_id_unique
    UNIQUE (user_id, environment, app_id, open_id),
  CONSTRAINT tiktok_accounts_connection_identity_fk
    FOREIGN KEY (tiktok_connection_id, user_id, environment, app_id, open_id)
    REFERENCES public.tiktok_connections (id, user_id, environment, app_id, open_id)
    ON DELETE CASCADE,
  CONSTRAINT tiktok_accounts_timestamps_check
    CHECK (updated_at >= created_at)
);

CREATE INDEX tiktok_accounts_user_status_idx
  ON public.tiktok_accounts (user_id, account_status);

ALTER TABLE public.tiktok_accounts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.tiktok_accounts
  FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tiktok_accounts
  TO service_role;

-- All persistence timestamps belong to the database. No Edge clock enters INSERT.
CREATE FUNCTION public.tiktok_database_timestamps()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := v_now;
    NEW.updated_at := v_now;
    IF TG_TABLE_NAME = 'tiktok_connections' THEN
      NEW.connected_at := v_now;
      NEW.token_version := 1;
    END IF;
  ELSE
    IF (NEW.environment, NEW.app_id, NEW.user_id, NEW.open_id)
        IS DISTINCT FROM (OLD.environment, OLD.app_id, OLD.user_id, OLD.open_id) THEN
      RAISE EXCEPTION 'tiktok_identity_immutable' USING ERRCODE = '22023';
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := GREATEST(v_now, OLD.updated_at);
    IF TG_TABLE_NAME = 'tiktok_connections' THEN
      NEW.connected_at := OLD.connected_at;
      NEW.token_version := OLD.token_version + 1;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tiktok_database_timestamps() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.tiktok_database_timestamps() TO service_role;
CREATE TRIGGER tiktok_connections_database_timestamps BEFORE INSERT OR UPDATE ON public.tiktok_connections
  FOR EACH ROW EXECUTE FUNCTION public.tiktok_database_timestamps();
CREATE TRIGGER tiktok_accounts_database_timestamps BEFORE INSERT OR UPDATE ON public.tiktok_accounts
  FOR EACH ROW EXECUTE FUNCTION public.tiktok_database_timestamps();

-- One RPC/transaction. Any account constraint failure rolls back the connection too.
-- No EXCEPTION handler may swallow a persistence error here.
CREATE FUNCTION public.persist_tiktok_login(p_environment TEXT, p_app_id TEXT, p_login JSONB)
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
     OR p_login->'scopes' IS DISTINCT FROM '["user.info.basic"]'::JSONB
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
    v_access_expiry, v_refresh_expiry, ARRAY['user.info.basic'], 'active'
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
REVOKE ALL ON FUNCTION public.persist_tiktok_login(TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.persist_tiktok_login(TEXT, TEXT, JSONB) TO service_role;
