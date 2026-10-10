-- Provider usage is known before its invoice amount. Preserve NULL for unknown
-- request cost instead of inventing a zero paid cost. No ST/schema/permissions change.
-- Daily cost remains the sum of known amounts; requests with NULL are pending.
BEGIN;
CREATE OR REPLACE FUNCTION public.guest_banner_finish(p_request_id UUID, p_status TEXT, p_artifact_ref UUID, p_claim_hash TEXT, p_cost_microusd BIGINT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_request public.guest_banner_requests%ROWTYPE; v_expiry TIMESTAMPTZ;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('completed', 'failed', 'unknown') OR p_cost_microusd < 0 THEN RAISE EXCEPTION 'invalid_completion'; END IF;
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
    cost_microusd = CASE WHEN p_cost_microusd IS NULL THEN cost_microusd ELSE cost_microusd + p_cost_microusd END
    WHERE day = (v_request.created_at AT TIME ZONE 'UTC')::DATE;
  RETURN TRUE;
END;
$$;
COMMIT;
