-- Phase 1 clean-baseline gate. The previous commercial test legacy must be
-- empty before credit lots can become the source of truth. Historical closed
-- ledger rows are not interpreted as current entitlement and are not mutated.

DO $$
DECLARE
  v_count BIGINT;
BEGIN
  SELECT pg_catalog.count(*) INTO v_count
    FROM public.profiles p
   WHERE COALESCE(p.saldo_creditos, 0) <> 0;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Baseline bloqueada: % profiles possuem saldo_creditos diferente de zero.', v_count;
  END IF;

  SELECT pg_catalog.count(*) INTO v_count
    FROM public.profiles p
   WHERE COALESCE(p.creditos_avulsos, 0) <> 0;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Baseline bloqueada: % profiles possuem creditos_avulsos diferente de zero.', v_count;
  END IF;

  SELECT pg_catalog.count(*) INTO v_count
    FROM public.profiles p
   WHERE p.creditos_expiram_em IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Baseline bloqueada: % profiles possuem creditos_expiram_em.', v_count;
  END IF;

  SELECT pg_catalog.count(*) INTO v_count
    FROM public.profiles p
   WHERE p.trial_ends_at IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Baseline bloqueada: % profiles possuem trial_ends_at.', v_count;
  END IF;

  SELECT pg_catalog.count(*) INTO v_count
    FROM public.profiles p
   WHERE p.stripe_customer_id IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Baseline bloqueada: % profiles possuem stripe_customer_id.', v_count;
  END IF;

  SELECT pg_catalog.count(*) INTO v_count
    FROM public.subscriptions s
   WHERE s.stripe_subscription_id IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Baseline bloqueada: % subscriptions possuem stripe_subscription_id.', v_count;
  END IF;

  SELECT pg_catalog.count(*) INTO v_count FROM public.subscriptions;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Baseline bloqueada: existem % subscriptions.', v_count;
  END IF;

  SELECT pg_catalog.count(*) INTO v_count
    FROM public.credit_reservations cr
   WHERE cr.status = 'reserved';
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Baseline bloqueada: existem % credit_reservations reservadas.', v_count;
  END IF;

  SELECT pg_catalog.count(*) INTO v_count FROM public.credit_lots;
  IF v_count > 0 THEN
    RAISE EXCEPTION 'Baseline bloqueada: ja existem % credit_lots.', v_count;
  END IF;
END;
$$;

-- Private operational reconciliation. Once new lots are issued, this view
-- compares the visible lot cache and open reservations without reconstructing
-- entitlement from historical transactions or closed reservations.
CREATE OR REPLACE VIEW public.credit_lot_shadow_reconciliation
WITH (security_invoker = true)
AS
SELECT
  p.id AS user_id,
  COALESCE(p.saldo_creditos, 0)::BIGINT AS profile_cached_balance,
  COALESCE((
    SELECT pg_catalog.sum(cl.remaining_amount)
      FROM public.credit_lots cl
     WHERE cl.user_id = p.id
       AND cl.status = 'active'
       AND cl.hidden_from_ui = FALSE
       AND cl.remaining_amount > 0
       AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())
  ), 0)::BIGINT AS lot_visible_balance,
  COALESCE((
    SELECT pg_catalog.sum(cl.remaining_amount)
      FROM public.credit_lots cl
     WHERE cl.user_id = p.id
       AND cl.status = 'active'
       AND cl.hidden_from_ui = TRUE
       AND cl.remaining_amount > 0
       AND (cl.expires_at IS NULL OR cl.expires_at > pg_catalog.now())
  ), 0)::BIGINT AS lot_hidden_balance,
  COALESCE((
    SELECT pg_catalog.sum(cra.amount)
      FROM public.credit_reservation_allocations cra
      JOIN public.credit_reservations cr ON cr.id = cra.reservation_id
     WHERE cr.user_id = p.id
       AND cr.status = 'reserved'
       AND cra.status = 'reserved'
  ), 0)::BIGINT AS lot_reserved_balance,
  COALESCE((
    SELECT pg_catalog.sum(cr.amount)
      FROM public.credit_reservations cr
     WHERE cr.user_id = p.id
       AND cr.status = 'reserved'
  ), 0)::BIGINT AS open_reservation_balance
FROM public.profiles p;

REVOKE ALL ON TABLE public.credit_lot_shadow_reconciliation FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.credit_lot_shadow_reconciliation TO service_role;

DO $$
DECLARE
  v_mismatch_count BIGINT;
BEGIN
  SELECT pg_catalog.count(*)
    INTO v_mismatch_count
    FROM public.credit_lot_shadow_reconciliation r
   WHERE r.profile_cached_balance <> r.lot_visible_balance
      OR r.open_reservation_balance <> r.lot_reserved_balance;

  IF v_mismatch_count > 0 THEN
    RAISE EXCEPTION 'Reconciliacao de lotes divergiu para % usuarios.', v_mismatch_count;
  END IF;
END;
$$;
