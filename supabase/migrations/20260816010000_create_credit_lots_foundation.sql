-- SmartCorretorAI commercial architecture phase 1.
-- Foundation only: these *_from_lots RPCs do not replace the production RPCs.

CREATE TABLE IF NOT EXISTS public.credit_lots (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL CHECK (source IN ('subscription', 'purchase', 'trial', 'admin', 'migration')),
  original_amount BIGINT NOT NULL CHECK (original_amount > 0),
  remaining_amount BIGINT NOT NULL CHECK (remaining_amount >= 0 AND remaining_amount <= original_amount),
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'exhausted', 'expired', 'revoked')),
  idempotency_key TEXT NOT NULL,
  financial_reference TEXT NULL,
  subscription_id UUID NULL REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  stripe_invoice_id TEXT NULL,
  stripe_checkout_session_id TEXT NULL,
  catalog_version TEXT NULL,
  hidden_from_ui BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT credit_lots_trial_hidden_check CHECK (source <> 'trial' OR hidden_from_ui = TRUE),
  CONSTRAINT credit_lots_user_idempotency_unique UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_credit_lots_user_id ON public.credit_lots(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_lots_status ON public.credit_lots(status);
CREATE INDEX IF NOT EXISTS idx_credit_lots_expires_at ON public.credit_lots(expires_at);
CREATE INDEX IF NOT EXISTS idx_credit_lots_source ON public.credit_lots(source);
CREATE INDEX IF NOT EXISTS idx_credit_lots_user_fefo
  ON public.credit_lots(user_id, expires_at ASC NULLS LAST, created_at ASC, id ASC)
  WHERE status = 'active' AND remaining_amount > 0;
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_lots_stripe_invoice_unique
  ON public.credit_lots(stripe_invoice_id)
  WHERE stripe_invoice_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_lots_stripe_checkout_unique
  ON public.credit_lots(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.set_credit_lot_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_credit_lot_updated_at ON public.credit_lots;
CREATE TRIGGER set_credit_lot_updated_at
BEFORE UPDATE ON public.credit_lots
FOR EACH ROW EXECUTE FUNCTION public.set_credit_lot_updated_at();

CREATE TABLE IF NOT EXISTS public.credit_reservation_allocations (
  reservation_id UUID NOT NULL REFERENCES public.credit_reservations(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.credit_lots(id) ON DELETE RESTRICT,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'consumed', 'cancelled', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  consumed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL,
  PRIMARY KEY (reservation_id, lot_id)
);

CREATE INDEX IF NOT EXISTS idx_credit_reservation_allocations_lot
  ON public.credit_reservation_allocations(lot_id);
CREATE INDEX IF NOT EXISTS idx_credit_reservation_allocations_status
  ON public.credit_reservation_allocations(status);

-- Private economic telemetry proposal. No provider credentials or raw secrets belong here.
CREATE TABLE IF NOT EXISTS public.economic_generation_events (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  reservation_id UUID NULL REFERENCES public.credit_reservations(id) ON DELETE SET NULL,
  product_code TEXT NOT NULL,
  variant TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NULL,
  duration_seconds NUMERIC NULL CHECK (duration_seconds IS NULL OR duration_seconds >= 0),
  quantity INTEGER NULL CHECK (quantity IS NULL OR quantity > 0),
  usage JSONB NOT NULL DEFAULT '{}'::jsonb,
  estimated_cost_micros BIGINT NULL CHECK (estimated_cost_micros IS NULL OR estimated_cost_micros >= 0),
  protected_cost_micros BIGINT NULL CHECK (protected_cost_micros IS NULL OR protected_cost_micros >= 0),
  currency CHAR(3) NULL,
  catalog_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('started', 'provider_succeeded', 'delivered', 'failed', 'refunded')),
  idempotency_key TEXT NOT NULL UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_economic_generation_events_product
  ON public.economic_generation_events(product_code, variant, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_economic_generation_events_user
  ON public.economic_generation_events(user_id, created_at DESC);

ALTER TABLE public.credit_lots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reservation_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_generation_events ENABLE ROW LEVEL SECURITY;

-- No authenticated table policies are intentional: users receive only aggregate
-- balance through a narrowly scoped RPC. In particular, hidden trial lots remain private.
REVOKE ALL ON TABLE public.credit_lots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.credit_reservation_allocations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.economic_generation_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.credit_lots TO service_role;
GRANT ALL ON TABLE public.credit_reservation_allocations TO service_role;
GRANT ALL ON TABLE public.economic_generation_events TO service_role;

REVOKE EXECUTE ON FUNCTION public.set_credit_lot_updated_at() FROM PUBLIC, anon, authenticated;

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
     AND cl.hidden_from_ui = FALSE
     AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now());

  UPDATE public.profiles
     SET saldo_creditos = v_balance,
         -- A single legacy timestamp cannot represent independent lot expirations.
         -- Keeping it NULL prevents the legacy reader from expiring the entire
         -- aggregate when only the first FEFO lot expires.
         creditos_expiram_em = NULL
   WHERE id = p_user_id;

  RETURN v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_credit_lots_for_user(p_user_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expired_amount BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a operar creditos por lotes' USING ERRCODE = '42501';
  END IF;

  WITH candidates AS (
    SELECT cl.id, cl.remaining_amount
      FROM public.credit_lots cl
     WHERE cl.user_id = p_user_id
       AND cl.status IN ('active', 'exhausted')
       AND cl.expires_at IS NOT NULL
       AND cl.expires_at <= pg_catalog.now()
     FOR UPDATE
  ), expired AS (
    UPDATE public.credit_lots cl
       SET remaining_amount = 0,
           status = 'expired'
      FROM candidates c
     WHERE cl.id = c.id
     RETURNING c.remaining_amount
  )
  SELECT COALESCE(pg_catalog.sum(expired.remaining_amount), 0)::BIGINT
    INTO v_expired_amount
    FROM expired;

  PERFORM public.sync_credit_balance_cache_from_lots(p_user_id);
  RETURN v_expired_amount;
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
        AND cl.hidden_from_ui = FALSE
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
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a operar creditos por lotes' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id obrigatorio'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'amount deve ser maior que zero'; END IF;
  IF p_idempotency_key IS NULL OR pg_catalog.length(pg_catalog.btrim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency_key obrigatoria';
  END IF;

  SELECT * INTO v_existing
    FROM public.credit_reservations cr
   WHERE cr.user_id = p_user_id AND cr.idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF FOUND THEN RETURN NEXT v_existing; RETURN; END IF;

  -- A user-scoped row lock serializes all reservations and avoids false
  -- insufficient-balance results under concurrency.
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

  SELECT COALESCE(pg_catalog.sum(cl.remaining_amount), 0)::BIGINT
    INTO v_available
    FROM public.credit_lots cl
   WHERE cl.user_id = p_user_id
     AND cl.status = 'active'
     AND cl.remaining_amount > 0
     AND cl.hidden_from_ui = FALSE
     AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now());
  IF v_available < p_amount THEN RAISE EXCEPTION 'Creditos insuficientes para esta geracao.'; END IF;

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
       AND cl.hidden_from_ui = FALSE
       AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())
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

CREATE OR REPLACE FUNCTION public.consume_reserved_credits_from_lots(
  p_user_id UUID,
  p_idempotency_key TEXT,
  p_observacao TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS SETOF public.credit_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reservation public.credit_reservations%ROWTYPE;
  v_balance BIGINT;
  v_transaction_id UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a operar creditos por lotes' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_reservation
    FROM public.credit_reservations cr
   WHERE cr.user_id = p_user_id AND cr.idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva de creditos nao encontrada'; END IF;
  IF v_reservation.status = 'consumed' THEN RETURN NEXT v_reservation; RETURN; END IF;
  IF v_reservation.status = 'cancelled' THEN RAISE EXCEPTION 'Reserva de creditos cancelada'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.credit_reservation_allocations cra
     WHERE cra.reservation_id = v_reservation.id AND cra.status = 'reserved'
  ) THEN RAISE EXCEPTION 'Reserva sem allocations de lotes'; END IF;

  UPDATE public.credit_reservation_allocations cra
     SET status = 'consumed', consumed_at = pg_catalog.now()
   WHERE cra.reservation_id = v_reservation.id AND cra.status = 'reserved';

  v_balance := public.sync_credit_balance_cache_from_lots(p_user_id);
  INSERT INTO public.credit_transactions(user_id, tipo, creditos, saldo_resultante, observacao, metadata)
  VALUES (
    p_user_id, 'consumo', -v_reservation.amount, v_balance, p_observacao,
    COALESCE(p_metadata, '{}'::jsonb) || COALESCE(v_reservation.metadata, '{}'::jsonb)
      || pg_catalog.jsonb_build_object('reservation_id', v_reservation.id, 'lot_engine', true)
  ) RETURNING id INTO v_transaction_id;

  UPDATE public.credit_reservations cr
     SET status = 'consumed', consumed_at = pg_catalog.now(),
         metadata = COALESCE(cr.metadata, '{}'::jsonb)
           || COALESCE(p_metadata, '{}'::jsonb)
           || pg_catalog.jsonb_build_object('transaction_id', v_transaction_id, 'lot_engine', true)
   WHERE cr.id = v_reservation.id
   RETURNING * INTO v_reservation;
  RETURN NEXT v_reservation;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_credit_reservation_from_lots(
  p_user_id UUID,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS SETOF public.credit_reservations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_reservation public.credit_reservations%ROWTYPE;
  v_allocation public.credit_reservation_allocations%ROWTYPE;
  v_lot public.credit_lots%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a operar creditos por lotes' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_reservation
    FROM public.credit_reservations cr
   WHERE cr.user_id = p_user_id AND cr.idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reserva de creditos nao encontrada'; END IF;
  IF v_reservation.status <> 'reserved' THEN RETURN NEXT v_reservation; RETURN; END IF;

  PERFORM 1 FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;
  FOR v_allocation IN
    SELECT * FROM public.credit_reservation_allocations cra
     WHERE cra.reservation_id = v_reservation.id AND cra.status = 'reserved'
     ORDER BY cra.created_at, cra.lot_id
     FOR UPDATE
  LOOP
    SELECT * INTO v_lot FROM public.credit_lots cl WHERE cl.id = v_allocation.lot_id FOR UPDATE;
    IF v_lot.expires_at IS NOT NULL AND v_lot.expires_at <= pg_catalog.now() THEN
      UPDATE public.credit_lots SET remaining_amount = 0, status = 'expired' WHERE id = v_lot.id;
      UPDATE public.credit_reservation_allocations
         SET status = 'expired', cancelled_at = pg_catalog.now()
       WHERE reservation_id = v_allocation.reservation_id AND lot_id = v_allocation.lot_id;
    ELSIF v_lot.status = 'revoked' THEN
      UPDATE public.credit_reservation_allocations
         SET status = 'cancelled', cancelled_at = pg_catalog.now()
       WHERE reservation_id = v_allocation.reservation_id AND lot_id = v_allocation.lot_id;
    ELSE
      IF v_lot.remaining_amount + v_allocation.amount > v_lot.original_amount THEN
        RAISE EXCEPTION 'Cancelamento excederia o valor original do lote %', v_lot.id;
      END IF;
      UPDATE public.credit_lots
         SET remaining_amount = remaining_amount + v_allocation.amount, status = 'active'
       WHERE id = v_lot.id;
      UPDATE public.credit_reservation_allocations
         SET status = 'cancelled', cancelled_at = pg_catalog.now()
       WHERE reservation_id = v_allocation.reservation_id AND lot_id = v_allocation.lot_id;
    END IF;
  END LOOP;

  UPDATE public.credit_reservations cr
     SET status = 'cancelled', cancelled_at = pg_catalog.now(), reason = COALESCE(p_reason, cr.reason),
         metadata = COALESCE(cr.metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object('lot_engine', true)
   WHERE cr.id = v_reservation.id
   RETURNING * INTO v_reservation;
  PERFORM public.sync_credit_balance_cache_from_lots(p_user_id);
  RETURN NEXT v_reservation;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.sync_credit_balance_cache_from_lots(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_credit_lots_for_user(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_credit_lot_balance(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_credits_from_lots(UUID, BIGINT, TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_reserved_credits_from_lots(UUID, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_credit_reservation_from_lots(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_credit_balance_cache_from_lots(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_credit_lots_for_user(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_credit_lot_balance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_credits_from_lots(UUID, BIGINT, TEXT, UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_reserved_credits_from_lots(UUID, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_credit_reservation_from_lots(UUID, TEXT, TEXT) TO service_role;
