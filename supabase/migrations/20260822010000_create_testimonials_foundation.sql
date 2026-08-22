-- Private testimonial foundation and atomic 500 ST marketing bonus.

CREATE TABLE public.testimonials (
  id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  profession_label TEXT NULL,
  publication_consent BOOLEAN NOT NULL DEFAULT FALSE,
  attribution_consent BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  approved_at TIMESTAMPTZ NULL,
  approved_by UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  rejected_at TIMESTAMPTZ NULL,
  rejected_by UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  rejection_reason TEXT NULL,
  published_at TIMESTAMPTZ NULL,
  published_by UUID NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  bonus_adjustment_id UUID NULL UNIQUE
    REFERENCES public.admin_credit_adjustments(id) ON DELETE RESTRICT,
  CONSTRAINT testimonials_body_check CHECK (
    pg_catalog.length(pg_catalog.btrim(body)) BETWEEN 1 AND 3000
  ),
  CONSTRAINT testimonials_profession_label_check CHECK (
    profession_label IS NULL
    OR pg_catalog.length(pg_catalog.btrim(profession_label)) BETWEEN 1 AND 120
  ),
  CONSTRAINT testimonials_status_check CHECK (
    status IN ('pending', 'approved', 'published', 'rejected')
  ),
  CONSTRAINT testimonials_approved_audit_check CHECK (
    status NOT IN ('approved', 'published')
    OR (approved_at IS NOT NULL AND approved_by IS NOT NULL)
  ),
  CONSTRAINT testimonials_rejected_audit_check CHECK (
    status <> 'rejected'
    OR (
      rejected_at IS NOT NULL
      AND rejected_by IS NOT NULL
      AND rejection_reason IS NOT NULL
      AND pg_catalog.length(pg_catalog.btrim(rejection_reason)) BETWEEN 1 AND 1000
    )
  ),
  CONSTRAINT testimonials_published_audit_check CHECK (
    status <> 'published'
    OR (
      publication_consent = TRUE
      AND published_at IS NOT NULL
      AND published_by IS NOT NULL
    )
  )
);

CREATE INDEX testimonials_status_submitted_idx
  ON public.testimonials(status, submitted_at DESC);
CREATE INDEX testimonials_user_submitted_idx
  ON public.testimonials(user_id, submitted_at DESC);

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.testimonials FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.testimonials TO service_role;

-- The economic ledger is the canonical one-bonus-per-account boundary.
CREATE UNIQUE INDEX credit_lots_testimonial_marketing_one_per_user_idx
  ON public.credit_lots(user_id)
  WHERE source = 'admin'
    AND catalog_version = 'testimonial-marketing-v1';

CREATE OR REPLACE FUNCTION public.approve_testimonial_and_grant_bonus(
  p_testimonial_id UUID,
  p_admin_user_id UUID,
  p_idempotency_key UUID
)
RETURNS TABLE (
  result TEXT,
  testimonial_id UUID,
  adjustment_id UUID,
  credit_lot_id UUID,
  saldo_creditos BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_testimonial public.testimonials%ROWTYPE;
  v_existing_adjustment public.admin_credit_adjustments%ROWTYPE;
  v_grant_result TEXT;
  v_adjustment_id UUID;
  v_credit_lot_id UUID;
  v_balance BIGINT;
  v_reason TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a aprovar depoimento' USING ERRCODE = '42501';
  END IF;
  IF p_admin_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.admin_users au WHERE au.user_id = p_admin_user_id
  ) THEN
    RAISE EXCEPTION 'Administrador nao autorizado' USING ERRCODE = '42501';
  END IF;
  IF p_testimonial_id IS NULL THEN RAISE EXCEPTION 'testimonial_id obrigatorio'; END IF;
  IF p_idempotency_key IS NULL THEN RAISE EXCEPTION 'idempotency_key obrigatoria'; END IF;

  SELECT * INTO v_testimonial
    FROM public.testimonials t
   WHERE t.id = p_testimonial_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Depoimento nao encontrado'; END IF;
  IF v_testimonial.status = 'rejected' THEN
    RAISE EXCEPTION 'Depoimento rejeitado nao pode receber bonus';
  END IF;

  IF v_testimonial.bonus_adjustment_id IS NOT NULL THEN
    SELECT * INTO v_existing_adjustment
      FROM public.admin_credit_adjustments aca
     WHERE aca.id = v_testimonial.bonus_adjustment_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Auditoria do bonus nao encontrada'; END IF;
    SELECT p.saldo_creditos INTO v_balance
      FROM public.profiles p
     WHERE p.id = v_testimonial.user_id;
    RETURN QUERY SELECT
      'already_processed'::TEXT,
      v_testimonial.id,
      v_existing_adjustment.id,
      v_existing_adjustment.credit_lot_id,
      v_balance;
    RETURN;
  END IF;

  -- A profile row lock serializes different testimonials from the same account.
  PERFORM 1
    FROM public.profiles p
   WHERE p.id = v_testimonial.user_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'profile nao encontrado'; END IF;

  SELECT cl.id INTO v_credit_lot_id
    FROM public.credit_lots cl
   WHERE cl.user_id = v_testimonial.user_id
     AND cl.source = 'admin'
     AND cl.catalog_version = 'testimonial-marketing-v1'
   FOR UPDATE;
  IF FOUND THEN
    SELECT * INTO v_existing_adjustment
      FROM public.admin_credit_adjustments aca
     WHERE aca.credit_lot_id = v_credit_lot_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Auditoria do bonus existente nao encontrada'; END IF;

    UPDATE public.testimonials t
       SET status = CASE WHEN t.status = 'pending' THEN 'approved' ELSE t.status END,
           approved_at = COALESCE(t.approved_at, pg_catalog.now()),
           approved_by = COALESCE(t.approved_by, p_admin_user_id)
     WHERE t.id = v_testimonial.id;

    SELECT p.saldo_creditos INTO v_balance
      FROM public.profiles p
     WHERE p.id = v_testimonial.user_id;
    RETURN QUERY SELECT
      'bonus_already_granted'::TEXT,
      v_testimonial.id,
      v_existing_adjustment.id,
      v_existing_adjustment.credit_lot_id,
      v_balance;
    RETURN;
  END IF;

  -- Never reinterpret an unrelated administrative operation as a testimonial bonus.
  IF EXISTS (
    SELECT 1
      FROM public.admin_credit_adjustments aca
     WHERE aca.idempotency_key = p_idempotency_key
  ) THEN
    RAISE EXCEPTION 'Conflito de idempotencia de depoimento';
  END IF;

  v_reason := 'Bonus de 500 ST da campanha de depoimentos: ' || v_testimonial.id::TEXT;

  SELECT g.result, g.adjustment_id, g.credit_lot_id, g.saldo_creditos
    INTO v_grant_result, v_adjustment_id, v_credit_lot_id, v_balance
    FROM public.grant_admin_credit_lot(
      p_admin_user_id,
      v_testimonial.user_id,
      500,
      v_reason,
      p_idempotency_key
    ) g;

  IF v_grant_result IS DISTINCT FROM 'created'
     OR v_adjustment_id IS NULL
     OR v_credit_lot_id IS NULL THEN
    RAISE EXCEPTION 'Falha ao criar bonus de depoimento';
  END IF;

  UPDATE public.credit_lots cl
     SET catalog_version = 'testimonial-marketing-v1',
         metadata = COALESCE(cl.metadata, '{}'::jsonb)
           || pg_catalog.jsonb_build_object(
             'grant_kind', 'marketing_testimonial',
             'campaign', 'testimonial-500-v1',
             'testimonial_id', v_testimonial.id,
             'admin_user_id', p_admin_user_id,
             'reason', v_reason
           )
   WHERE cl.id = v_credit_lot_id
     AND cl.user_id = v_testimonial.user_id
     AND cl.source = 'admin'
     AND cl.original_amount = 500;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lote de bonus invalido'; END IF;

  UPDATE public.testimonials t
     SET status = CASE WHEN t.status = 'pending' THEN 'approved' ELSE t.status END,
         approved_at = COALESCE(t.approved_at, pg_catalog.now()),
         approved_by = COALESCE(t.approved_by, p_admin_user_id),
         bonus_adjustment_id = v_adjustment_id
   WHERE t.id = v_testimonial.id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Falha ao vincular bonus ao depoimento'; END IF;

  RETURN QUERY SELECT
    'created'::TEXT,
    v_testimonial.id,
    v_adjustment_id,
    v_credit_lot_id,
    v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.approve_testimonial_and_grant_bonus(UUID, UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.approve_testimonial_and_grant_bonus(UUID, UUID, UUID)
  TO service_role;
