-- Campanha de Textos: technical, temporary delivery idempotency.
-- This is not a gallery and is intentionally inaccessible to browser roles.

CREATE TABLE public.text_campaign_delivery_requests (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_request_id UUID NOT NULL,
  product_code TEXT NOT NULL DEFAULT 'text_campaign' CHECK (product_code = 'text_campaign'),
  variant TEXT NOT NULL DEFAULT 'standard' CHECK (variant = 'standard'),
  smart_token_cost BIGINT NOT NULL CHECK (smart_token_cost = 100),
  catalog_version TEXT NOT NULL CHECK (pg_catalog.btrim(catalog_version) <> ''),
  idempotency_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'failed', 'expired')),
  claim_token UUID NOT NULL,
  reservation_id UUID NULL REFERENCES public.credit_reservations(id) ON DELETE SET NULL,
  result JSONB NULL CHECK (result IS NULL OR pg_catalog.jsonb_typeof(result) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  completed_at TIMESTAMPTZ NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT text_campaign_delivery_identity_unique UNIQUE (user_id, product_code, client_request_id),
  CONSTRAINT text_campaign_delivery_idempotency_unique UNIQUE (user_id, idempotency_key),
  CONSTRAINT text_campaign_delivery_completed_state CHECK (
    (status = 'completed' AND result IS NOT NULL AND reservation_id IS NOT NULL AND completed_at IS NOT NULL)
    OR (status <> 'completed' AND completed_at IS NULL)
  ),
  CONSTRAINT text_campaign_delivery_terminal_result CHECK (status NOT IN ('failed', 'expired') OR result IS NULL)
);

CREATE INDEX text_campaign_delivery_expiry_idx
  ON public.text_campaign_delivery_requests(expires_at)
  WHERE status <> 'expired';

ALTER TABLE public.text_campaign_delivery_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.text_campaign_delivery_requests FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.text_campaign_delivery_requests TO service_role;

CREATE OR REPLACE FUNCTION public.claim_text_campaign_delivery(
  p_user_id UUID,
  p_client_request_id UUID,
  p_smart_token_cost BIGINT,
  p_catalog_version TEXT
)
RETURNS TABLE (
  request_id UUID,
  request_status TEXT,
  returned_claim_token UUID,
  returned_reservation_id UUID,
  returned_result JSONB,
  returned_expires_at TIMESTAMPTZ,
  returned_smart_token_cost BIGINT,
  claimed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.text_campaign_delivery_requests%ROWTYPE;
  v_reservation public.credit_reservations%ROWTYPE;
  v_claim_token UUID := pg_catalog.gen_random_uuid();
  v_idempotency_key TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a operar entrega idempotente' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR p_client_request_id IS NULL THEN RAISE EXCEPTION 'identidade da solicitacao obrigatoria'; END IF;
  IF p_smart_token_cost IS DISTINCT FROM 100 THEN RAISE EXCEPTION 'custo canonico invalido'; END IF;
  IF p_catalog_version IS NULL OR pg_catalog.btrim(p_catalog_version) = '' THEN RAISE EXCEPTION 'catalog_version obrigatoria'; END IF;

  v_idempotency_key := pg_catalog.format('text_campaign:standard:%s:%s', p_user_id, p_client_request_id);
  INSERT INTO public.text_campaign_delivery_requests (
    user_id, client_request_id, smart_token_cost, catalog_version,
    idempotency_key, status, claim_token, expires_at
  ) VALUES (
    p_user_id, p_client_request_id, p_smart_token_cost, p_catalog_version,
    v_idempotency_key, 'processing', v_claim_token, pg_catalog.now() + INTERVAL '15 minutes'
  )
  ON CONFLICT (user_id, product_code, client_request_id) DO NOTHING
  RETURNING * INTO v_request;

  IF FOUND THEN
    RETURN QUERY SELECT v_request.id, v_request.status, v_request.claim_token,
      v_request.reservation_id, v_request.result, v_request.expires_at,
      v_request.smart_token_cost, TRUE;
    RETURN;
  END IF;

  SELECT * INTO v_request
    FROM public.text_campaign_delivery_requests t
   WHERE t.user_id = p_user_id
     AND t.product_code = 'text_campaign'
     AND t.client_request_id = p_client_request_id
   FOR UPDATE;

  IF v_request.expires_at <= pg_catalog.now() AND v_request.status = 'processing' THEN
    SELECT * INTO v_reservation FROM public.credit_reservations cr
     WHERE cr.user_id = v_request.user_id AND cr.idempotency_key = v_request.idempotency_key FOR UPDATE;
    IF FOUND AND v_reservation.status = 'reserved' THEN
      PERFORM public.cancel_credit_reservation_from_lots(v_request.user_id, v_request.idempotency_key, 'text_campaign_claim_expired');
    END IF;
    UPDATE public.text_campaign_delivery_requests
       SET status = 'expired', result = NULL, completed_at = NULL, updated_at = pg_catalog.now()
     WHERE id = v_request.id
     RETURNING * INTO v_request;
  ELSIF v_request.expires_at <= pg_catalog.now() AND v_request.status IN ('completed', 'failed') THEN
    UPDATE public.text_campaign_delivery_requests
       SET status = 'expired', result = NULL, completed_at = NULL, updated_at = pg_catalog.now()
     WHERE id = v_request.id
     RETURNING * INTO v_request;
  END IF;

  RETURN QUERY SELECT v_request.id, v_request.status, NULL::UUID,
    v_request.reservation_id, v_request.result, v_request.expires_at,
    v_request.smart_token_cost, FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.attach_text_campaign_reservation(
  p_user_id UUID,
  p_client_request_id UUID,
  p_claim_token UUID,
  p_reservation_id UUID
)
RETURNS SETOF public.text_campaign_delivery_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.text_campaign_delivery_requests%ROWTYPE;
  v_reservation public.credit_reservations%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a vincular reserva' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
    FROM public.text_campaign_delivery_requests t
   WHERE t.user_id = p_user_id AND t.client_request_id = p_client_request_id
   FOR UPDATE;
  IF NOT FOUND OR v_request.status <> 'processing' OR v_request.claim_token <> p_claim_token OR v_request.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'claim de entrega invalido ou expirado';
  END IF;

  SELECT * INTO v_reservation
    FROM public.credit_reservations cr
   WHERE cr.id = p_reservation_id
     AND cr.user_id = p_user_id
     AND cr.idempotency_key = v_request.idempotency_key
     AND cr.amount = v_request.smart_token_cost
     AND cr.status = 'reserved'
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'reserva canonica nao encontrada'; END IF;
  IF v_request.reservation_id IS NOT NULL AND v_request.reservation_id <> p_reservation_id THEN
    RAISE EXCEPTION 'claim ja vinculado a outra reserva';
  END IF;

  UPDATE public.text_campaign_delivery_requests
     SET reservation_id = p_reservation_id, updated_at = pg_catalog.now()
   WHERE id = v_request.id
   RETURNING * INTO v_request;
  RETURN NEXT v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_text_campaign_delivery(
  p_user_id UUID,
  p_client_request_id UUID,
  p_claim_token UUID,
  p_result JSONB,
  p_usage JSONB DEFAULT '{}'::jsonb
)
RETURNS SETOF public.text_campaign_delivery_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.text_campaign_delivery_requests%ROWTYPE;
  v_reservation public.credit_reservations%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a concluir entrega' USING ERRCODE = '42501';
  END IF;
  IF p_result IS NULL OR pg_catalog.jsonb_typeof(p_result) <> 'object'
     OR pg_catalog.octet_length(p_result::TEXT) > 262144 THEN
    RAISE EXCEPTION 'resultado de entrega invalido';
  END IF;

  SELECT * INTO v_request
    FROM public.text_campaign_delivery_requests t
   WHERE t.user_id = p_user_id AND t.client_request_id = p_client_request_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'solicitacao de entrega nao encontrada'; END IF;
  IF v_request.status = 'completed' THEN RETURN NEXT v_request; RETURN; END IF;
  IF v_request.status <> 'processing' OR v_request.claim_token <> p_claim_token OR v_request.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'claim de entrega invalido ou expirado';
  END IF;
  IF v_request.reservation_id IS NULL THEN RAISE EXCEPTION 'entrega sem reserva vinculada'; END IF;

  -- Result, financial consumption and completed status share one transaction.
  -- Any failure rolls the temporary result and the consumption back together.
  UPDATE public.text_campaign_delivery_requests
     SET result = p_result, updated_at = pg_catalog.now()
   WHERE id = v_request.id;

  SELECT * INTO v_reservation
    FROM public.consume_reserved_credits_from_lots(
      p_user_id,
      v_request.idempotency_key,
      'Campanha de Textos',
      pg_catalog.jsonb_build_object(
        'product_code', 'text_campaign',
        'variant', 'standard',
        'smart_token_cost', v_request.smart_token_cost,
        'catalog_version', v_request.catalog_version,
        'provider', 'openai',
        'model', 'gpt-4.1',
        'usage', COALESCE(p_usage, '{}'::jsonb),
        'delivery_request_id', v_request.id
      )
    );
  IF v_reservation.status <> 'consumed' THEN RAISE EXCEPTION 'reserva nao consumida'; END IF;

  UPDATE public.text_campaign_delivery_requests
     SET status = 'completed', completed_at = pg_catalog.now(),
         expires_at = pg_catalog.now() + INTERVAL '24 hours', updated_at = pg_catalog.now()
   WHERE id = v_request.id
   RETURNING * INTO v_request;
  RETURN NEXT v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_text_campaign_delivery(
  p_user_id UUID,
  p_client_request_id UUID,
  p_claim_token UUID,
  p_reason TEXT DEFAULT 'text_campaign_generation_failed'
)
RETURNS SETOF public.text_campaign_delivery_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.text_campaign_delivery_requests%ROWTYPE;
  v_reservation public.credit_reservations%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a falhar entrega' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_request
    FROM public.text_campaign_delivery_requests t
   WHERE t.user_id = p_user_id AND t.client_request_id = p_client_request_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'solicitacao de entrega nao encontrada'; END IF;
  IF v_request.status = 'completed' THEN RETURN NEXT v_request; RETURN; END IF;
  IF v_request.status = 'failed' THEN RETURN NEXT v_request; RETURN; END IF;
  IF v_request.status <> 'processing' OR v_request.claim_token <> p_claim_token THEN
    RAISE EXCEPTION 'claim de entrega invalido';
  END IF;

  SELECT * INTO v_reservation
    FROM public.credit_reservations cr
   WHERE cr.user_id = p_user_id AND cr.idempotency_key = v_request.idempotency_key
   FOR UPDATE;
  IF FOUND AND v_reservation.status = 'reserved' THEN
    SELECT * INTO v_reservation
      FROM public.cancel_credit_reservation_from_lots(p_user_id, v_request.idempotency_key, p_reason);
    IF v_reservation.status <> 'cancelled' THEN RAISE EXCEPTION 'reserva nao cancelada'; END IF;
  END IF;

  UPDATE public.text_campaign_delivery_requests
     SET status = 'failed', result = NULL, completed_at = NULL,
         reservation_id = COALESCE(v_request.reservation_id, v_reservation.id),
         expires_at = pg_catalog.now() + INTERVAL '1 hour', updated_at = pg_catalog.now()
   WHERE id = v_request.id
   RETURNING * INTO v_request;
  RETURN NEXT v_request;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_text_campaign_deliveries()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_request public.text_campaign_delivery_requests%ROWTYPE;
  v_reservation public.credit_reservations%ROWTYPE;
  v_cleaned INTEGER := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a limpar entregas' USING ERRCODE = '42501';
  END IF;

  FOR v_request IN
    SELECT * FROM public.text_campaign_delivery_requests t
     WHERE t.status = 'processing' AND t.expires_at <= pg_catalog.now()
     ORDER BY t.expires_at FOR UPDATE SKIP LOCKED
  LOOP
    SELECT * INTO v_reservation FROM public.credit_reservations cr
     WHERE cr.user_id = v_request.user_id AND cr.idempotency_key = v_request.idempotency_key FOR UPDATE;
    IF FOUND AND v_reservation.status = 'reserved' THEN
      PERFORM public.cancel_credit_reservation_from_lots(v_request.user_id, v_request.idempotency_key, 'text_campaign_claim_expired');
    END IF;
    UPDATE public.text_campaign_delivery_requests
       SET status = 'expired', result = NULL, completed_at = NULL, updated_at = pg_catalog.now()
     WHERE id = v_request.id;
    v_cleaned := v_cleaned + 1;
  END LOOP;

  WITH expired AS (
    UPDATE public.text_campaign_delivery_requests
       SET status = 'expired', result = NULL, completed_at = NULL, updated_at = pg_catalog.now()
     WHERE status IN ('completed', 'failed') AND expires_at <= pg_catalog.now()
     RETURNING 1
  ) SELECT v_cleaned + pg_catalog.count(*)::INTEGER INTO v_cleaned FROM expired;

  DELETE FROM public.text_campaign_delivery_requests
   WHERE status = 'expired' AND updated_at < pg_catalog.now() - INTERVAL '30 days';
  RETURN v_cleaned;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_text_campaign_delivery(UUID, UUID, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.attach_text_campaign_reservation(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.complete_text_campaign_delivery(UUID, UUID, UUID, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fail_text_campaign_delivery(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_text_campaign_deliveries() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_text_campaign_delivery(UUID, UUID, BIGINT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.attach_text_campaign_reservation(UUID, UUID, UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_text_campaign_delivery(UUID, UUID, UUID, JSONB, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.fail_text_campaign_delivery(UUID, UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_text_campaign_deliveries() TO service_role;
