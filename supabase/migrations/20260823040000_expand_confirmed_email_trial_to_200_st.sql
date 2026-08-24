-- SmartCorretorAI signup trial v2 forward-fix.
-- New confirmed accounts receive 200 ST. Existing v1 trial lots are untouched.
-- Before confirmed Stripe payment, trial lots can fund only the three canonical
-- server-owned SKU shapes verified in the economic catalog.

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

  SELECT COALESCE(pg_catalog.sum(cl.remaining_amount), 0)::BIGINT
    INTO v_available
    FROM public.credit_lots cl
   WHERE cl.user_id = p_user_id
     AND cl.status = 'active'
     AND cl.remaining_amount > 0
     AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())
     AND (
       cl.hidden_from_ui = FALSE
       OR (cl.source = 'trial' AND (v_paid_account OR v_trial_allowed))
     );

  IF v_available < p_amount THEN
    IF NOT v_paid_account
       AND NOT v_trial_allowed
       AND EXISTS (
         SELECT 1 FROM public.credit_lots cl
          WHERE cl.user_id = p_user_id
            AND cl.source = 'trial'
            AND cl.status = 'active'
            AND cl.remaining_amount > 0
            AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())
       ) THEN
      RAISE EXCEPTION 'TRIAL_PRODUCT_NOT_ALLOWED';
    END IF;
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
         OR (cl.source = 'trial' AND (v_paid_account OR v_trial_allowed))
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

CREATE OR REPLACE FUNCTION public.grant_confirmed_email_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.email_confirmed_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.credit_lots (
    user_id, source, original_amount, remaining_amount, expires_at, status,
    idempotency_key, catalog_version, hidden_from_ui, metadata
  ) VALUES (
    NEW.id, 'trial', 200, 200, NULL, 'active',
    'trial:signup-selected-products:v2', 'trial-2026-08-selected-products-v2', TRUE,
    pg_catalog.jsonb_build_object(
      'benefit_code', 'signup_selected_products',
      'benefit_version', 'v2',
      'smart_tokens', 200,
      'email_confirmation_required', TRUE
    )
  )
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles p
     SET saldo_creditos = COALESCE((
       SELECT pg_catalog.sum(cl.remaining_amount)
         FROM public.credit_lots cl
        WHERE cl.user_id = NEW.id
          AND cl.status = 'active'
          AND cl.remaining_amount > 0
          AND (cl.hidden_from_ui = FALSE OR cl.source = 'trial')
          AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())
     ), 0)::BIGINT,
         creditos_expiram_em = NULL
   WHERE p.id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_confirmed_email_trial() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_credits_from_lots(UUID, BIGINT, TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_credits_from_lots(UUID, BIGINT, TEXT, UUID, TEXT, JSONB) TO service_role;
