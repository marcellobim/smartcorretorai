-- Atomic, idempotent Stripe grants into the canonical FEFO credit-lot ledger.

CREATE OR REPLACE FUNCTION public.grant_stripe_credit_lot(
  p_user_id UUID,
  p_amount BIGINT,
  p_source TEXT,
  p_expires_at TIMESTAMPTZ,
  p_catalog_version TEXT,
  p_stripe_invoice_id TEXT DEFAULT NULL,
  p_stripe_checkout_session_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS TABLE (
  result TEXT,
  credit_lot_id UUID,
  saldo_creditos BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_idempotency_key TEXT;
  v_financial_reference TEXT;
  v_inserted_id UUID;
  v_existing public.credit_lots%ROWTYPE;
  v_balance BIGINT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a conceder lote financeiro Stripe' USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id obrigatorio';
  END IF;

  -- Locking the profile serializes balance refreshes for the same user and
  -- also guarantees that the cache row exists before creating the lot.
  PERFORM 1 FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile nao encontrado para user_id %', p_user_id;
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount deve ser maior que zero';
  END IF;

  IF p_source NOT IN ('subscription', 'purchase') THEN
    RAISE EXCEPTION 'source Stripe invalido: %', p_source;
  END IF;

  IF p_expires_at IS NULL THEN
    RAISE EXCEPTION 'expires_at obrigatorio';
  END IF;

  IF NULLIF(pg_catalog.btrim(p_catalog_version), '') IS NULL THEN
    RAISE EXCEPTION 'catalog_version obrigatoria';
  END IF;

  IF p_metadata IS NULL OR pg_catalog.jsonb_typeof(p_metadata) <> 'object' THEN
    RAISE EXCEPTION 'metadata deve ser objeto JSON';
  END IF;

  IF p_source = 'subscription' THEN
    IF NULLIF(pg_catalog.btrim(p_stripe_invoice_id), '') IS NULL
       OR p_stripe_checkout_session_id IS NOT NULL THEN
      RAISE EXCEPTION 'subscription exige somente stripe_invoice_id';
    END IF;
    IF pg_catalog.length(p_stripe_invoice_id) > 255 THEN
      RAISE EXCEPTION 'stripe_invoice_id invalido';
    END IF;
    v_financial_reference := pg_catalog.btrim(p_stripe_invoice_id);
    v_idempotency_key := 'stripe:invoice:' || v_financial_reference;
  ELSE
    IF NULLIF(pg_catalog.btrim(p_stripe_checkout_session_id), '') IS NULL
       OR p_stripe_invoice_id IS NOT NULL THEN
      RAISE EXCEPTION 'purchase exige somente stripe_checkout_session_id';
    END IF;
    IF pg_catalog.length(p_stripe_checkout_session_id) > 255 THEN
      RAISE EXCEPTION 'stripe_checkout_session_id invalido';
    END IF;
    v_financial_reference := pg_catalog.btrim(p_stripe_checkout_session_id);
    v_idempotency_key := 'stripe:checkout:' || v_financial_reference;
  END IF;

  INSERT INTO public.credit_lots (
    user_id,
    source,
    original_amount,
    remaining_amount,
    expires_at,
    status,
    idempotency_key,
    financial_reference,
    stripe_invoice_id,
    stripe_checkout_session_id,
    catalog_version,
    hidden_from_ui,
    metadata
  ) SELECT
    p_user_id,
    p_source,
    p_amount,
    p_amount,
    p_expires_at,
    'active',
    v_idempotency_key,
    v_financial_reference,
    CASE WHEN p_source = 'subscription' THEN v_financial_reference ELSE NULL END,
    CASE WHEN p_source = 'purchase' THEN v_financial_reference ELSE NULL END,
    p_catalog_version,
    FALSE,
    p_metadata
  WHERE p_expires_at > pg_catalog.now()
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_inserted_id;

  IF v_inserted_id IS NOT NULL THEN
    v_balance := public.sync_credit_balance_cache_from_lots(p_user_id);
    RETURN QUERY SELECT 'created'::TEXT, v_inserted_id, v_balance;
    RETURN;
  END IF;

  SELECT cl.*
    INTO v_existing
    FROM public.credit_lots cl
   WHERE (p_source = 'subscription' AND cl.stripe_invoice_id = v_financial_reference)
      OR (p_source = 'purchase' AND cl.stripe_checkout_session_id = v_financial_reference)
      OR (cl.user_id = p_user_id AND cl.idempotency_key = v_idempotency_key)
   ORDER BY
     CASE
       WHEN cl.stripe_invoice_id = v_financial_reference
         OR cl.stripe_checkout_session_id = v_financial_reference THEN 0
       ELSE 1
     END
   LIMIT 1
   FOR UPDATE;

  IF NOT FOUND THEN
    IF p_expires_at <= pg_catalog.now() THEN
      RAISE EXCEPTION 'expires_at deve estar no futuro para nova concessao';
    END IF;
    RAISE EXCEPTION 'Conflito de idempotencia Stripe sem lote correspondente';
  END IF;

  IF v_existing.user_id IS DISTINCT FROM p_user_id
     OR v_existing.source IS DISTINCT FROM p_source
     OR v_existing.original_amount IS DISTINCT FROM p_amount
     OR v_existing.idempotency_key IS DISTINCT FROM v_idempotency_key
     OR (p_source = 'subscription' AND v_existing.stripe_invoice_id IS DISTINCT FROM v_financial_reference)
     OR (p_source = 'purchase' AND v_existing.stripe_checkout_session_id IS DISTINCT FROM v_financial_reference) THEN
    RAISE EXCEPTION 'Conflito de idempotencia Stripe incompatível';
  END IF;

  SELECT p.saldo_creditos
    INTO v_balance
    FROM public.profiles p
   WHERE p.id = p_user_id;

  RETURN QUERY SELECT 'already_processed'::TEXT, v_existing.id, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_stripe_credit_lot(
  UUID, BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.grant_stripe_credit_lot(
  UUID, BIGINT, TEXT, TIMESTAMPTZ, TEXT, TEXT, TEXT, JSONB
) TO service_role;
