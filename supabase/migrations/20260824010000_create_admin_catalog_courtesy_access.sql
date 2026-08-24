-- Audited Admin courtesy access to the full product catalog.
-- Courtesy changes catalog authorization only. It never creates credits,
-- subscriptions, purchases, Stripe records or commercial plan state.

CREATE TABLE public.admin_catalog_access_events (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL CHECK (action IN ('granted', 'revoked')),
  reason TEXT NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(reason)) BETWEEN 10 AND 500),
  idempotency_key UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX admin_catalog_access_events_user_created_idx
  ON public.admin_catalog_access_events(user_id, created_at DESC, id DESC);
CREATE INDEX admin_catalog_access_events_admin_created_idx
  ON public.admin_catalog_access_events(admin_user_id, created_at DESC, id DESC);

ALTER TABLE public.admin_catalog_access_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_catalog_access_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_catalog_access_events TO service_role;

CREATE OR REPLACE FUNCTION public.set_admin_catalog_courtesy(
  p_admin_user_id UUID,
  p_user_id UUID,
  p_active BOOLEAN,
  p_reason TEXT,
  p_idempotency_key UUID
)
RETURNS TABLE (
  result TEXT,
  event_id UUID,
  active BOOLEAN,
  effective_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.admin_catalog_access_events%ROWTYPE;
  v_current public.admin_catalog_access_events%ROWTYPE;
  v_event public.admin_catalog_access_events%ROWTYPE;
  v_action TEXT;
  v_reason TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a alterar acesso de cortesia' USING ERRCODE = '42501';
  END IF;
  IF p_admin_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_users au WHERE au.user_id = p_admin_user_id
  ) THEN
    RAISE EXCEPTION 'Administrador nao autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id obrigatorio'; END IF;
  IF p_active IS NULL THEN RAISE EXCEPTION 'estado de cortesia obrigatorio'; END IF;
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'idempotency_key obrigatoria'; END IF;

  v_action := CASE WHEN p_active THEN 'granted' ELSE 'revoked' END;
  v_reason := CASE
    WHEN p_active THEN pg_catalog.btrim(p_reason)
    ELSE 'Revogacao administrativa confirmada'
  END;
  IF v_reason IS NULL OR pg_catalog.length(v_reason) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'motivo deve ter entre 10 e 500 caracteres';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::TEXT, 0));
  SELECT * INTO v_existing
    FROM public.admin_catalog_access_events ace
   WHERE ace.idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing.admin_user_id IS DISTINCT FROM p_admin_user_id
       OR v_existing.user_id IS DISTINCT FROM p_user_id
       OR v_existing.action IS DISTINCT FROM v_action
       OR v_existing.reason IS DISTINCT FROM v_reason THEN
      RAISE EXCEPTION 'Conflito de idempotencia administrativa';
    END IF;
    RETURN QUERY SELECT 'already_processed'::TEXT, v_existing.id,
      (v_existing.action = 'granted'), v_existing.created_at;
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::TEXT, 1));
  PERFORM 1 FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile nao encontrado'; END IF;

  SELECT * INTO v_current
    FROM public.admin_catalog_access_events ace
   WHERE ace.user_id = p_user_id
   ORDER BY ace.created_at DESC, ace.id DESC
   LIMIT 1
   FOR UPDATE;

  IF FOUND THEN
    IF (v_current.action = 'granted') = p_active THEN
      RETURN QUERY SELECT
        CASE WHEN p_active THEN 'already_active' ELSE 'already_inactive' END::TEXT,
        v_current.id, p_active, v_current.created_at;
      RETURN;
    END IF;
  ELSIF NOT p_active THEN
    RETURN QUERY SELECT 'already_inactive'::TEXT, NULL::UUID, FALSE, pg_catalog.now();
    RETURN;
  END IF;

  INSERT INTO public.admin_catalog_access_events (
    user_id, admin_user_id, action, reason, idempotency_key
  ) VALUES (
    p_user_id, p_admin_user_id, v_action, v_reason, p_idempotency_key
  ) RETURNING * INTO v_event;

  RETURN QUERY SELECT 'created'::TEXT, v_event.id,
    (v_event.action = 'granted'), v_event.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_catalog_access_state(p_user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  action TEXT,
  reason TEXT,
  admin_user_id UUID,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a consultar acesso de cortesia' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT DISTINCT ON (ace.user_id)
      ace.user_id, ace.action, ace.reason, ace.admin_user_id, ace.created_at
      FROM public.admin_catalog_access_events ace
     WHERE ace.user_id = ANY(COALESCE(p_user_ids, '{}'::UUID[]))
     ORDER BY ace.user_id, ace.created_at DESC, ace.id DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_credits_from_lots(
  p_user_id UUID,
  p_amount BIGINT,
  p_idempotency_key TEXT,
  p_campaign_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS SETOF public.credit_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.credit_reservations%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_available BIGINT;
  v_missing BIGINT;
  v_take BIGINT;
  v_lot public.credit_lots%ROWTYPE;
  v_paid_account BOOLEAN;
  v_courtesy_active BOOLEAN;
  v_full_catalog_access BOOLEAN;
  v_trial_allowed BOOLEAN;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a operar creditos por lotes' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id obrigatorio'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'amount deve ser maior que zero'; END IF;
  IF p_idempotency_key IS NULL OR pg_catalog.length(pg_catalog.btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency_key obrigatoria';
  END IF;
  IF p_metadata IS NULL OR pg_catalog.jsonb_typeof(p_metadata) <> 'object' THEN
    RAISE EXCEPTION 'metadata deve ser objeto JSON';
  END IF;

  SELECT * INTO v_existing
    FROM public.credit_reservations cr
   WHERE cr.user_id = p_user_id AND cr.idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF FOUND THEN RETURN NEXT v_existing; RETURN; END IF;

  SELECT * INTO v_profile
    FROM public.profiles p
   WHERE p.id = p_user_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile nao encontrado para user_id %', p_user_id; END IF;

  SELECT * INTO v_existing
    FROM public.credit_reservations cr
   WHERE cr.user_id = p_user_id AND cr.idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF FOUND THEN RETURN NEXT v_existing; RETURN; END IF;

  PERFORM public.expire_credit_lots_for_user(p_user_id);

  SELECT EXISTS (
    SELECT 1
      FROM public.credit_lots cl
     WHERE cl.user_id = p_user_id
       AND (
         (cl.source = 'subscription' AND cl.stripe_invoice_id IS NOT NULL)
         OR (cl.source = 'purchase' AND cl.stripe_checkout_session_id IS NOT NULL)
       )
  ) INTO v_paid_account;

  SELECT COALESCE((
    SELECT ace.action = 'granted'
      FROM public.admin_catalog_access_events ace
     WHERE ace.user_id = p_user_id
     ORDER BY ace.created_at DESC, ace.id DESC
     LIMIT 1
  ), FALSE) INTO v_courtesy_active;
  v_full_catalog_access := v_paid_account OR v_courtesy_active;

  v_trial_allowed :=
    (
      p_amount = 25
      AND p_metadata ->> 'product_code' = 'text_campaign'
      AND p_metadata ->> 'variant' = 'standard'
      AND p_metadata ->> 'smart_token_cost' = '25'
    )
    OR (
      p_metadata ->> 'product_code' = 'quick_banners'
      AND p_metadata ->> 'variant' = 'item'
      AND p_metadata ->> 'unit_cost' = '45'
      AND p_metadata ->> 'item_count' ~ '^[1-5]$'
      AND p_amount = (p_metadata ->> 'item_count')::BIGINT * 45
      AND p_metadata ->> 'smart_token_cost' = p_amount::TEXT
    )
    OR (
      p_amount = 100
      AND p_metadata ->> 'product_code' = 'smart_carousel'
      AND p_metadata ->> 'image_count' ~ '^(?:[5-9]|1[0-9]|20)$'
      AND pg_catalog.length(pg_catalog.btrim(p_metadata ->> 'catalog_version')) > 0
    );

  IF NOT v_full_catalog_access AND NOT v_trial_allowed THEN
    RAISE EXCEPTION 'TRIAL_PRODUCT_NOT_ALLOWED';
  END IF;

  SELECT COALESCE(pg_catalog.sum(cl.remaining_amount), 0)::BIGINT
    INTO v_available
    FROM public.credit_lots cl
   WHERE cl.user_id = p_user_id
     AND cl.status = 'active'
     AND cl.remaining_amount > 0
     AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())
     AND (
       cl.hidden_from_ui = FALSE
       OR (cl.source = 'trial' AND (v_full_catalog_access OR v_trial_allowed))
     );

  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Creditos insuficientes para esta geracao.';
  END IF;

  INSERT INTO public.credit_reservations (
    user_id, campaign_id, idempotency_key, amount, status, reason, metadata
  ) VALUES (
    p_user_id, p_campaign_id, p_idempotency_key, p_amount, 'reserved', p_reason,
    COALESCE(p_metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object('lot_engine', true, 'fefo', true)
  ) RETURNING * INTO v_existing;

  v_missing := p_amount;
  FOR v_lot IN
    SELECT *
      FROM public.credit_lots cl
     WHERE cl.user_id = p_user_id
       AND cl.status = 'active'
       AND cl.remaining_amount > 0
       AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())
       AND (
         cl.hidden_from_ui = FALSE
         OR (cl.source = 'trial' AND (v_full_catalog_access OR v_trial_allowed))
       )
     ORDER BY cl.expires_at ASC NULLS LAST, cl.created_at ASC, cl.id ASC
     FOR UPDATE
  LOOP
    EXIT WHEN v_missing = 0;
    v_take := LEAST(v_lot.remaining_amount, v_missing);

    UPDATE public.credit_lots cl
       SET remaining_amount = cl.remaining_amount - v_take,
           status = CASE WHEN cl.remaining_amount - v_take = 0 THEN 'exhausted' ELSE 'active' END
     WHERE cl.id = v_lot.id;

    INSERT INTO public.credit_reservation_allocations(reservation_id, lot_id, amount, status)
    VALUES (v_existing.id, v_lot.id, v_take, 'reserved');
    v_missing := v_missing - v_take;
  END LOOP;

  IF v_missing <> 0 THEN RAISE EXCEPTION 'Falha interna ao alocar creditos por lote.'; END IF;
  PERFORM public.sync_credit_balance_cache_from_lots(p_user_id);
  RETURN NEXT v_existing;
END;
$$;

REVOKE ALL ON FUNCTION public.set_admin_catalog_courtesy(UUID, UUID, BOOLEAN, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_admin_catalog_courtesy(UUID, UUID, BOOLEAN, TEXT, UUID) TO service_role;
REVOKE ALL ON FUNCTION public.admin_catalog_access_state(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_catalog_access_state(UUID[]) TO service_role;
REVOKE EXECUTE ON FUNCTION public.reserve_credits_from_lots(UUID, BIGINT, TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_credits_from_lots(UUID, BIGINT, TEXT, UUID, TEXT, JSONB) TO service_role;
