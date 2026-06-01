-- =============================================
-- SmartCorretorAI V2 - Credit reservation hold fix
-- =============================================
-- Corrige a semantica de reserva para evitar corrida de saldo:
-- - reserve_credits segura o saldo imediatamente
-- - consume_reserved_credits apenas confirma e registra o consumo
-- - cancel_credit_reservation devolve saldo reservado quando aplicavel

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
  v_profile public.profiles%ROWTYPE;
  v_current_balance BIGINT;
  v_new_balance BIGINT;
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

  SELECT *
    INTO v_profile
    FROM public.profiles
   WHERE id = p_user_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile nao encontrado para user_id %', p_user_id;
  END IF;

  -- Depois do lock no profile, reconsulta a reserva para serializar cliques
  -- simultaneos com a mesma idempotency_key.
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
        'Creditos expirados antes de reserva',
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
      || jsonb_build_object(
        'hold_applied', true,
        'saldo_antes_reserva', v_current_balance,
        'saldo_apos_reserva', v_new_balance
      )
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
  v_reservation public.credit_reservations%ROWTYPE;
  v_balance BIGINT;
  v_transaction_id UUID;
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
      v_reservation.user_id,
      v_reservation.campaign_id,
      v_reservation.idempotency_key,
      v_reservation.amount,
      v_reservation.status,
      v_reservation.reason,
      v_reservation.metadata,
      v_reservation.created_at,
      v_reservation.consumed_at,
      v_reservation.cancelled_at;
    RETURN;
  END IF;

  IF v_reservation.status = 'cancelled' THEN
    RAISE EXCEPTION 'Reserva de creditos cancelada';
  END IF;

  SELECT gb.saldo_creditos
    INTO v_balance
    FROM public.get_credit_balance(p_user_id) gb;

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
    -v_reservation.amount,
    COALESCE(v_balance, 0),
    p_observacao,
    COALESCE(p_metadata, '{}'::jsonb)
      || COALESCE(v_reservation.metadata, '{}'::jsonb)
      || jsonb_build_object(
        'reservation_id', v_reservation.id,
        'idempotency_key', v_reservation.idempotency_key,
        'hold_confirmed', true
      )
  )
  RETURNING id INTO v_transaction_id;

  UPDATE public.credit_reservations
     SET status = 'consumed',
         consumed_at = NOW(),
         metadata = COALESCE(metadata, '{}'::jsonb)
           || COALESCE(p_metadata, '{}'::jsonb)
           || jsonb_build_object(
             'saldo_resultante', COALESCE(v_balance, 0),
             'transaction_id', v_transaction_id,
             'hold_confirmed', true
           )
   WHERE id = v_reservation.id
   RETURNING * INTO v_reservation;

  RETURN QUERY
  SELECT
    v_reservation.id,
    v_reservation.user_id,
    v_reservation.campaign_id,
    v_reservation.idempotency_key,
    v_reservation.amount,
    v_reservation.status,
    v_reservation.reason,
    v_reservation.metadata,
    v_reservation.created_at,
    v_reservation.consumed_at,
    v_reservation.cancelled_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_credit_reservation(
  p_user_id UUID,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT NULL
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
  v_reservation public.credit_reservations%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_refunded_balance BIGINT;
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
    SELECT *
      INTO v_profile
      FROM public.profiles
     WHERE id = p_user_id
     FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'profile nao encontrado para user_id %', p_user_id;
    END IF;

    v_refunded_balance := COALESCE(v_profile.saldo_creditos, 0) + v_reservation.amount;

    UPDATE public.profiles
       SET saldo_creditos = v_refunded_balance
     WHERE id = p_user_id;

    UPDATE public.credit_reservations
       SET status = 'cancelled',
           cancelled_at = NOW(),
           reason = COALESCE(p_reason, reason),
           metadata = COALESCE(metadata, '{}'::jsonb)
             || jsonb_build_object(
               'hold_refunded', true,
               'saldo_apos_cancelamento', v_refunded_balance
             )
     WHERE id = v_reservation.id
     RETURNING * INTO v_reservation;
  END IF;

  RETURN QUERY
  SELECT
    v_reservation.id,
    v_reservation.user_id,
    v_reservation.campaign_id,
    v_reservation.idempotency_key,
    v_reservation.amount,
    v_reservation.status,
    v_reservation.reason,
    v_reservation.metadata,
    v_reservation.created_at,
    v_reservation.consumed_at,
    v_reservation.cancelled_at;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_credits(UUID, BIGINT, TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_reserved_credits(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_credit_reservation(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.reserve_credits(UUID, BIGINT, TEXT, UUID, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_reserved_credits(UUID, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_credit_reservation(UUID, TEXT, TEXT) TO service_role;
