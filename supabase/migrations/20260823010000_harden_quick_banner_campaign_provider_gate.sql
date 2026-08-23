-- Bind the paid text-provider step of Quick Banners to the existing request,
-- reservation and claim token. This is an idempotency substate, not a new ledger.
ALTER TABLE public.quick_banner_delivery_requests
  ADD COLUMN IF NOT EXISTS campaign_generation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (campaign_generation_status IN ('pending', 'processing', 'completed')),
  ADD COLUMN IF NOT EXISTS campaign_generation_result JSONB NULL,
  ADD COLUMN IF NOT EXISTS campaign_generation_started_at TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS campaign_generation_completed_at TIMESTAMPTZ NULL;

CREATE OR REPLACE FUNCTION public.claim_quick_banner_campaign_generation(
  p_user_id UUID,
  p_client_request_id UUID,
  p_claim_token UUID
)
RETURNS TABLE (
  generation_status TEXT,
  execution_claimed BOOLEAN,
  generation_result JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.quick_banner_delivery_requests%ROWTYPE;
  v_reservation public.credit_reservations%ROWTYPE;
  v_claimed BOOLEAN := FALSE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
    FROM public.quick_banner_delivery_requests
   WHERE user_id = p_user_id
     AND client_request_id = p_client_request_id
   FOR UPDATE;

  IF NOT FOUND OR v_request.claim_token <> p_claim_token THEN
    RAISE EXCEPTION 'claim invalido';
  END IF;
  IF v_request.campaign_generation_status = 'completed' THEN
    RETURN QUERY SELECT
      v_request.campaign_generation_status,
      FALSE,
      v_request.campaign_generation_result;
    RETURN;
  END IF;
  IF v_request.status NOT IN ('prepared', 'processing') THEN
    RAISE EXCEPTION 'request economico nao preparado';
  END IF;

  IF NOT v_request.admin_bypass THEN
    IF v_request.reservation_id IS NULL OR v_request.smart_tokens_reserved <> v_request.smart_tokens_quoted THEN
      RAISE EXCEPTION 'reserva economica ausente';
    END IF;
    SELECT * INTO v_reservation
      FROM public.credit_reservations
     WHERE id = v_request.reservation_id
       AND user_id = p_user_id
     FOR UPDATE;
    IF NOT FOUND OR v_reservation.status <> 'reserved' OR v_reservation.amount <> v_request.smart_tokens_quoted THEN
      RAISE EXCEPTION 'reserva economica invalida';
    END IF;
  END IF;

  IF v_request.campaign_generation_status = 'pending' THEN
    UPDATE public.quick_banner_delivery_requests
       SET campaign_generation_status = 'processing',
           campaign_generation_started_at = pg_catalog.now()
     WHERE id = v_request.id
     RETURNING * INTO v_request;
    v_claimed := TRUE;
  END IF;

  RETURN QUERY SELECT
    v_request.campaign_generation_status,
    v_claimed,
    v_request.campaign_generation_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_quick_banner_campaign_generation(
  p_user_id UUID,
  p_client_request_id UUID,
  p_claim_token UUID,
  p_result JSONB
)
RETURNS TABLE (
  generation_status TEXT,
  execution_claimed BOOLEAN,
  generation_result JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.quick_banner_delivery_requests%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_result IS NULL OR pg_catalog.jsonb_typeof(p_result) <> 'object' THEN
    RAISE EXCEPTION 'resultado invalido';
  END IF;

  SELECT * INTO v_request
    FROM public.quick_banner_delivery_requests
   WHERE user_id = p_user_id
     AND client_request_id = p_client_request_id
   FOR UPDATE;
  IF NOT FOUND OR v_request.claim_token <> p_claim_token THEN
    RAISE EXCEPTION 'claim invalido';
  END IF;
  IF v_request.campaign_generation_status = 'pending' THEN
    RAISE EXCEPTION 'provider sem claim economico';
  END IF;
  IF v_request.campaign_generation_status = 'processing' THEN
    UPDATE public.quick_banner_delivery_requests
       SET campaign_generation_status = 'completed',
           campaign_generation_result = p_result,
           campaign_generation_completed_at = pg_catalog.now()
     WHERE id = v_request.id
     RETURNING * INTO v_request;
  END IF;

  RETURN QUERY SELECT
    v_request.campaign_generation_status,
    FALSE,
    v_request.campaign_generation_result;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_quick_banner_campaign_generation(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_quick_banner_campaign_generation(UUID, UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_quick_banner_campaign_generation(UUID, UUID, UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_quick_banner_campaign_generation(UUID, UUID, UUID, JSONB)
  TO service_role;
