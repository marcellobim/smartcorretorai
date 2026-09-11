-- Preserve consumed identity beyond session expiry; no new eligibility or ST system.
BEGIN;
CREATE OR REPLACE FUNCTION public.guest_banner_open(p_existing_hash TEXT, p_new_hash TEXT, p_network_hash TEXT, p_event_type TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session public.guest_banner_sessions%ROWTYPE; v_new BOOLEAN := FALSE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  IF p_event_type IS NULL OR p_event_type NOT IN ('guest_landing_started', 'guest_banner_started') THEN RAISE EXCEPTION 'invalid_event'; END IF;
  -- Serializes issuance/recovery for this network; does not identify a person.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('guest-open:' || p_network_hash, 0));
  SELECT * INTO v_session FROM public.guest_banner_sessions WHERE token_hash = p_existing_hash AND (expires_at > pg_catalog.now() OR EXISTS (SELECT 1 FROM public.guest_banner_requests r WHERE r.session_id = guest_banner_sessions.id AND r.status <> 'cancelled'));
  IF v_session.id IS NULL THEN
    IF NOT public.guest_banner_rate_take('session_issue', p_network_hash) THEN RETURN pg_catalog.jsonb_build_object('allowed', FALSE); END IF;
    INSERT INTO public.guest_banner_sessions(token_hash) VALUES (p_new_hash) RETURNING * INTO v_session;
    v_new := TRUE;
  END IF;
  UPDATE public.guest_banner_sessions SET expires_at = GREATEST(expires_at, pg_catalog.now() + INTERVAL '7 days') WHERE id = v_session.id RETURNING * INTO v_session;
  IF NOT public.guest_banner_rate_take('session_event', v_session.token_hash) THEN RETURN pg_catalog.jsonb_build_object('allowed', FALSE); END IF;
  INSERT INTO public.guest_banner_events(session_id, event_type) VALUES (v_session.id, p_event_type) ON CONFLICT DO NOTHING;
  RETURN pg_catalog.jsonb_build_object('allowed', TRUE, 'newSession', v_new, 'expiresAt', v_session.expires_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_banner_purge()
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_deleted BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.guest_banner_sessions s WHERE expires_at < pg_catalog.now() AND NOT EXISTS (SELECT 1 FROM public.guest_banner_requests r WHERE r.session_id=s.id AND r.status <> 'cancelled');
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  DELETE FROM public.guest_banner_rate_windows WHERE expires_at < pg_catalog.now();
  DELETE FROM public.guest_banner_daily_costs WHERE day < (pg_catalog.now() AT TIME ZONE 'UTC')::DATE - 180;
  RETURN v_deleted;
END;
$$;

COMMIT;
