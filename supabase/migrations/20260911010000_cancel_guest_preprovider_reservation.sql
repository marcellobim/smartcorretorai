-- Only guest promotional reservations. No authenticated economy or product changes.
-- Dispatch intent is a durable, conservative fence, NOT proof of provider success.
BEGIN;

ALTER TABLE public.guest_banner_requests
  ADD COLUMN provider_dispatch_started_at TIMESTAMPTZ,
  ADD COLUMN cancelled_at TIMESTAMPTZ;

ALTER TABLE public.guest_banner_requests
  DROP CONSTRAINT guest_banner_requests_status_check,
  ADD CONSTRAINT guest_banner_requests_status_check
    CHECK (status IN ('reserved', 'dispatching', 'completed', 'failed', 'unknown', 'cancelled')),
  ADD CONSTRAINT guest_banner_requests_cancellation_check CHECK (
    (status = 'cancelled' AND cancelled_at IS NOT NULL AND provider_dispatch_started_at IS NULL
      AND completed_at IS NOT NULL AND cost_microusd IS NOT NULL AND cost_microusd = 0)
    OR (status <> 'cancelled' AND cancelled_at IS NULL)
  );

-- Retain every old request/UUID/idempotency key. Only cancelled attempts stop
-- occupying the single promotional slot; failed/unknown/legacy attempts keep it.
ALTER TABLE public.guest_banner_requests DROP CONSTRAINT guest_banner_requests_session_id_key;
CREATE UNIQUE INDEX guest_banner_one_occupied_slot
  ON public.guest_banner_requests(session_id) WHERE status <> 'cancelled';

-- Defence against accidental server-side resets. Existing terminal rows with no
-- new marker are NOT backfilled/inferred and cannot become cancellable/reserved.
CREATE FUNCTION public.guest_banner_guard_request_transition()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.session_id IS DISTINCT FROM OLD.session_id
    OR NEW.client_request_id IS DISTINCT FROM OLD.client_request_id OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'guest_request_identity_immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.provider_dispatch_started_at IS DISTINCT FROM OLD.provider_dispatch_started_at
    AND NOT (OLD.provider_dispatch_started_at IS NULL AND NEW.provider_dispatch_started_at IS NOT NULL
      AND OLD.status = 'reserved' AND NEW.status = 'dispatching') THEN
    RAISE EXCEPTION 'guest_dispatch_fence_immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'reserved' AND NEW.status = 'dispatching' AND NEW.provider_dispatch_started_at IS NOT NULL THEN
      RETURN NEW;
    ELSIF OLD.status = 'reserved' AND NEW.status = 'cancelled' AND OLD.provider_dispatch_started_at IS NULL THEN
      RETURN NEW;
    ELSIF OLD.status = 'dispatching' AND NEW.status IN ('completed', 'failed', 'unknown') THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'guest_request_transition_forbidden' USING ERRCODE = '23514';
  END IF;
  IF NEW.cancelled_at IS DISTINCT FROM OLD.cancelled_at THEN
    RAISE EXCEPTION 'guest_cancellation_immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guest_banner_request_transition_guard
  BEFORE UPDATE ON public.guest_banner_requests
  FOR EACH ROW EXECUTE FUNCTION public.guest_banner_guard_request_transition();
REVOKE ALL ON FUNCTION public.guest_banner_guard_request_transition() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.guest_banner_reserve(p_session_hash TEXT, p_network_hash TEXT, p_client_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_session public.guest_banner_sessions%ROWTYPE; v_request public.guest_banner_requests%ROWTYPE;
  v_policy public.guest_banner_policy%ROWTYPE; v_reserved INTEGER;
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
  IF EXISTS (SELECT 1 FROM public.guest_banner_requests WHERE session_id = v_session.id AND status <> 'cancelled') THEN
    RETURN pg_catalog.jsonb_build_object('error', 'promotion_used');
  END IF;
  -- Shared lock order with cancellation/dispatch: session -> policy -> request -> daily.
  SELECT * INTO v_policy FROM public.guest_banner_policy WHERE singleton FOR UPDATE;
  IF v_policy.generation_enabled IS DISTINCT FROM TRUE OR v_policy.daily_limit <= 0 THEN
    RETURN pg_catalog.jsonb_build_object('error', 'guest_generation_disabled');
  END IF;
  SELECT reserved INTO v_reserved FROM public.guest_banner_daily_costs WHERE day = v_day;
  IF COALESCE(v_reserved, 0) >= v_policy.daily_limit THEN RETURN pg_catalog.jsonb_build_object('error', 'promotion_capacity'); END IF;
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
  PERFORM 1 FROM public.guest_banner_policy WHERE singleton AND generation_enabled AND daily_limit > 0 FOR SHARE;
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

CREATE FUNCTION public.guest_banner_cancel_preprovider(p_session_hash TEXT, p_request_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_session_id UUID; v_request public.guest_banner_requests%ROWTYPE; v_released DATE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  -- No client boolean/reason/cost claim can authorize this transition.
  -- NO KEY UPDATE serializes the slot without blocking FK checks by finish.
  SELECT id INTO v_session_id FROM public.guest_banner_sessions
    WHERE token_hash = p_session_hash AND expires_at > pg_catalog.now() FOR NO KEY UPDATE;
  IF v_session_id IS NULL THEN RETURN pg_catalog.jsonb_build_object('cancelled', FALSE, 'error', 'request_unavailable'); END IF;
  PERFORM 1 FROM public.guest_banner_policy WHERE singleton FOR UPDATE;
  SELECT * INTO v_request FROM public.guest_banner_requests
    WHERE id = p_request_id AND session_id = v_session_id FOR UPDATE;
  IF v_request.id IS NULL THEN RETURN pg_catalog.jsonb_build_object('cancelled', FALSE, 'error', 'request_unavailable'); END IF;
  IF v_request.status = 'cancelled' THEN
    RETURN pg_catalog.jsonb_build_object('cancelled', TRUE, 'requestId', v_request.id, 'status', 'cancelled', 'replayed', TRUE);
  END IF;
  IF v_request.status <> 'reserved' OR v_request.provider_dispatch_started_at IS NOT NULL
    OR v_request.cancelled_at IS NOT NULL OR v_request.completed_at IS NOT NULL OR v_request.cost_microusd IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.guest_banner_results WHERE request_id = v_request.id) THEN
    RETURN pg_catalog.jsonb_build_object('cancelled', FALSE, 'error', 'dispatch_or_state_uncertain');
  END IF;

  UPDATE public.guest_banner_requests
    SET status = 'cancelled', cancelled_at = pg_catalog.clock_timestamp(), completed_at = pg_catalog.clock_timestamp(), cost_microusd = 0
    WHERE id = v_request.id;
  -- Release the reservation's original UTC day, not today's bucket. Never clamp
  -- a broken ledger to zero; roll back the entire cancellation if inconsistent.
  UPDATE public.guest_banner_daily_costs SET reserved = reserved - 1
    WHERE day = (v_request.created_at AT TIME ZONE 'UTC')::DATE AND reserved > completed
    RETURNING day INTO v_released;
  IF v_released IS NULL THEN RAISE EXCEPTION 'promotion_accounting_inconsistent' USING ERRCODE = '23514'; END IF;
  RETURN pg_catalog.jsonb_build_object('cancelled', TRUE, 'requestId', v_request.id, 'status', 'cancelled', 'replayed', FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.guest_banner_reserve(TEXT, TEXT, UUID), public.guest_banner_take_dispatch(UUID),
  public.guest_banner_cancel_preprovider(TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_banner_reserve(TEXT, TEXT, UUID), public.guest_banner_take_dispatch(UUID),
  public.guest_banner_cancel_preprovider(TEXT, UUID) TO service_role;

COMMIT;
