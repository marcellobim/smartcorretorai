-- SmartCorretorAI signup trial v1.
-- Grants one private 25 ST lot after e-mail confirmation and restricts that
-- lot to text_campaign:standard until Stripe confirms the first payment.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.credit_lots cl WHERE cl.source = 'trial') THEN
    RAISE EXCEPTION 'Trial v1 bloqueado: existem lotes trial preexistentes para revisao manual.';
  END IF;
END;
$$;

CREATE UNIQUE INDEX credit_lots_one_trial_per_user_idx
  ON public.credit_lots(user_id)
  WHERE source = 'trial';

CREATE OR REPLACE FUNCTION public.sync_credit_balance_cache_from_lots(p_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_balance BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a operar creditos por lotes' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(pg_catalog.sum(cl.remaining_amount), 0)::BIGINT
    INTO v_balance
    FROM public.credit_lots cl
   WHERE cl.user_id = p_user_id
     AND cl.status = 'active'
     AND cl.remaining_amount > 0
     AND (cl.hidden_from_ui = FALSE OR cl.source = 'trial')
     AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now());

  UPDATE public.profiles
     SET saldo_creditos = v_balance,
         creditos_expiram_em = NULL
   WHERE id = p_user_id;

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_credit_lot_balance(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  visible_balance BIGINT,
  hidden_balance BIGINT,
  reserved_balance BIGINT,
  next_visible_expiration TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a operar creditos por lotes' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    p_user_id,
    COALESCE(pg_catalog.sum(cl.remaining_amount) FILTER (
      WHERE cl.status = 'active'
        AND (cl.hidden_from_ui = FALSE OR cl.source = 'trial')
        AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())
    ), 0)::BIGINT,
    COALESCE(pg_catalog.sum(cl.remaining_amount) FILTER (
      WHERE cl.status = 'active'
        AND cl.hidden_from_ui = TRUE
        AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())
    ), 0)::BIGINT,
    COALESCE((
      SELECT pg_catalog.sum(cra.amount)
        FROM public.credit_reservation_allocations cra
        JOIN public.credit_reservations cr ON cr.id = cra.reservation_id
       WHERE cr.user_id = p_user_id
         AND cra.status = 'reserved'
    ), 0)::BIGINT,
    pg_catalog.min(cl.expires_at) FILTER (
      WHERE cl.status = 'active'
        AND cl.remaining_amount > 0
        AND cl.hidden_from_ui = FALSE
        AND cl.expires_at > pg_catalog.now()
    )
  FROM public.credit_lots cl
  WHERE cl.user_id = p_user_id;
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
    p_amount = 25
    AND p_metadata ->> 'product_code' = 'text_campaign'
    AND p_metadata ->> 'variant' = 'standard'
    AND p_metadata ->> 'smart_token_cost' = '25';

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

CREATE OR REPLACE FUNCTION public.initialize_profile_credit_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  SELECT COALESCE(pg_catalog.sum(cl.remaining_amount), 0)::BIGINT
    INTO NEW.saldo_creditos
    FROM public.credit_lots cl
   WHERE cl.user_id = NEW.id
     AND cl.status = 'active'
     AND cl.remaining_amount > 0
     AND (cl.hidden_from_ui = FALSE OR cl.source = 'trial')
     AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS initialize_profile_credit_balance ON public.profiles;
CREATE TRIGGER initialize_profile_credit_balance
BEFORE INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.initialize_profile_credit_balance();

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
    NEW.id, 'trial', 25, 25, NULL, 'active',
    'trial:signup-text-campaign:v1', 'trial-2026-08-text-campaign-v1', TRUE,
    pg_catalog.jsonb_build_object(
      'benefit_code', 'signup_text_campaign',
      'benefit_version', 'v1',
      'allowed_product_code', 'text_campaign',
      'allowed_variant', 'standard',
      'smart_tokens', 25,
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

DROP TRIGGER IF EXISTS grant_confirmed_email_trial_on_insert ON auth.users;
CREATE TRIGGER grant_confirmed_email_trial_on_insert
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_confirmed_email_trial();

DROP TRIGGER IF EXISTS grant_confirmed_email_trial_on_confirmation ON auth.users;
CREATE TRIGGER grant_confirmed_email_trial_on_confirmation
AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.grant_confirmed_email_trial();

REVOKE ALL ON FUNCTION public.initialize_profile_credit_balance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_confirmed_email_trial() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_credit_balance_cache_from_lots(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_credit_lot_balance(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_credits_from_lots(UUID, BIGINT, TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_credit_balance_cache_from_lots(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_credit_lot_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_credits_from_lots(UUID, BIGINT, TEXT, UUID, TEXT, JSONB) TO service_role;
