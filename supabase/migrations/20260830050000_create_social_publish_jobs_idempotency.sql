-- Contrato privado e idempotente para registrar intencoes de publicacao social.
-- Esta migration nao publica conteudo e nao possui integracao com provedores externos.
CREATE TABLE public.social_oauth_states (
  state_hash TEXT PRIMARY KEY CHECK (state_hash ~ '^[0-9a-f]{64}$'),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  redirect_uri_hash TEXT NOT NULL CHECK (redirect_uri_hash ~ '^[0-9a-f]{64}$'),
  provider TEXT NOT NULL CHECK (provider = 'meta'),
  flow TEXT NOT NULL CHECK (flow = 'instagram_connection'),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CHECK (expires_at > created_at AND expires_at <= created_at + INTERVAL '5 minutes')
);
CREATE INDEX social_oauth_states_expiry_idx
  ON public.social_oauth_states(expires_at)
  WHERE consumed_at IS NULL;
ALTER TABLE public.social_oauth_states ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_oauth_states FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.social_oauth_states TO service_role;
CREATE OR REPLACE FUNCTION public.register_social_oauth_state(
  p_state_hash TEXT,
  p_user_id UUID,
  p_redirect_uri_hash TEXT,
  p_provider TEXT,
  p_flow TEXT,
  p_expires_at TIMESTAMPTZ
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
     OR p_state_hash !~ '^[0-9a-f]{64}$'
     OR p_redirect_uri_hash !~ '^[0-9a-f]{64}$'
     OR p_provider <> 'meta'
     OR p_flow <> 'instagram_connection'
     OR p_expires_at <= v_now
     OR p_expires_at > v_now + INTERVAL '5 minutes' THEN
    RAISE EXCEPTION 'invalid_oauth_state_registration' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.social_oauth_states(
    state_hash, user_id, redirect_uri_hash, provider, flow, expires_at, created_at
  ) VALUES (
    p_state_hash, p_user_id, p_redirect_uri_hash, p_provider, p_flow, p_expires_at, v_now
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.register_social_oauth_state(TEXT, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_social_oauth_state(TEXT, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;
CREATE OR REPLACE FUNCTION public.consume_social_oauth_state(
  p_state_hash TEXT,
  p_user_id UUID,
  p_redirect_uri_hash TEXT,
  p_provider TEXT,
  p_flow TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_consumed TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  UPDATE public.social_oauth_states
     SET consumed_at = v_now
   WHERE state_hash = p_state_hash
     AND user_id = p_user_id
     AND redirect_uri_hash = p_redirect_uri_hash
     AND provider = p_provider
     AND flow = p_flow
     AND consumed_at IS NULL
     AND expires_at > v_now
  RETURNING state_hash INTO v_consumed;

  RETURN v_consumed IS NOT NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.consume_social_oauth_state(TEXT, UUID, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_social_oauth_state(TEXT, UUID, TEXT, TEXT, TEXT)
  TO service_role;
CREATE TABLE public.social_publish_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  social_connection_id UUID NOT NULL REFERENCES public.social_connections(id) ON DELETE RESTRICT,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'tiktok')),
  idempotency_key UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(source_type)) BETWEEN 1 AND 80),
  source_id UUID NOT NULL,
  caption_snapshot TEXT CHECK (
    caption_snapshot IS NULL OR pg_catalog.length(caption_snapshot) <= 2200
  ),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'processing', 'publishing', 'reconciliation_required', 'retry_scheduled', 'published', 'failed', 'cancelled')
  ),
  claim_token UUID,
  claimed_at TIMESTAMPTZ,
  claim_expires_at TIMESTAMPTZ,
  external_post_id TEXT CHECK (
    external_post_id IS NULL OR external_post_id ~ '^[A-Za-z0-9._:-]{1,200}$'
  ),
  external_post_url TEXT CHECK (
    external_post_url IS NULL
    OR external_post_url ~* '^https://(www\.)?(instagram\.com|facebook\.com|linkedin\.com|tiktok\.com)/'
  ),
  error_code TEXT,
  external_publish_started_at TIMESTAMPTZ,
  external_container_id TEXT CHECK (
    external_container_id IS NULL OR external_container_id ~ '^[A-Za-z0-9._:-]{1,200}$'
  ),
  external_container_status TEXT CHECK (
    external_container_status IS NULL
    OR external_container_status IN ('IN_PROGRESS', 'FINISHED', 'ERROR', 'EXPIRED')
  ),
  poll_attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (poll_attempt_count >= 0),
  next_poll_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT social_publish_jobs_user_idempotency_unique UNIQUE (user_id, idempotency_key),
  CONSTRAINT social_publish_jobs_claim_fields_consistent CHECK (
    (claim_token IS NULL AND claimed_at IS NULL AND claim_expires_at IS NULL)
    OR
    (claim_token IS NOT NULL AND claimed_at IS NOT NULL AND claim_expires_at IS NOT NULL
      AND claim_expires_at > claimed_at)
  ),
  CONSTRAINT social_publish_jobs_irreversible_state_consistent CHECK (
    (status NOT IN ('publishing', 'published', 'reconciliation_required')
      OR external_publish_started_at IS NOT NULL)
    AND (status <> 'cancelled' OR external_publish_started_at IS NULL)
  ),
  CONSTRAINT social_publish_jobs_container_state_consistent CHECK (
    (external_container_status IS NULL OR external_container_id IS NOT NULL)
    AND (status NOT IN ('publishing', 'published') OR external_container_id IS NOT NULL)
  )
);
CREATE INDEX social_publish_jobs_user_created_idx
  ON public.social_publish_jobs(user_id, created_at DESC);
CREATE TABLE public.social_media_leases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.social_publish_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  bucket_id TEXT NOT NULL,
  object_path TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'video/mp4')),
  content_length BIGINT NOT NULL CHECK (content_length > 0),
  opaque_token_hash TEXT NOT NULL UNIQUE CHECK (opaque_token_hash ~ '^[a-f0-9]{64}$'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  CONSTRAINT social_media_leases_job_object_unique UNIQUE (job_id, bucket_id, object_path),
  CONSTRAINT social_media_leases_max_ttl CHECK (
    expires_at > created_at AND expires_at <= created_at + INTERVAL '24 hours'
  ),
  CONSTRAINT social_media_leases_terminal_timestamps CHECK (
    (status <> 'revoked' OR revoked_at IS NOT NULL)
    AND (status <> 'closed' OR closed_at IS NOT NULL)
  )
);
ALTER TABLE public.social_publish_jobs
  ADD COLUMN media_lease_id UUID REFERENCES public.social_media_leases(id) ON DELETE SET NULL;
CREATE INDEX social_media_leases_active_expiry_idx
  ON public.social_media_leases(expires_at)
  WHERE status = 'active';
ALTER TABLE public.social_media_leases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_media_leases FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.social_media_leases TO service_role;
ALTER TABLE public.social_connections
  ALTER COLUMN access_token DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS external_connection_id TEXT,
  ADD COLUMN IF NOT EXISTS access_token_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS access_token_nonce TEXT,
  ADD COLUMN IF NOT EXISTS access_token_auth_tag TEXT,
  ADD COLUMN IF NOT EXISTS page_access_token_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS page_access_token_nonce TEXT,
  ADD COLUMN IF NOT EXISTS page_access_token_auth_tag TEXT,
  ADD COLUMN IF NOT EXISTS key_version TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_validated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS connection_status TEXT NOT NULL DEFAULT 'reconnect_required',
  ADD COLUMN IF NOT EXISTS disconnected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS remote_revocation_status TEXT NOT NULL DEFAULT 'not_attempted',
  ADD COLUMN IF NOT EXISTS remote_revocation_attempted_at TIMESTAMPTZ;
ALTER TABLE public.social_connections
  DROP CONSTRAINT IF EXISTS social_connections_user_id_platform_key;
ALTER TABLE public.social_connections
  ADD CONSTRAINT social_connections_owner_provider_external_key
    UNIQUE (user_id, provider, external_connection_id),
  ADD CONSTRAINT social_connections_provider_identity_check CHECK (
    (provider IS NULL AND external_connection_id IS NULL)
    OR
    (provider = 'meta' AND external_connection_id ~ '^[A-Za-z0-9._:-]{1,200}$')
  ),
  ADD CONSTRAINT social_connections_id_owner_key UNIQUE (id, user_id);
CREATE TABLE public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  social_connection_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider = 'meta'),
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram')),
  external_account_id TEXT NOT NULL CHECK (external_account_id ~ '^[A-Za-z0-9._:-]{1,200}$'),
  parent_external_account_id TEXT CHECK (
    parent_external_account_id IS NULL OR parent_external_account_id ~ '^[A-Za-z0-9._:-]{1,200}$'
  ),
  display_name TEXT CHECK (display_name IS NULL OR pg_catalog.length(display_name) <= 200),
  username TEXT CHECK (username IS NULL OR pg_catalog.length(username) <= 200),
  account_status TEXT NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'disabled', 'reconnect_required')),
  credential_ciphertext TEXT,
  credential_nonce TEXT,
  credential_auth_tag TEXT,
  key_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
  CONSTRAINT social_accounts_connection_owner_fk
    FOREIGN KEY (social_connection_id, user_id)
    REFERENCES public.social_connections(id, user_id) ON DELETE CASCADE,
  CONSTRAINT social_accounts_owner_external_key
    UNIQUE (user_id, provider, platform, external_account_id),
  CONSTRAINT social_accounts_credential_check CHECK (
    (
      platform = 'facebook'
      AND account_status = 'active'
      AND credential_ciphertext IS NOT NULL
      AND credential_nonce IS NOT NULL
      AND credential_auth_tag IS NOT NULL
      AND key_version IS NOT NULL
      AND parent_external_account_id IS NULL
    )
    OR
    (
      platform = 'facebook'
      AND account_status IN ('disabled', 'reconnect_required')
      AND credential_ciphertext IS NULL
      AND credential_nonce IS NULL
      AND credential_auth_tag IS NULL
      AND key_version IS NULL
      AND parent_external_account_id IS NULL
    )
    OR
    (
      platform = 'instagram'
      AND credential_ciphertext IS NULL
      AND credential_nonce IS NULL
      AND credential_auth_tag IS NULL
      AND key_version IS NULL
      AND parent_external_account_id IS NOT NULL
    )
  )
);
CREATE INDEX social_accounts_connection_idx
  ON public.social_accounts(social_connection_id, platform, created_at);
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_accounts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.social_accounts TO service_role;
CREATE OR REPLACE FUNCTION public.list_owned_social_accounts()
RETURNS TABLE(
  account_id UUID,
  connection_id UUID,
  provider TEXT,
  platform TEXT,
  display_name TEXT,
  username TEXT,
  account_status TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT a.id, a.social_connection_id, a.provider, a.platform,
         a.display_name, a.username, a.account_status
    FROM public.social_accounts AS a
   WHERE a.user_id = auth.uid()
   ORDER BY a.platform, a.created_at, a.id;
$$;
REVOKE EXECUTE ON FUNCTION public.list_owned_social_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_owned_social_accounts() TO authenticated;
UPDATE public.social_connections
   SET expires_at = COALESCE(expires_at, token_expires_at),
       connection_status = 'reconnect_required',
       access_token = NULL,
       page_access_token = NULL,
       access_token_ciphertext = NULL,
       access_token_nonce = NULL,
       access_token_auth_tag = NULL,
       page_access_token_ciphertext = NULL,
       page_access_token_nonce = NULL,
       page_access_token_auth_tag = NULL,
       key_version = NULL
 WHERE access_token IS NOT NULL
    OR page_access_token IS NOT NULL
    OR connection_status NOT IN ('active', 'expired', 'revoked', 'reconnect_required');
ALTER TABLE public.social_connections
  ADD CONSTRAINT social_connections_lifecycle_status_check
    CHECK (connection_status IN ('active', 'expired', 'revoked', 'reconnect_required')),
  ADD CONSTRAINT social_connections_remote_revocation_status_check
    CHECK (remote_revocation_status IN ('not_attempted', 'pending', 'succeeded', 'failed')),
  ADD CONSTRAINT social_connections_ciphertext_lifecycle_check CHECK (
    (
      connection_status = 'active'
      AND access_token_ciphertext IS NOT NULL
      AND access_token_nonce IS NOT NULL
      AND access_token_auth_tag IS NOT NULL
      AND key_version IS NOT NULL
      AND expires_at IS NOT NULL
      AND access_token IS NULL
      AND page_access_token IS NULL
      AND (
        (page_access_token_ciphertext IS NULL AND page_access_token_nonce IS NULL AND page_access_token_auth_tag IS NULL)
        OR
        (page_access_token_ciphertext IS NOT NULL AND page_access_token_nonce IS NOT NULL AND page_access_token_auth_tag IS NOT NULL)
      )
    )
    OR
    (
      connection_status IN ('expired', 'revoked', 'reconnect_required')
      AND access_token_ciphertext IS NULL
      AND access_token_nonce IS NULL
      AND access_token_auth_tag IS NULL
      AND page_access_token_ciphertext IS NULL
      AND page_access_token_nonce IS NULL
      AND page_access_token_auth_tag IS NULL
      AND key_version IS NULL
      AND access_token IS NULL
      AND page_access_token IS NULL
    )
  );
CREATE OR REPLACE FUNCTION public.prevent_social_publish_job_caption_snapshot_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.caption_snapshot IS DISTINCT FROM OLD.caption_snapshot THEN
    RAISE EXCEPTION 'caption_snapshot_immutable' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER prevent_social_publish_job_caption_snapshot_update
  BEFORE UPDATE OF caption_snapshot ON public.social_publish_jobs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_social_publish_job_caption_snapshot_update();
REVOKE EXECUTE ON FUNCTION public.prevent_social_publish_job_caption_snapshot_update()
  FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE FUNCTION public.prevent_social_publish_job_container_replacement()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.external_container_id IS NOT NULL
     AND NEW.external_container_id IS DISTINCT FROM OLD.external_container_id THEN
    RAISE EXCEPTION 'external_container_id_immutable' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER prevent_social_publish_job_container_replacement
  BEFORE UPDATE OF external_container_id ON public.social_publish_jobs
  FOR EACH ROW EXECUTE FUNCTION public.prevent_social_publish_job_container_replacement();
REVOKE EXECUTE ON FUNCTION public.prevent_social_publish_job_container_replacement()
  FROM PUBLIC, anon, authenticated;
ALTER TABLE public.social_publish_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.social_publish_jobs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.social_publish_jobs TO service_role;
CREATE OR REPLACE FUNCTION public.create_or_reuse_social_publish_job(
  p_user_id UUID,
  p_social_connection_id UUID,
  p_platform TEXT,
  p_idempotency_key UUID,
  p_source_type TEXT,
  p_source_id UUID,
  p_caption TEXT DEFAULT NULL
)
RETURNS TABLE(job_id UUID, job_status TEXT, reused BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_job public.social_publish_jobs%ROWTYPE;
  v_platform TEXT := pg_catalog.lower(pg_catalog.btrim(p_platform));
  v_source_type TEXT := pg_catalog.btrim(p_source_type);
  v_caption_snapshot TEXT := p_caption;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_social_connection_id IS NULL OR p_idempotency_key IS NULL
     OR p_source_id IS NULL OR NULLIF(v_platform, '') IS NULL
     OR NULLIF(v_source_type, '') IS NULL
     OR pg_catalog.length(v_caption_snapshot) > 2200 THEN
    RAISE EXCEPTION 'invalid_social_publish_job' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.social_connections AS sc
     WHERE sc.id = p_social_connection_id
       AND sc.user_id = p_user_id
       AND sc.platform = v_platform
  ) THEN
    RAISE EXCEPTION 'invalid_social_connection' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.social_publish_jobs (
    user_id, social_connection_id, platform, idempotency_key,
    source_type, source_id, caption_snapshot, status
  ) VALUES (
    p_user_id, p_social_connection_id, v_platform, p_idempotency_key,
    v_source_type, p_source_id, v_caption_snapshot, 'queued'
  )
  ON CONFLICT (user_id, idempotency_key) DO NOTHING
  RETURNING * INTO v_job;

  IF FOUND THEN
    RETURN QUERY SELECT v_job.id, v_job.status, FALSE;
    RETURN;
  END IF;

  SELECT j.*
    INTO STRICT v_job
    FROM public.social_publish_jobs AS j
   WHERE j.user_id = p_user_id
     AND j.idempotency_key = p_idempotency_key;

  IF v_job.social_connection_id IS DISTINCT FROM p_social_connection_id
     OR v_job.platform IS DISTINCT FROM v_platform
     OR v_job.source_type IS DISTINCT FROM v_source_type
     OR v_job.source_id IS DISTINCT FROM p_source_id
     OR v_job.caption_snapshot IS DISTINCT FROM v_caption_snapshot THEN
    RAISE EXCEPTION 'idempotency_key_intent_mismatch' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY SELECT v_job.id, v_job.status, TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_or_reuse_social_publish_job(UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_reuse_social_publish_job(UUID, UUID, TEXT, UUID, TEXT, UUID, TEXT)
  TO service_role;
CREATE OR REPLACE FUNCTION public.claim_social_publish_job(
  p_job_id UUID,
  p_claim_ttl_seconds INTEGER DEFAULT 300
)
RETURNS TABLE(
  job_id UUID,
  job_status TEXT,
  worker_claim_token UUID,
  worker_claimed_at TIMESTAMPTZ,
  worker_claim_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_job public.social_publish_jobs%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_claim_ttl_seconds IS NULL
     OR p_claim_ttl_seconds NOT BETWEEN 30 AND 900 THEN
    RAISE EXCEPTION 'invalid_social_publish_claim' USING ERRCODE = '22023';
  END IF;

  UPDATE public.social_publish_jobs AS j
     SET status = 'processing',
         claim_token = pg_catalog.gen_random_uuid(),
         claimed_at = v_now,
         claim_expires_at = v_now + pg_catalog.make_interval(secs => p_claim_ttl_seconds),
         updated_at = v_now
   WHERE j.id = p_job_id
     AND (
       (j.status IN ('queued', 'retry_scheduled')
         AND j.claim_token IS NULL
         AND j.claimed_at IS NULL
         AND j.claim_expires_at IS NULL)
       OR
       (j.status = 'processing'
         AND j.claim_token IS NOT NULL
         AND j.claim_expires_at <= v_now)
     )
  RETURNING j.* INTO v_job;

  IF FOUND THEN
    RETURN QUERY SELECT
      v_job.id,
      v_job.status,
      v_job.claim_token,
      v_job.claimed_at,
      v_job.claim_expires_at;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_social_publish_job(UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_social_publish_job(UUID, INTEGER)
  TO service_role;
CREATE OR REPLACE FUNCTION public.create_or_reuse_social_media_lease(
  p_job_id UUID,
  p_bucket_id TEXT,
  p_object_path TEXT,
  p_content_type TEXT,
  p_content_length BIGINT,
  p_opaque_token_hash TEXT,
  p_ttl_seconds INTEGER,
  p_required_external_window_seconds INTEGER
)
RETURNS TABLE(lease_id UUID, lease_expires_at TIMESTAMPTZ, reused BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_job public.social_publish_jobs%ROWTYPE;
  v_lease public.social_media_leases%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR NULLIF(pg_catalog.btrim(p_bucket_id), '') IS NULL
     OR NULLIF(pg_catalog.btrim(p_object_path), '') IS NULL
     OR p_content_type IS NULL OR p_content_type NOT IN ('image/jpeg', 'image/png', 'video/mp4')
     OR p_content_length IS NULL OR p_content_length <= 0
     OR p_opaque_token_hash IS NULL OR p_opaque_token_hash !~ '^[a-f0-9]{64}$'
     OR p_ttl_seconds IS NULL OR p_ttl_seconds NOT BETWEEN 60 AND 86400
     OR p_required_external_window_seconds IS NULL
     OR p_required_external_window_seconds NOT BETWEEN 60 AND 86400
     OR p_ttl_seconds < p_required_external_window_seconds THEN
    RAISE EXCEPTION 'invalid_social_media_lease' USING ERRCODE = '22023';
  END IF;

  SELECT j.* INTO STRICT v_job
    FROM public.social_publish_jobs AS j
   WHERE j.id = p_job_id
   FOR UPDATE;

  IF v_job.status <> 'processing' OR v_job.external_publish_started_at IS NOT NULL
     OR p_object_path NOT LIKE v_job.user_id::TEXT || '/%' THEN
    RAISE EXCEPTION 'invalid_social_media_lease_scope' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets AS b
     WHERE b.id = p_bucket_id AND b.public IS FALSE
  ) THEN
    RAISE EXCEPTION 'private_bucket_required' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.social_media_leases(
    job_id, user_id, bucket_id, object_path, content_type, content_length,
    opaque_token_hash, status, created_at, expires_at
  ) VALUES (
    v_job.id, v_job.user_id, p_bucket_id, p_object_path, p_content_type, p_content_length,
    p_opaque_token_hash, 'active', v_now, v_now + pg_catalog.make_interval(secs => p_ttl_seconds)
  )
  ON CONFLICT (job_id, bucket_id, object_path) DO NOTHING
  RETURNING * INTO v_lease;

  IF FOUND THEN
    RETURN QUERY SELECT v_lease.id, v_lease.expires_at, FALSE;
    RETURN;
  END IF;

  SELECT l.* INTO STRICT v_lease
    FROM public.social_media_leases AS l
   WHERE l.job_id = p_job_id
     AND l.bucket_id = p_bucket_id
     AND l.object_path = p_object_path;

  IF v_lease.user_id IS DISTINCT FROM v_job.user_id
     OR v_lease.content_type IS DISTINCT FROM p_content_type
     OR v_lease.content_length IS DISTINCT FROM p_content_length
     OR v_lease.opaque_token_hash IS DISTINCT FROM p_opaque_token_hash
     OR v_lease.status <> 'active' OR v_lease.expires_at <= v_now THEN
    RAISE EXCEPTION 'social_media_lease_mismatch' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY SELECT v_lease.id, v_lease.expires_at, TRUE;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_or_reuse_social_media_lease(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_or_reuse_social_media_lease(UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, INTEGER, INTEGER)
  TO service_role;
CREATE OR REPLACE FUNCTION public.revoke_social_media_lease(p_lease_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.social_media_leases
     SET status = 'revoked', revoked_at = pg_catalog.clock_timestamp()
   WHERE id = p_lease_id AND status = 'active';
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.revoke_social_media_lease(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_social_media_lease(UUID) TO service_role;
CREATE OR REPLACE FUNCTION public.close_social_media_lease_if_safe(p_job_id UUID, p_lease_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.social_media_leases AS l
     SET status = 'closed', closed_at = pg_catalog.clock_timestamp()
    FROM public.social_publish_jobs AS j
   WHERE l.id = p_lease_id
     AND l.job_id = p_job_id
     AND l.status = 'active'
     AND j.id = l.job_id
     AND j.status IN ('published', 'failed', 'cancelled')
     AND j.external_container_status IS DISTINCT FROM 'IN_PROGRESS';
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.close_social_media_lease_if_safe(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.close_social_media_lease_if_safe(UUID, UUID) TO service_role;
CREATE OR REPLACE FUNCTION public.start_social_publish_job_container_polling(
  p_job_id UUID,
  p_claim_token UUID,
  p_external_container_id TEXT,
  p_next_poll_at TIMESTAMPTZ,
  p_media_lease_id UUID,
  p_min_remaining_lease_seconds INTEGER
)
RETURNS TABLE(job_id UUID, job_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_job public.social_publish_jobs%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_claim_token IS NULL
     OR p_external_container_id IS NULL
     OR p_external_container_id !~ '^[A-Za-z0-9._:-]{1,200}$'
     OR p_next_poll_at IS NULL OR p_next_poll_at < v_now
     OR p_media_lease_id IS NULL
     OR p_min_remaining_lease_seconds IS NULL
     OR p_min_remaining_lease_seconds NOT BETWEEN 60 AND 86400 THEN
    RAISE EXCEPTION 'invalid_social_publish_container_polling' USING ERRCODE = '22023';
  END IF;

  UPDATE public.social_publish_jobs AS j
     SET status = 'publishing',
         external_publish_started_at = v_now,
         external_container_id = p_external_container_id,
         external_container_status = 'IN_PROGRESS',
         poll_attempt_count = 0,
         next_poll_at = p_next_poll_at,
         media_lease_id = p_media_lease_id,
         updated_at = v_now
   WHERE j.id = p_job_id
     AND j.claim_token = p_claim_token
     AND j.status = 'processing'
     AND j.claim_expires_at > v_now
     AND j.external_container_id IS NULL
     AND EXISTS (
       SELECT 1 FROM public.social_media_leases AS l
        WHERE l.id = p_media_lease_id
          AND l.job_id = j.id
          AND l.user_id = j.user_id
          AND l.status = 'active'
          AND l.expires_at >= v_now + pg_catalog.make_interval(secs => p_min_remaining_lease_seconds)
     )
  RETURNING j.* INTO v_job;

  IF FOUND THEN
    RETURN QUERY SELECT v_job.id, v_job.status;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.start_social_publish_job_container_polling(UUID, UUID, TEXT, TIMESTAMPTZ, UUID, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_social_publish_job_container_polling(UUID, UUID, TEXT, TIMESTAMPTZ, UUID, INTEGER)
  TO service_role;
CREATE OR REPLACE FUNCTION public.record_social_publish_job_poll_result(
  p_job_id UUID,
  p_claim_token UUID,
  p_expected_status TEXT,
  p_external_container_id TEXT,
  p_external_status TEXT,
  p_next_poll_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(job_id UUID, job_status TEXT, poll_attempt_count INTEGER, next_poll_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_job public.social_publish_jobs%ROWTYPE;
  v_terminal_failure BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_claim_token IS NULL OR p_expected_status IS DISTINCT FROM 'publishing'
     OR p_external_container_id IS NULL
     OR p_external_status IS NULL
     OR p_external_status NOT IN ('IN_PROGRESS', 'FINISHED', 'ERROR', 'EXPIRED')
     OR (p_external_status = 'IN_PROGRESS' AND (p_next_poll_at IS NULL OR p_next_poll_at <= v_now))
     OR (p_external_status <> 'IN_PROGRESS' AND p_next_poll_at IS NOT NULL) THEN
    RAISE EXCEPTION 'invalid_social_publish_poll_result' USING ERRCODE = '22023';
  END IF;

  v_terminal_failure := p_external_status IN ('ERROR', 'EXPIRED');

  UPDATE public.social_publish_jobs AS j
     SET status = CASE WHEN v_terminal_failure THEN 'failed' ELSE j.status END,
         external_container_status = p_external_status,
         poll_attempt_count = j.poll_attempt_count + 1,
         next_poll_at = CASE WHEN p_external_status = 'IN_PROGRESS' THEN p_next_poll_at ELSE NULL END,
         error_code = CASE
           WHEN p_external_status = 'ERROR' THEN 'social_publish_failed'
           WHEN p_external_status = 'EXPIRED' THEN 'external_container_expired'
           ELSE NULL
         END,
         claim_token = CASE WHEN v_terminal_failure THEN NULL ELSE j.claim_token END,
         claimed_at = CASE WHEN v_terminal_failure THEN NULL ELSE j.claimed_at END,
         claim_expires_at = CASE WHEN v_terminal_failure THEN NULL ELSE j.claim_expires_at END,
         updated_at = v_now
   WHERE j.id = p_job_id
     AND j.claim_token = p_claim_token
     AND j.status = p_expected_status
     AND j.claim_expires_at > v_now
     AND j.external_container_id = p_external_container_id
  RETURNING j.* INTO v_job;

  IF FOUND THEN
    IF v_terminal_failure AND v_job.media_lease_id IS NOT NULL
       AND v_job.external_container_status IS DISTINCT FROM 'IN_PROGRESS' THEN
      UPDATE public.social_media_leases
         SET status = 'closed', closed_at = v_now
       WHERE id = v_job.media_lease_id AND job_id = v_job.id AND status = 'active';
    END IF;
    RETURN QUERY SELECT v_job.id, v_job.status, v_job.poll_attempt_count, v_job.next_poll_at;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_social_publish_job_poll_result(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_social_publish_job_poll_result(UUID, UUID, TEXT, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;
CREATE OR REPLACE FUNCTION public.defer_social_publish_job_poll_timeout(
  p_job_id UUID,
  p_claim_token UUID,
  p_expected_status TEXT,
  p_external_container_id TEXT,
  p_next_poll_at TIMESTAMPTZ
)
RETURNS TABLE(job_id UUID, job_status TEXT, poll_attempt_count INTEGER, next_poll_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_job public.social_publish_jobs%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_claim_token IS NULL OR p_expected_status IS DISTINCT FROM 'publishing'
     OR p_external_container_id IS NULL
     OR p_next_poll_at IS NULL OR p_next_poll_at <= v_now THEN
    RAISE EXCEPTION 'invalid_social_publish_poll_timeout' USING ERRCODE = '22023';
  END IF;

  UPDATE public.social_publish_jobs AS j
     SET poll_attempt_count = j.poll_attempt_count + 1,
         next_poll_at = p_next_poll_at,
         updated_at = v_now
   WHERE j.id = p_job_id
     AND j.claim_token = p_claim_token
     AND j.status = p_expected_status
     AND j.claim_expires_at > v_now
     AND j.external_container_id = p_external_container_id
  RETURNING j.* INTO v_job;

  IF FOUND THEN
    RETURN QUERY SELECT v_job.id, v_job.status, v_job.poll_attempt_count, v_job.next_poll_at;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.defer_social_publish_job_poll_timeout(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.defer_social_publish_job_poll_timeout(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;
CREATE OR REPLACE FUNCTION public.transition_claimed_social_publish_job(
  p_job_id UUID,
  p_claim_token UUID,
  p_expected_status TEXT,
  p_next_status TEXT
)
RETURNS TABLE(job_id UUID, job_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_job public.social_publish_jobs%ROWTYPE;
  v_release_claim BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_claim_token IS NULL
     OR p_expected_status IS NULL OR p_next_status IS NULL OR NOT (
    (p_expected_status = 'processing' AND p_next_status IN ('retry_scheduled', 'failed'))
    OR (p_expected_status = 'publishing' AND p_next_status IN ('published', 'reconciliation_required'))
  ) THEN
    RAISE EXCEPTION 'invalid_social_publish_transition' USING ERRCODE = '22023';
  END IF;

  v_release_claim := p_next_status IN (
    'retry_scheduled', 'published', 'reconciliation_required', 'failed'
  );

  UPDATE public.social_publish_jobs AS j
     SET status = p_next_status,
         claim_token = CASE WHEN v_release_claim THEN NULL ELSE j.claim_token END,
         claimed_at = CASE WHEN v_release_claim THEN NULL ELSE j.claimed_at END,
         claim_expires_at = CASE WHEN v_release_claim THEN NULL ELSE j.claim_expires_at END,
         updated_at = v_now
   WHERE j.id = p_job_id
     AND j.claim_token = p_claim_token
     AND j.status = p_expected_status
     AND j.claim_expires_at > v_now
     AND (p_next_status <> 'published' OR j.external_container_status = 'FINISHED')
  RETURNING j.* INTO v_job;

  IF FOUND THEN
    IF p_next_status IN ('published', 'failed') AND v_job.media_lease_id IS NOT NULL
       AND v_job.external_container_status IS DISTINCT FROM 'IN_PROGRESS' THEN
      UPDATE public.social_media_leases
         SET status = 'closed', closed_at = v_now
       WHERE id = v_job.media_lease_id AND job_id = v_job.id AND status = 'active';
    END IF;
    RETURN QUERY SELECT v_job.id, v_job.status;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.transition_claimed_social_publish_job(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transition_claimed_social_publish_job(UUID, UUID, TEXT, TEXT)
  TO service_role;
CREATE OR REPLACE FUNCTION public.get_social_publish_job_recovery(p_job_id UUID)
RETURNS TABLE(
  job_id UUID,
  public_status TEXT,
  destination TEXT,
  social_account TEXT,
  source_type TEXT,
  source_id UUID,
  caption_snapshot TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  external_post_id TEXT,
  external_post_link TEXT,
  public_error_code TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    j.id AS job_id,
    CASE
      WHEN j.status IN ('queued', 'retry_scheduled') THEN 'queued'
      WHEN j.status IN ('processing', 'publishing', 'reconciliation_required') THEN 'processing'
      WHEN j.status = 'published' THEN 'published'
      WHEN j.status = 'failed' THEN 'failed'
      WHEN j.status = 'cancelled' THEN 'cancelled'
    END AS public_status,
    j.platform AS destination,
    CASE
      WHEN j.platform = 'instagram' THEN sc.ig_username
      ELSE NULL
    END AS social_account,
    j.source_type,
    j.source_id,
    j.caption_snapshot,
    j.created_at,
    j.updated_at,
    CASE WHEN j.status = 'published' THEN j.external_post_id ELSE NULL END,
    CASE WHEN j.status = 'published' THEN j.external_post_url ELSE NULL END,
    CASE
      WHEN j.status <> 'failed' THEN NULL
      WHEN j.error_code IN ('social_account_not_connected', 'instagram_not_connected')
        THEN 'social_account_not_connected'
      WHEN j.error_code IN ('social_reconnect_required', 'instagram_reconnect_required')
        THEN 'social_reconnect_required'
      WHEN j.error_code = 'invalid_media_source' THEN 'invalid_media_source'
      WHEN j.error_code = 'publish_timeout' THEN 'publish_timeout'
      WHEN j.error_code = 'external_container_expired' THEN 'external_container_expired'
      ELSE 'social_publish_failed'
    END AS public_error_code
  FROM public.social_publish_jobs AS j
  JOIN public.social_connections AS sc
    ON sc.id = j.social_connection_id
   AND sc.user_id = j.user_id
  WHERE j.id = p_job_id
    AND j.user_id = auth.uid();
$$;
REVOKE EXECUTE ON FUNCTION public.get_social_publish_job_recovery(UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_social_publish_job_recovery(UUID)
  TO authenticated;
CREATE OR REPLACE FUNCTION public.cancel_social_publish_job(
  p_job_id UUID,
  p_expected_status TEXT
)
RETURNS TABLE(job_id UUID, job_status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_job public.social_publish_jobs%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  IF p_job_id IS NULL OR p_expected_status IS NULL
     OR p_expected_status NOT IN ('queued', 'processing') THEN
    RAISE EXCEPTION 'invalid_social_publish_cancellation' USING ERRCODE = '22023';
  END IF;

  UPDATE public.social_publish_jobs AS j
     SET status = 'cancelled',
         claim_token = NULL,
         claimed_at = NULL,
         claim_expires_at = NULL,
         updated_at = v_now
   WHERE j.id = p_job_id
     AND j.user_id = auth.uid()
     AND j.status = p_expected_status
     AND j.external_publish_started_at IS NULL
  RETURNING j.* INTO v_job;

  IF FOUND THEN
    IF v_job.media_lease_id IS NOT NULL THEN
      UPDATE public.social_media_leases
         SET status = 'closed', closed_at = v_now
       WHERE id = v_job.media_lease_id AND job_id = v_job.id AND status = 'active';
    END IF;
    RETURN QUERY SELECT v_job.id, v_job.status;
  END IF;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.cancel_social_publish_job(UUID, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_social_publish_job(UUID, TEXT)
  TO authenticated;
CREATE OR REPLACE FUNCTION public.record_social_connection_validation(
  p_connection_id UUID,
  p_expected_status TEXT,
  p_validation_status TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  IF p_connection_id IS NULL OR p_expected_status IS NULL
     OR p_validation_status NOT IN ('active', 'expired', 'revoked', 'reconnect_required')
     OR (p_validation_status = 'active' AND (p_expires_at IS NULL OR p_expires_at <= v_now)) THEN
    RAISE EXCEPTION 'invalid_social_connection_validation' USING ERRCODE = '22023';
  END IF;

  UPDATE public.social_connections
     SET connection_status = p_validation_status,
         expires_at = p_expires_at,
         last_validated_at = v_now,
         access_token = NULL,
         page_access_token = NULL,
         access_token_ciphertext = CASE WHEN p_validation_status = 'active' THEN access_token_ciphertext ELSE NULL END,
         access_token_nonce = CASE WHEN p_validation_status = 'active' THEN access_token_nonce ELSE NULL END,
         access_token_auth_tag = CASE WHEN p_validation_status = 'active' THEN access_token_auth_tag ELSE NULL END,
         page_access_token_ciphertext = CASE WHEN p_validation_status = 'active' THEN page_access_token_ciphertext ELSE NULL END,
         page_access_token_nonce = CASE WHEN p_validation_status = 'active' THEN page_access_token_nonce ELSE NULL END,
         page_access_token_auth_tag = CASE WHEN p_validation_status = 'active' THEN page_access_token_auth_tag ELSE NULL END,
         key_version = CASE WHEN p_validation_status = 'active' THEN key_version ELSE NULL END,
         updated_at = v_now
   WHERE id = p_connection_id
     AND connection_status = p_expected_status
     AND (p_validation_status <> 'active' OR access_token_ciphertext IS NOT NULL);
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_social_connection_validation(UUID, TEXT, TEXT, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_social_connection_validation(UUID, TEXT, TEXT, TIMESTAMPTZ)
  TO service_role;
CREATE OR REPLACE FUNCTION public.disconnect_social_connection(p_connection_id UUID)
RETURNS TABLE(
  connection_id UUID,
  connection_status TEXT,
  cancelled_job_count INTEGER,
  revoked_lease_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  v_connection public.social_connections%ROWTYPE;
  v_cancelled INTEGER := 0;
  v_revoked INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
  END IF;

  SELECT sc.* INTO STRICT v_connection
    FROM public.social_connections AS sc
   WHERE sc.id = p_connection_id
     AND sc.user_id = auth.uid()
   FOR UPDATE;

  UPDATE public.social_connections
     SET connection_status = 'revoked',
         access_token = NULL,
         page_access_token = NULL,
         access_token_ciphertext = NULL,
         access_token_nonce = NULL,
         access_token_auth_tag = NULL,
         page_access_token_ciphertext = NULL,
         page_access_token_nonce = NULL,
         page_access_token_auth_tag = NULL,
         key_version = NULL,
         disconnected_at = v_now,
         remote_revocation_status = 'pending',
         remote_revocation_attempted_at = v_now,
         updated_at = v_now
   WHERE id = v_connection.id;

  UPDATE public.social_accounts
     SET account_status = 'reconnect_required',
         credential_ciphertext = NULL,
         credential_nonce = NULL,
         credential_auth_tag = NULL,
         key_version = NULL,
         updated_at = v_now
   WHERE social_connection_id = v_connection.id
     AND user_id = v_connection.user_id;

  UPDATE public.social_publish_jobs AS j
     SET status = 'cancelled',
         claim_token = NULL,
         claimed_at = NULL,
         claim_expires_at = NULL,
         updated_at = v_now
   WHERE j.social_connection_id = v_connection.id
     AND j.user_id = v_connection.user_id
     AND j.status IN ('queued', 'processing')
     AND j.external_publish_started_at IS NULL;
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  UPDATE public.social_media_leases AS l
     SET status = 'revoked', revoked_at = v_now
    FROM public.social_publish_jobs AS j
   WHERE j.id = l.job_id
     AND j.social_connection_id = v_connection.id
     AND j.user_id = v_connection.user_id
     AND l.status = 'active'
     AND j.external_container_status IS DISTINCT FROM 'IN_PROGRESS';
  GET DIAGNOSTICS v_revoked = ROW_COUNT;

  RETURN QUERY SELECT v_connection.id, 'revoked'::TEXT, v_cancelled, v_revoked;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RETURN;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.disconnect_social_connection(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.disconnect_social_connection(UUID) TO authenticated;
CREATE OR REPLACE FUNCTION public.disconnect_social_connection_backend(
  p_connection_id UUID,
  p_authenticated_user_id UUID
)
RETURNS TABLE(
  connection_id UUID,
  connection_status TEXT,
  cancelled_job_count INTEGER,
  revoked_lease_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     OR p_connection_id IS NULL OR p_authenticated_user_id IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_authenticated_user_id::TEXT, TRUE);
  RETURN QUERY SELECT * FROM public.disconnect_social_connection(p_connection_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.disconnect_social_connection_backend(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.disconnect_social_connection_backend(UUID, UUID)
  TO service_role;
CREATE OR REPLACE FUNCTION public.record_social_connection_remote_revocation(
  p_connection_id UUID,
  p_succeeded BOOLEAN
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' OR p_succeeded IS NULL THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
  UPDATE public.social_connections
     SET remote_revocation_status = CASE WHEN p_succeeded THEN 'succeeded' ELSE 'failed' END,
         remote_revocation_attempted_at = pg_catalog.clock_timestamp(),
         updated_at = pg_catalog.clock_timestamp()
   WHERE id = p_connection_id
     AND connection_status = 'revoked'
     AND access_token_ciphertext IS NULL
     AND page_access_token_ciphertext IS NULL;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.record_social_connection_remote_revocation(UUID, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_social_connection_remote_revocation(UUID, BOOLEAN)
  TO service_role;
