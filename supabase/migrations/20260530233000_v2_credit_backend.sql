-- =============================================
-- SmartCorretorAI V2 - Credit backend
-- =============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS saldo_creditos BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creditos_expiram_em TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('assinatura', 'recarga', 'consumo', 'ajuste_admin', 'expiracao')),
  creditos BIGINT NOT NULL,
  saldo_resultante BIGINT NOT NULL,
  observacao TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id
  ON public.credit_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at
  ON public.credit_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_tipo
  ON public.credit_transactions(tipo);

CREATE TABLE IF NOT EXISTS public.credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  campaign_id UUID NULL,
  idempotency_key TEXT NOT NULL,
  amount BIGINT NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL CHECK (status IN ('reserved', 'consumed', 'cancelled')),
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  consumed_at TIMESTAMPTZ NULL,
  cancelled_at TIMESTAMPTZ NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_reservations_user_id_idempotency_key
  ON public.credit_reservations(user_id, idempotency_key);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_user_id
  ON public.credit_reservations(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_status
  ON public.credit_reservations(status);

CREATE OR REPLACE FUNCTION public.add_credits(
  p_user_id UUID,
  p_amount BIGINT,
  p_tipo TEXT DEFAULT 'ajuste_admin',
  p_observacao TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  saldo_creditos BIGINT,
  creditos_expiram_em TIMESTAMPTZ,
  transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_current_balance BIGINT;
  v_new_balance BIGINT;
  v_expires_at TIMESTAMPTZ;
  v_transaction_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id obrigatorio';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount deve ser maior que zero';
  END IF;

  IF p_tipo NOT IN ('assinatura', 'recarga', 'ajuste_admin') THEN
    RAISE EXCEPTION 'tipo invalido para add_credits: %', p_tipo;
  END IF;

  SELECT *
    INTO v_profile
    FROM public.profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile nao encontrado para user_id %', p_user_id;
  END IF;

  v_current_balance := COALESCE(v_profile.saldo_creditos, 0);

  IF v_profile.creditos_expiram_em IS NOT NULL
     AND v_profile.creditos_expiram_em < NOW()
     AND v_current_balance > 0 THEN
    INSERT INTO public.credit_transactions (
      user_id,
      tipo,
      creditos,
      saldo_resultante,
      observacao,
      metadata
    )
    VALUES (
      p_user_id,
      'expiracao',
      -v_current_balance,
      0,
      'Creditos expirados antes de novo credito',
      jsonb_build_object('expired_at', v_profile.creditos_expiram_em)
    );

    v_current_balance := 0;
  END IF;

  v_new_balance := v_current_balance + p_amount;

  v_expires_at := COALESCE(
    p_expires_at,
    CASE
      WHEN p_tipo = 'recarga' THEN NOW() + INTERVAL '180 days'
      WHEN p_tipo = 'assinatura' THEN NOW() + INTERVAL '30 days'
      ELSE v_profile.creditos_expiram_em
    END
  );

  UPDATE public.profiles
     SET saldo_creditos = v_new_balance,
         creditos_expiram_em = v_expires_at
   WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id,
    tipo,
    creditos,
    saldo_resultante,
    observacao,
    metadata
  )
  VALUES (
    p_user_id,
    p_tipo,
    p_amount,
    v_new_balance,
    p_observacao,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('expires_at', v_expires_at)
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY
  SELECT p_user_id, v_new_balance, v_expires_at, v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_credit_balance(p_user_id UUID)
RETURNS TABLE (
  user_id UUID,
  saldo_creditos BIGINT,
  creditos_expiram_em TIMESTAMPTZ,
  expirado BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    p.id AS user_id,
    CASE
      WHEN p.creditos_expiram_em IS NOT NULL AND p.creditos_expiram_em < NOW() THEN 0::BIGINT
      ELSE COALESCE(p.saldo_creditos, 0)::BIGINT
    END AS saldo_creditos,
    p.creditos_expiram_em,
    (p.creditos_expiram_em IS NOT NULL AND p.creditos_expiram_em < NOW()) AS expirado
  FROM public.profiles p
  WHERE p.id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id UUID,
  p_amount BIGINT,
  p_observacao TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  user_id UUID,
  saldo_creditos BIGINT,
  transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_current_balance BIGINT;
  v_new_balance BIGINT;
  v_transaction_id UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id obrigatorio';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount deve ser maior que zero';
  END IF;

  SELECT *
    INTO v_profile
    FROM public.profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile nao encontrado para user_id %', p_user_id;
  END IF;

  v_current_balance := COALESCE(v_profile.saldo_creditos, 0);

  IF v_profile.creditos_expiram_em IS NOT NULL
     AND v_profile.creditos_expiram_em < NOW() THEN
    IF v_current_balance > 0 THEN
      INSERT INTO public.credit_transactions (
        user_id,
        tipo,
        creditos,
        saldo_resultante,
        observacao,
        metadata
      )
      VALUES (
        p_user_id,
        'expiracao',
        -v_current_balance,
        0,
        'Creditos expirados antes de consumo',
        jsonb_build_object('expired_at', v_profile.creditos_expiram_em)
      );
    END IF;

    UPDATE public.profiles
       SET saldo_creditos = 0
     WHERE id = p_user_id;

    v_current_balance := 0;
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Creditos insuficientes para esta geracao.';
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE public.profiles
     SET saldo_creditos = v_new_balance
   WHERE id = p_user_id;

  INSERT INTO public.credit_transactions (
    user_id,
    tipo,
    creditos,
    saldo_resultante,
    observacao,
    metadata
  )
  VALUES (
    p_user_id,
    'consumo',
    -p_amount,
    v_new_balance,
    p_observacao,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_transaction_id;

  RETURN QUERY
  SELECT p_user_id, v_new_balance, v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_credits(
  p_user_id UUID,
  p_amount BIGINT,
  p_idempotency_key TEXT,
  p_campaign_id UUID DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  campaign_id UUID,
  idempotency_key TEXT,
  amount BIGINT,
  status TEXT,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_existing public.credit_reservations%ROWTYPE;
  v_balance BIGINT;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id obrigatorio';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount deve ser maior que zero';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency_key obrigatoria';
  END IF;

  SELECT *
    INTO v_existing
    FROM public.credit_reservations cr
   WHERE cr.user_id = p_user_id
     AND cr.idempotency_key = p_idempotency_key
   FOR UPDATE;

  IF FOUND THEN
    RETURN QUERY
    SELECT
      v_existing.id,
      v_existing.user_id,
      v_existing.campaign_id,
      v_existing.idempotency_key,
      v_existing.amount,
      v_existing.status,
      v_existing.reason,
      v_existing.metadata,
      v_existing.created_at,
      v_existing.consumed_at,
      v_existing.cancelled_at;
    RETURN;
  END IF;

  SELECT gb.saldo_creditos
    INTO v_balance
    FROM public.get_credit_balance(p_user_id) gb;

  IF COALESCE(v_balance, 0) < p_amount THEN
    RAISE EXCEPTION 'Creditos insuficientes para esta geracao.';
  END IF;

  INSERT INTO public.credit_reservations (
    user_id,
    campaign_id,
    idempotency_key,
    amount,
    status,
    reason,
    metadata
  )
  VALUES (
    p_user_id,
    p_campaign_id,
    p_idempotency_key,
    p_amount,
    'reserved',
    p_reason,
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING * INTO v_existing;

  RETURN QUERY
  SELECT
    v_existing.id,
    v_existing.user_id,
    v_existing.campaign_id,
    v_existing.idempotency_key,
    v_existing.amount,
    v_existing.status,
    v_existing.reason,
    v_existing.metadata,
    v_existing.created_at,
    v_existing.consumed_at,
    v_existing.cancelled_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_reserved_credits(
  p_user_id UUID,
  p_idempotency_key TEXT,
  p_observacao TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  reservation_id UUID,
  status TEXT,
  amount BIGINT,
  saldo_creditos BIGINT,
  transaction_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_reservation public.credit_reservations%ROWTYPE;
  v_consumption RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id obrigatorio';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency_key obrigatoria';
  END IF;

  SELECT *
    INTO v_reservation
    FROM public.credit_reservations cr
   WHERE cr.user_id = p_user_id
     AND cr.idempotency_key = p_idempotency_key
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva de creditos nao encontrada';
  END IF;

  IF v_reservation.status = 'consumed' THEN
    RETURN QUERY
    SELECT
      v_reservation.id,
      v_reservation.status,
      v_reservation.amount,
      COALESCE((SELECT gb.saldo_creditos FROM public.get_credit_balance(p_user_id) gb), 0),
      NULL::UUID;
    RETURN;
  END IF;

  IF v_reservation.status = 'cancelled' THEN
    RAISE EXCEPTION 'Reserva de creditos cancelada';
  END IF;

  SELECT *
    INTO v_consumption
    FROM public.consume_credits(
      p_user_id,
      v_reservation.amount,
      p_observacao,
      COALESCE(p_metadata, '{}'::jsonb)
        || COALESCE(v_reservation.metadata, '{}'::jsonb)
        || jsonb_build_object(
          'reservation_id', v_reservation.id,
          'idempotency_key', v_reservation.idempotency_key
        )
    );

  UPDATE public.credit_reservations
     SET status = 'consumed',
         consumed_at = NOW(),
         metadata = COALESCE(metadata, '{}'::jsonb)
           || COALESCE(p_metadata, '{}'::jsonb)
           || jsonb_build_object(
             'saldo_resultante', v_consumption.saldo_creditos,
             'transaction_id', v_consumption.transaction_id
           )
   WHERE id = v_reservation.id
   RETURNING * INTO v_reservation;

  RETURN QUERY
  SELECT
    v_reservation.id,
    v_reservation.status,
    v_reservation.amount,
    v_consumption.saldo_creditos,
    v_consumption.transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_credit_reservation(
  p_user_id UUID,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS TABLE (
  reservation_id UUID,
  status TEXT,
  cancelled_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_reservation public.credit_reservations%ROWTYPE;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id obrigatorio';
  END IF;

  IF p_idempotency_key IS NULL OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'idempotency_key obrigatoria';
  END IF;

  SELECT *
    INTO v_reservation
    FROM public.credit_reservations cr
   WHERE cr.user_id = p_user_id
     AND cr.idempotency_key = p_idempotency_key
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reserva de creditos nao encontrada';
  END IF;

  IF v_reservation.status = 'reserved' THEN
    UPDATE public.credit_reservations
       SET status = 'cancelled',
           cancelled_at = NOW(),
           reason = COALESCE(p_reason, reason)
     WHERE id = v_reservation.id
     RETURNING * INTO v_reservation;
  END IF;

  RETURN QUERY
  SELECT v_reservation.id, v_reservation.status, v_reservation.cancelled_at;
END;
$$;

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios veem suas transacoes de creditos" ON public.credit_transactions;
CREATE POLICY "Usuarios veem suas transacoes de creditos"
  ON public.credit_transactions
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Usuarios veem suas reservas de creditos" ON public.credit_reservations;
CREATE POLICY "Usuarios veem suas reservas de creditos"
  ON public.credit_reservations
  FOR SELECT
  USING (auth.uid() = user_id);

REVOKE ALL ON FUNCTION public.add_credits(UUID, BIGINT, TEXT, TEXT, JSONB, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_credits(UUID, BIGINT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_credit_balance(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reserve_credits(UUID, BIGINT, TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_reserved_credits(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_credit_reservation(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.add_credits(UUID, BIGINT, TEXT, TEXT, JSONB, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_credits(UUID, BIGINT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_credit_balance(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reserve_credits(UUID, BIGINT, TEXT, UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_reserved_credits(UUID, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_credit_reservation(UUID, TEXT, TEXT) TO service_role;
