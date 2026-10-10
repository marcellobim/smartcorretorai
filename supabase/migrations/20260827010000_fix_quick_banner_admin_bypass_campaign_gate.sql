-- Keep the campaign-provider gate consistent with begin_quick_banner_execution:
-- paying requests must be prepared/processing, while admin bypass may start
-- directly from preparing because it intentionally has no reservation.
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
  IF v_request.status NOT IN ('prepared', 'processing')
     AND NOT (v_request.status = 'preparing' AND v_request.admin_bypass) THEN
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
REVOKE ALL ON FUNCTION public.claim_quick_banner_campaign_generation(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_quick_banner_campaign_generation(UUID, UUID, UUID)
  TO service_role;
