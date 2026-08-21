-- Private operational aggregates and atomic audited support grants for Admin.

CREATE TABLE public.admin_credit_adjustments (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  credit_lot_id UUID NOT NULL UNIQUE REFERENCES public.credit_lots(id) ON DELETE RESTRICT,
  amount BIGINT NOT NULL CHECK (amount BETWEEN 1 AND 10000),
  reason TEXT NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(reason)) BETWEEN 10 AND 500),
  idempotency_key UUID NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX admin_credit_adjustments_user_created_idx
  ON public.admin_credit_adjustments(user_id, created_at DESC);
CREATE INDEX admin_credit_adjustments_admin_created_idx
  ON public.admin_credit_adjustments(admin_user_id, created_at DESC);

ALTER TABLE public.admin_credit_adjustments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.admin_credit_adjustments FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.admin_credit_adjustments TO service_role;

CREATE OR REPLACE FUNCTION public.grant_admin_credit_lot(
  p_admin_user_id UUID,
  p_user_id UUID,
  p_amount BIGINT,
  p_reason TEXT,
  p_idempotency_key UUID
)
RETURNS TABLE (
  result TEXT,
  adjustment_id UUID,
  credit_lot_id UUID,
  saldo_creditos BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing public.admin_credit_adjustments%ROWTYPE;
  v_lot_id UUID;
  v_adjustment_id UUID;
  v_balance BIGINT;
  v_reason TEXT := pg_catalog.btrim(p_reason);
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a conceder ajuste administrativo' USING ERRCODE = '42501';
  END IF;
  IF p_admin_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_users au WHERE au.user_id = p_admin_user_id
  ) THEN
    RAISE EXCEPTION 'Administrador nao autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN RAISE EXCEPTION 'user_id obrigatorio'; END IF;
  IF p_amount IS NULL OR p_amount NOT BETWEEN 1 AND 10000 THEN
    RAISE EXCEPTION 'amount deve estar entre 1 e 10000';
  END IF;
  IF v_reason IS NULL OR pg_catalog.length(v_reason) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'motivo deve ter entre 10 e 500 caracteres';
  END IF;
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'idempotency_key obrigatoria'; END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key::TEXT, 0));

  SELECT * INTO v_existing
    FROM public.admin_credit_adjustments aca
   WHERE aca.idempotency_key = p_idempotency_key
   FOR UPDATE;
  IF FOUND THEN
    IF v_existing.admin_user_id IS DISTINCT FROM p_admin_user_id
       OR v_existing.user_id IS DISTINCT FROM p_user_id
       OR v_existing.amount IS DISTINCT FROM p_amount
       OR v_existing.reason IS DISTINCT FROM v_reason THEN
      RAISE EXCEPTION 'Conflito de idempotencia administrativa';
    END IF;
    SELECT p.saldo_creditos INTO v_balance FROM public.profiles p WHERE p.id = p_user_id;
    RETURN QUERY SELECT 'already_processed'::TEXT, v_existing.id, v_existing.credit_lot_id, v_balance;
    RETURN;
  END IF;

  PERFORM 1 FROM public.profiles p WHERE p.id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile nao encontrado'; END IF;

  INSERT INTO public.credit_lots (
    user_id, source, original_amount, remaining_amount, expires_at, status,
    idempotency_key, financial_reference, catalog_version, hidden_from_ui, metadata
  ) VALUES (
    p_user_id, 'admin', p_amount, p_amount, NULL, 'active',
    'admin:' || p_idempotency_key::TEXT, p_idempotency_key::TEXT,
    'admin-support-v1', FALSE,
    pg_catalog.jsonb_build_object('reason', v_reason, 'admin_user_id', p_admin_user_id)
  ) RETURNING id INTO v_lot_id;

  INSERT INTO public.admin_credit_adjustments (
    user_id, admin_user_id, credit_lot_id, amount, reason, idempotency_key
  ) VALUES (
    p_user_id, p_admin_user_id, v_lot_id, p_amount, v_reason, p_idempotency_key
  ) RETURNING id INTO v_adjustment_id;

  v_balance := public.sync_credit_balance_cache_from_lots(p_user_id);
  RETURN QUERY SELECT 'created'::TEXT, v_adjustment_id, v_lot_id, v_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_credit_overview(p_since TIMESTAMPTZ DEFAULT NULL)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE WHEN auth.role() IS DISTINCT FROM 'service_role'
    THEN pg_catalog.jsonb_build_object('authorized', FALSE)
    ELSE pg_catalog.jsonb_build_object(
      'purchaseLots', COUNT(*) FILTER (WHERE cl.source = 'purchase' AND (p_since IS NULL OR cl.created_at >= p_since)),
      'purchase2000', COUNT(*) FILTER (WHERE cl.source = 'purchase' AND cl.original_amount = 2000 AND (p_since IS NULL OR cl.created_at >= p_since)),
      'purchase4000', COUNT(*) FILTER (WHERE cl.source = 'purchase' AND cl.original_amount = 4000 AND (p_since IS NULL OR cl.created_at >= p_since)),
      'purchaseUsers', COUNT(DISTINCT cl.user_id) FILTER (WHERE cl.source = 'purchase' AND (p_since IS NULL OR cl.created_at >= p_since)),
      'purchaseGranted', COALESCE(SUM(cl.original_amount) FILTER (WHERE cl.source = 'purchase' AND (p_since IS NULL OR cl.created_at >= p_since)), 0),
      'subscriptionGranted', COALESCE(SUM(cl.original_amount) FILTER (WHERE cl.source = 'subscription' AND (p_since IS NULL OR cl.created_at >= p_since)), 0),
      'adminGranted', COALESCE(SUM(cl.original_amount) FILTER (WHERE cl.source = 'admin' AND (p_since IS NULL OR cl.created_at >= p_since)), 0),
      'purchaseRemaining', COALESCE(SUM(cl.remaining_amount) FILTER (WHERE cl.source = 'purchase' AND cl.status = 'active' AND cl.remaining_amount > 0 AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())), 0),
      'circulation', COALESCE(SUM(cl.remaining_amount) FILTER (WHERE cl.status = 'active' AND cl.hidden_from_ui = FALSE AND cl.remaining_amount > 0 AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())), 0),
      'purchaseActiveFullLots', COUNT(*) FILTER (WHERE cl.source = 'purchase' AND cl.status = 'active' AND cl.remaining_amount = cl.original_amount AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())),
      'purchasePartialLots', COUNT(*) FILTER (WHERE cl.source = 'purchase' AND cl.status = 'active' AND cl.remaining_amount > 0 AND cl.remaining_amount < cl.original_amount AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())),
      'purchaseExhaustedLots', COUNT(*) FILTER (WHERE cl.source = 'purchase' AND cl.status = 'exhausted'),
      'purchaseExpiredLots', COUNT(*) FILTER (WHERE cl.source = 'purchase' AND (cl.status = 'expired' OR (cl.status = 'active' AND cl.expires_at <= pg_catalog.now()))),
      'recognizedPurchaseCatalogCents', CASE
        WHEN COUNT(*) FILTER (WHERE cl.source = 'purchase' AND cl.original_amount NOT IN (2000, 4000) AND (p_since IS NULL OR cl.created_at >= p_since)) > 0 THEN NULL
        ELSE COUNT(*) FILTER (WHERE cl.source = 'purchase' AND cl.original_amount = 2000 AND (p_since IS NULL OR cl.created_at >= p_since)) * 4990
           + COUNT(*) FILTER (WHERE cl.source = 'purchase' AND cl.original_amount = 4000 AND (p_since IS NULL OR cl.created_at >= p_since)) * 9790
      END,
      'consumed', COALESCE((
        SELECT SUM(cra.amount)
          FROM public.credit_reservation_allocations cra
         WHERE cra.status = 'consumed' AND (p_since IS NULL OR cra.consumed_at >= p_since)
      ), 0),
      'purchaseConsumed', COALESCE((
        SELECT SUM(cra.amount)
          FROM public.credit_reservation_allocations cra
          JOIN public.credit_lots pcl ON pcl.id = cra.lot_id
         WHERE cra.status = 'consumed' AND pcl.source = 'purchase'
           AND (p_since IS NULL OR cra.consumed_at >= p_since)
      ), 0)
    ) END
  FROM public.credit_lots cl;
$$;

CREATE OR REPLACE FUNCTION public.admin_client_credit_metrics(p_user_ids UUID[])
RETURNS TABLE (
  user_id UUID,
  subscription_granted BIGINT,
  purchase_granted BIGINT,
  admin_granted BIGINT,
  purchase_remaining BIGINT,
  purchase_count BIGINT,
  purchase_catalog_cents BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT cl.user_id,
    COALESCE(SUM(cl.original_amount) FILTER (WHERE cl.source = 'subscription'), 0)::BIGINT,
    COALESCE(SUM(cl.original_amount) FILTER (WHERE cl.source = 'purchase'), 0)::BIGINT,
    COALESCE(SUM(cl.original_amount) FILTER (WHERE cl.source = 'admin'), 0)::BIGINT,
    COALESCE(SUM(cl.remaining_amount) FILTER (WHERE cl.source = 'purchase' AND cl.status = 'active' AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())), 0)::BIGINT,
    COUNT(*) FILTER (WHERE cl.source = 'purchase')::BIGINT,
    CASE WHEN COUNT(*) FILTER (WHERE cl.source = 'purchase' AND cl.original_amount NOT IN (2000, 4000)) > 0 THEN NULL
      ELSE (COUNT(*) FILTER (WHERE cl.source = 'purchase' AND cl.original_amount = 2000) * 4990
          + COUNT(*) FILTER (WHERE cl.source = 'purchase' AND cl.original_amount = 4000) * 9790)::BIGINT END
  FROM public.credit_lots cl
  WHERE auth.role() = 'service_role' AND cl.user_id = ANY(p_user_ids)
  GROUP BY cl.user_id;
$$;

CREATE OR REPLACE FUNCTION public.admin_client_activity_metrics(p_user_ids UUID[])
RETURNS TABLE (user_id UUID, generations BIGINT, failures BIGINT, last_generation_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH activity AS (
    SELECT r.user_id, r.status = 'failed' AS failed, r.created_at FROM public.gemini_video_economy_requests r WHERE r.user_id = ANY(p_user_ids) AND r.status <> 'insufficient'
    UNION ALL SELECT r.user_id, r.status = 'failed', r.created_at FROM public.veo_video_economy_requests r WHERE r.user_id = ANY(p_user_ids) AND r.status <> 'insufficient'
    UNION ALL SELECT r.user_id, r.status = 'failed', r.created_at FROM public.text_campaign_delivery_requests r WHERE r.user_id = ANY(p_user_ids) AND r.status <> 'expired'
    UNION ALL SELECT r.user_id, r.status = 'failed', r.created_at FROM public.smart_carousel_economy_requests r WHERE r.user_id = ANY(p_user_ids) AND r.status <> 'insufficient'
    UNION ALL SELECT r.user_id, i.status = 'failed', i.created_at FROM public.real_estate_banner_items i JOIN public.real_estate_banner_requests r ON r.id = i.request_id WHERE r.user_id = ANY(p_user_ids)
    UNION ALL SELECT r.user_id, i.status = 'failed', i.created_at FROM public.quick_banner_delivery_items i JOIN public.quick_banner_delivery_requests r ON r.id = i.request_id WHERE r.user_id = ANY(p_user_ids)
  )
  SELECT a.user_id, COUNT(*)::BIGINT, COUNT(*) FILTER (WHERE a.failed)::BIGINT, MAX(a.created_at)
  FROM activity a WHERE auth.role() = 'service_role' GROUP BY a.user_id;
$$;

CREATE OR REPLACE FUNCTION public.admin_generation_activity_overview()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH activity AS (
    SELECT r.user_id, r.created_at FROM public.gemini_video_economy_requests r WHERE r.status <> 'insufficient' AND r.created_at >= pg_catalog.now() - INTERVAL '30 days'
    UNION ALL SELECT r.user_id, r.created_at FROM public.veo_video_economy_requests r WHERE r.status <> 'insufficient' AND r.created_at >= pg_catalog.now() - INTERVAL '30 days'
    UNION ALL SELECT r.user_id, r.created_at FROM public.text_campaign_delivery_requests r WHERE r.status <> 'expired' AND r.created_at >= pg_catalog.now() - INTERVAL '30 days'
    UNION ALL SELECT r.user_id, r.created_at FROM public.smart_carousel_economy_requests r WHERE r.status <> 'insufficient' AND r.created_at >= pg_catalog.now() - INTERVAL '30 days'
    UNION ALL SELECT r.user_id, i.created_at FROM public.real_estate_banner_items i JOIN public.real_estate_banner_requests r ON r.id = i.request_id WHERE i.created_at >= pg_catalog.now() - INTERVAL '30 days'
    UNION ALL SELECT r.user_id, i.created_at FROM public.quick_banner_delivery_items i JOIN public.quick_banner_delivery_requests r ON r.id = i.request_id WHERE i.created_at >= pg_catalog.now() - INTERVAL '30 days'
  )
  SELECT pg_catalog.jsonb_build_object(
    'usersToday', COUNT(DISTINCT a.user_id) FILTER (WHERE a.created_at >= pg_catalog.date_trunc('day', pg_catalog.now())),
    'users7Days', COUNT(DISTINCT a.user_id) FILTER (WHERE a.created_at >= pg_catalog.now() - INTERVAL '7 days'),
    'users30Days', COUNT(DISTINCT a.user_id) FILTER (WHERE a.created_at >= pg_catalog.now() - INTERVAL '30 days')
  )
  FROM activity a WHERE auth.role() = 'service_role';
$$;

REVOKE ALL ON FUNCTION public.grant_admin_credit_lot(UUID, UUID, BIGINT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_credit_overview(TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_client_credit_metrics(UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_client_activity_metrics(UUID[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_generation_activity_overview() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_admin_credit_lot(UUID, UUID, BIGINT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_credit_overview(TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_client_credit_metrics(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_client_activity_metrics(UUID[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_generation_activity_overview() TO service_role;
