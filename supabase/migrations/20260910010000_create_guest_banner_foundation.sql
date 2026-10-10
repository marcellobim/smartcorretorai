-- Phase 1 foundation only. No provider, credit, account analytics or storage changes.
-- Application generation gate is ALSO closed; enabling this row alone is insufficient.
BEGIN;

CREATE TABLE public.guest_banner_policy (
  singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
  generation_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  daily_limit INTEGER NOT NULL DEFAULT 0 CHECK (daily_limit BETWEEN 0 AND 1000)
);
INSERT INTO public.guest_banner_policy DEFAULT VALUES;

CREATE TABLE public.guest_banner_sessions (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[a-f0-9]{64}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now() + INTERVAL '7 days'
);
CREATE INDEX guest_banner_sessions_expiry ON public.guest_banner_sessions(expires_at);

CREATE TABLE public.guest_banner_rate_windows (
  scope TEXT NOT NULL CHECK (scope IN ('session_issue', 'session_event', 'generation_attempt', 'network_promotion')),
  signal_hash TEXT NOT NULL CHECK (signal_hash ~ '^[a-f0-9]{64}$'),
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL CHECK (hits > 0),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (scope, signal_hash, window_start)
);
CREATE INDEX guest_banner_rate_expiry ON public.guest_banner_rate_windows(expires_at);

CREATE TABLE public.guest_banner_events (
  session_id UUID NOT NULL REFERENCES public.guest_banner_sessions(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'guest_landing_started', 'guest_banner_started', 'guest_generation_clicked',
    'guest_generation_completed', 'guest_signup_gate_shown', 'guest_claim_completed'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  PRIMARY KEY (session_id, event_type)
);
CREATE INDEX guest_banner_events_time ON public.guest_banner_events(created_at);

-- Aggregate promotional accounting, never ST. Keeps no guest/account identifiers.
CREATE TABLE public.guest_banner_daily_costs (
  day DATE PRIMARY KEY,
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed >= 0 AND completed <= reserved),
  cost_microusd BIGINT NOT NULL DEFAULT 0 CHECK (cost_microusd >= 0)
);

CREATE TABLE public.guest_banner_requests (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES public.guest_banner_sessions(id) ON DELETE CASCADE,
  client_request_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'dispatching', 'completed', 'failed', 'unknown')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  completed_at TIMESTAMPTZ,
  cost_microusd BIGINT CHECK (cost_microusd >= 0),
  UNIQUE (session_id, client_request_id)
);

-- Private artifact reference only. The official Banner delivery adapter is phase 2.
-- No URL, bucket, briefing, image, text or client-supplied metadata in this schema.
CREATE TABLE public.guest_banner_results (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  request_id UUID NOT NULL UNIQUE REFERENCES public.guest_banner_requests(id) ON DELETE CASCADE,
  artifact_ref UUID NOT NULL UNIQUE,
  claim_hash TEXT NOT NULL UNIQUE CHECK (claim_hash ~ '^[a-f0-9]{64}$'),
  claim_expires_at TIMESTAMPTZ NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ,
  CHECK ((owner_id IS NULL) = (claimed_at IS NULL))
);

DO $$
DECLARE v_table TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY['guest_banner_policy', 'guest_banner_sessions', 'guest_banner_rate_windows',
    'guest_banner_events', 'guest_banner_daily_costs', 'guest_banner_requests', 'guest_banner_results']
  LOOP
    EXECUTE pg_catalog.format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE pg_catalog.format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', v_table);
    EXECUTE pg_catalog.format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', v_table);
    EXECUTE pg_catalog.format('GRANT ALL ON TABLE public.%I TO service_role', v_table);
  END LOOP;
END;
$$;

CREATE FUNCTION public.guest_banner_rate_take(p_scope TEXT, p_hash TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_start TIMESTAMPTZ; v_limit INTEGER; v_hits INTEGER;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  IF p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_signal'; END IF;
  CASE p_scope
    WHEN 'session_issue' THEN v_limit := 60;
    WHEN 'session_event' THEN v_limit := 120;
    WHEN 'generation_attempt' THEN v_limit := 10;
    WHEN 'network_promotion' THEN v_limit := 10;
    ELSE RAISE EXCEPTION 'invalid_scope';
  END CASE;
  v_start := pg_catalog.date_trunc('hour', pg_catalog.now());
  INSERT INTO public.guest_banner_rate_windows AS rate(scope, signal_hash, window_start, hits, expires_at)
    VALUES (p_scope, p_hash, v_start, 1, v_start + INTERVAL '48 hours')
    ON CONFLICT (scope, signal_hash, window_start) DO UPDATE
    SET hits = LEAST(rate.hits + 1, 10000)
    RETURNING hits INTO v_hits;
  RETURN v_hits <= v_limit;
END;
$$;

CREATE FUNCTION public.guest_banner_open(p_existing_hash TEXT, p_new_hash TEXT, p_network_hash TEXT, p_event_type TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session public.guest_banner_sessions%ROWTYPE; v_new BOOLEAN := FALSE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  IF p_event_type IS NULL OR p_event_type NOT IN ('guest_landing_started', 'guest_banner_started') THEN RAISE EXCEPTION 'invalid_event'; END IF;
  -- Serializes issuance/recovery for this network; does not identify a person.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('guest-open:' || p_network_hash, 0));
  SELECT * INTO v_session FROM public.guest_banner_sessions WHERE token_hash = p_existing_hash AND expires_at > pg_catalog.now();
  IF v_session.id IS NULL THEN
    IF NOT public.guest_banner_rate_take('session_issue', p_network_hash) THEN RETURN pg_catalog.jsonb_build_object('allowed', FALSE); END IF;
    INSERT INTO public.guest_banner_sessions(token_hash) VALUES (p_new_hash) RETURNING * INTO v_session;
    v_new := TRUE;
  END IF;
  IF NOT public.guest_banner_rate_take('session_event', v_session.token_hash) THEN RETURN pg_catalog.jsonb_build_object('allowed', FALSE); END IF;
  INSERT INTO public.guest_banner_events(session_id, event_type) VALUES (v_session.id, p_event_type) ON CONFLICT DO NOTHING;
  RETURN pg_catalog.jsonb_build_object('allowed', TRUE, 'newSession', v_new, 'expiresAt', v_session.expires_at);
END;
$$;

-- Called only by the server after a fresh Turnstile validation; never by React.
CREATE FUNCTION public.guest_banner_reserve(p_session_hash TEXT, p_network_hash TEXT, p_client_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_session public.guest_banner_sessions%ROWTYPE; v_request public.guest_banner_requests%ROWTYPE;
  v_policy public.guest_banner_policy%ROWTYPE; v_reserved INTEGER;
  v_day DATE := (pg_catalog.now() AT TIME ZONE 'UTC')::DATE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  IF p_client_request_id IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
  SELECT * INTO v_session FROM public.guest_banner_sessions WHERE token_hash = p_session_hash AND expires_at > pg_catalog.now() FOR UPDATE;
  IF v_session.id IS NULL THEN RETURN pg_catalog.jsonb_build_object('error', 'session_required'); END IF;
  SELECT * INTO v_request FROM public.guest_banner_requests WHERE session_id = v_session.id;
  IF v_request.id IS NOT NULL THEN
    IF v_request.client_request_id <> p_client_request_id THEN RETURN pg_catalog.jsonb_build_object('error', 'promotion_used'); END IF;
    RETURN pg_catalog.jsonb_build_object('requestId', v_request.id, 'status', v_request.status, 'replayed', TRUE);
  END IF;
  -- One row serializes the global daily promotional cap across all instances.
  SELECT * INTO v_policy FROM public.guest_banner_policy WHERE singleton FOR UPDATE;
  IF v_policy.generation_enabled IS DISTINCT FROM TRUE OR v_policy.daily_limit <= 0 THEN
    RETURN pg_catalog.jsonb_build_object('error', 'guest_generation_disabled');
  END IF;
  SELECT reserved INTO v_reserved FROM public.guest_banner_daily_costs WHERE day = v_day;
  IF COALESCE(v_reserved, 0) >= v_policy.daily_limit THEN RETURN pg_catalog.jsonb_build_object('error', 'promotion_capacity'); END IF;
  IF NOT public.guest_banner_rate_take('network_promotion', p_network_hash) THEN RETURN pg_catalog.jsonb_build_object('error', 'rate_limited'); END IF;
  INSERT INTO public.guest_banner_requests(session_id, client_request_id) VALUES (v_session.id, p_client_request_id) RETURNING * INTO v_request;
  INSERT INTO public.guest_banner_daily_costs AS daily(day, reserved) VALUES (v_day, 1)
    ON CONFLICT (day) DO UPDATE SET reserved = daily.reserved + 1;
  INSERT INTO public.guest_banner_events(session_id, event_type) VALUES (v_session.id, 'guest_generation_clicked') ON CONFLICT DO NOTHING;
  RETURN pg_catalog.jsonb_build_object('requestId', v_request.id, 'status', v_request.status, 'replayed', FALSE);
END;
$$;

-- At-most-once dispatch lease. Never reset dispatching/unknown/failed to reserved.
-- A lost response/crash must be reconciled, not retried as another paid request.
CREATE FUNCTION public.guest_banner_take_dispatch(p_request_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  PERFORM 1 FROM public.guest_banner_policy WHERE singleton AND generation_enabled AND daily_limit > 0 FOR SHARE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE public.guest_banner_requests request SET status = 'dispatching'
    WHERE request.id = p_request_id AND request.status = 'reserved'
    AND EXISTS (SELECT 1 FROM public.guest_banner_sessions session WHERE session.id = request.session_id AND session.expires_at > pg_catalog.now())
    RETURNING request.id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

-- Future official Banner worker supplies only a private artifact UUID and cost.
CREATE FUNCTION public.guest_banner_finish(p_request_id UUID, p_status TEXT, p_artifact_ref UUID, p_claim_hash TEXT, p_cost_microusd BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.guest_banner_requests%ROWTYPE; v_expiry TIMESTAMPTZ;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('completed', 'failed', 'unknown') OR p_cost_microusd IS NULL OR p_cost_microusd < 0 THEN RAISE EXCEPTION 'invalid_completion'; END IF;
  SELECT * INTO v_request FROM public.guest_banner_requests WHERE id = p_request_id FOR UPDATE;
  IF v_request.id IS NULL OR v_request.status <> 'dispatching' THEN RETURN FALSE; END IF;
  IF p_status = 'completed' THEN
    IF p_artifact_ref IS NULL OR p_claim_hash IS NULL OR p_claim_hash !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'invalid_artifact'; END IF;
    SELECT LEAST(expires_at, pg_catalog.now() + INTERVAL '24 hours') INTO v_expiry FROM public.guest_banner_sessions WHERE id = v_request.session_id;
    INSERT INTO public.guest_banner_results(request_id, artifact_ref, claim_hash, claim_expires_at) VALUES (p_request_id, p_artifact_ref, p_claim_hash, v_expiry);
    INSERT INTO public.guest_banner_events(session_id, event_type) VALUES (v_request.session_id, 'guest_generation_completed') ON CONFLICT DO NOTHING;
  END IF;
  UPDATE public.guest_banner_requests SET status = p_status, completed_at = pg_catalog.now(), cost_microusd = p_cost_microusd WHERE id = p_request_id;
  UPDATE public.guest_banner_daily_costs SET completed = completed + CASE WHEN p_status = 'completed' THEN 1 ELSE 0 END,
    cost_microusd = cost_microusd + p_cost_microusd WHERE day = (v_request.created_at AT TIME ZONE 'UTC')::DATE;
  RETURN TRUE;
END;
$$;

CREATE FUNCTION public.guest_banner_signup_gate(p_session_hash TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  SELECT session.id INTO v_session_id FROM public.guest_banner_sessions session
    JOIN public.guest_banner_requests request ON request.session_id = session.id
    JOIN public.guest_banner_results result ON result.request_id = request.id
    WHERE session.token_hash = p_session_hash AND session.expires_at > pg_catalog.now()
      AND result.claim_expires_at > pg_catalog.now() AND result.owner_id IS NULL;
  IF v_session_id IS NULL THEN RETURN FALSE; END IF;
  INSERT INTO public.guest_banner_events(session_id, event_type) VALUES (v_session_id, 'guest_signup_gate_shown') ON CONFLICT DO NOTHING;
  RETURN TRUE;
END;
$$;

-- JWT context, not a client user_id. This RPC only assigns the private reference;
-- download/publication and promotion into official creations remain unwired.
CREATE FUNCTION public.guest_banner_claim(p_session_hash TEXT, p_claim_hash TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := auth.uid(); v_result public.guest_banner_results%ROWTYPE; v_session_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'authenticated' OR v_user IS NULL THEN RAISE EXCEPTION 'authentication_required' USING ERRCODE = '42501'; END IF;
  SELECT result.* INTO v_result FROM public.guest_banner_results result
    JOIN public.guest_banner_requests request ON request.id = result.request_id
    JOIN public.guest_banner_sessions session ON session.id = request.session_id
    WHERE session.token_hash = p_session_hash AND result.claim_hash = p_claim_hash
      AND session.expires_at > pg_catalog.now() FOR UPDATE OF result;
  IF v_result.id IS NULL THEN RAISE EXCEPTION 'claim_unavailable' USING ERRCODE = '42501'; END IF;
  -- Successful retries by the same owner are harmless, even after claim expiry.
  IF v_result.owner_id = v_user THEN RETURN v_result.id; END IF;
  IF v_result.owner_id IS NOT NULL OR v_result.claim_expires_at <= pg_catalog.now() THEN RAISE EXCEPTION 'claim_unavailable' USING ERRCODE = '42501'; END IF;
  UPDATE public.guest_banner_results SET owner_id = v_user, claimed_at = pg_catalog.now() WHERE id = v_result.id;
  SELECT session_id INTO v_session_id FROM public.guest_banner_requests WHERE id = v_result.request_id;
  INSERT INTO public.guest_banner_events(session_id, event_type) VALUES (v_session_id, 'guest_claim_completed') ON CONFLICT DO NOTHING;
  RETURN v_result.id;
END;
$$;

-- Manual maintenance only in phase 1. No cron. Only this new guest schema is touched.
CREATE FUNCTION public.guest_banner_purge()
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_deleted BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.guest_banner_sessions WHERE expires_at < pg_catalog.now();
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  DELETE FROM public.guest_banner_rate_windows WHERE expires_at < pg_catalog.now();
  DELETE FROM public.guest_banner_daily_costs WHERE day < (pg_catalog.now() AT TIME ZONE 'UTC')::DATE - 180;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.guest_banner_rate_take(TEXT, TEXT), public.guest_banner_open(TEXT, TEXT, TEXT, TEXT),
  public.guest_banner_reserve(TEXT, TEXT, UUID), public.guest_banner_take_dispatch(UUID),
  public.guest_banner_finish(UUID, TEXT, UUID, TEXT, BIGINT), public.guest_banner_signup_gate(TEXT),
  public.guest_banner_claim(TEXT, TEXT), public.guest_banner_purge() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_banner_rate_take(TEXT, TEXT), public.guest_banner_open(TEXT, TEXT, TEXT, TEXT),
  public.guest_banner_reserve(TEXT, TEXT, UUID), public.guest_banner_take_dispatch(UUID),
  public.guest_banner_finish(UUID, TEXT, UUID, TEXT, BIGINT), public.guest_banner_signup_gate(TEXT),
  public.guest_banner_purge() TO service_role;
GRANT EXECUTE ON FUNCTION public.guest_banner_claim(TEXT, TEXT) TO authenticated;

COMMIT;
