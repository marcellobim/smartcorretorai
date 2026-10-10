-- Global daily totals remain accounting only. Confirmed failures free individual eligibility.
-- Unknown/in-flight requests retain the at-most-once fence; never retry an uncertain dispatch.
BEGIN;
DROP INDEX public.guest_banner_one_occupied_slot;
CREATE UNIQUE INDEX guest_banner_one_occupied_slot ON public.guest_banner_requests(session_id)
  WHERE status IN ('reserved','dispatching','unknown','completed');
CREATE OR REPLACE FUNCTION public.guest_banner_reserve(p_session_hash TEXT, p_network_hash TEXT, p_client_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_session public.guest_banner_sessions%ROWTYPE; v_request public.guest_banner_requests%ROWTYPE;
  v_policy public.guest_banner_policy%ROWTYPE;
  v_day DATE := (pg_catalog.now() AT TIME ZONE 'UTC')::DATE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  IF p_client_request_id IS NULL THEN RAISE EXCEPTION 'invalid_request'; END IF;
  SELECT * INTO v_session FROM public.guest_banner_sessions
    WHERE token_hash = p_session_hash AND expires_at > pg_catalog.now() FOR NO KEY UPDATE;
  IF v_session.id IS NULL THEN RETURN pg_catalog.jsonb_build_object('error', 'session_required'); END IF;

  -- Same key always replays its own immutable attempt, including cancellation.
  SELECT * INTO v_request FROM public.guest_banner_requests
    WHERE session_id = v_session.id AND client_request_id = p_client_request_id;
  IF v_request.id IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('requestId', v_request.id, 'status', v_request.status, 'replayed', TRUE);
  END IF;
  IF EXISTS (SELECT 1 FROM public.guest_banner_requests WHERE session_id = v_session.id AND status = 'completed') THEN
    RETURN pg_catalog.jsonb_build_object('error', 'promotion_used');
  END IF;
  SELECT * INTO v_request FROM public.guest_banner_requests
    WHERE session_id = v_session.id AND status IN ('reserved','dispatching','unknown');
  IF v_request.id IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('requestId', v_request.id, 'status', v_request.status, 'replayed', TRUE);
  END IF;
  -- Shared lock order with cancellation/dispatch: session -> policy -> request -> daily.
  SELECT * INTO v_policy FROM public.guest_banner_policy WHERE singleton FOR UPDATE;
  IF v_policy.generation_enabled IS DISTINCT FROM TRUE THEN
    RETURN pg_catalog.jsonb_build_object('error', 'guest_generation_disabled');
  END IF;
  -- Abuse rate is intentionally NOT refunded when a promotional reservation is cancelled.
  IF NOT public.guest_banner_rate_take('network_promotion', p_network_hash) THEN RETURN pg_catalog.jsonb_build_object('error', 'rate_limited'); END IF;
  INSERT INTO public.guest_banner_requests(session_id, client_request_id) VALUES (v_session.id, p_client_request_id) RETURNING * INTO v_request;
  INSERT INTO public.guest_banner_daily_costs AS daily(day, reserved) VALUES (v_day, 1)
    ON CONFLICT (day) DO UPDATE SET reserved = daily.reserved + 1;
  INSERT INTO public.guest_banner_events(session_id, event_type) VALUES (v_session.id, 'guest_generation_clicked') ON CONFLICT DO NOTHING;
  RETURN pg_catalog.jsonb_build_object('requestId', v_request.id, 'status', v_request.status, 'replayed', FALSE);
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_banner_take_dispatch(p_request_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session_id UUID; v_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  SELECT session.id INTO v_session_id FROM public.guest_banner_sessions session
    JOIN public.guest_banner_requests request ON request.session_id = session.id
    WHERE request.id = p_request_id AND session.expires_at > pg_catalog.now() FOR NO KEY UPDATE OF session;
  IF v_session_id IS NULL THEN RETURN FALSE; END IF;
  PERFORM 1 FROM public.guest_banner_policy WHERE singleton AND generation_enabled FOR SHARE;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  -- Persist fence and state together before authorizing external I/O. Caller MUST
  -- await successful RPC COMMIT before sending; loss of that response is uncertain.
  UPDATE public.guest_banner_requests request
    SET status = 'dispatching', provider_dispatch_started_at = pg_catalog.clock_timestamp()
    WHERE request.id = p_request_id AND request.status = 'reserved'
      AND request.provider_dispatch_started_at IS NULL AND request.cancelled_at IS NULL
      AND request.completed_at IS NULL AND request.cost_microusd IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.guest_banner_results WHERE request_id = request.id)
    RETURNING request.id INTO v_id;
  RETURN v_id IS NOT NULL;
END;
$$;

COMMIT;
