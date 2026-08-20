-- Minimal durable idempotency for Stripe-triggered transactional emails.

CREATE TABLE public.stripe_transactional_email_deliveries (
  idempotency_key TEXT PRIMARY KEY,
  stripe_event_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template TEXT NOT NULL CHECK (template IN (
    'purchase_confirmed',
    'subscription_welcome',
    'subscription_renewed',
    'subscription_payment_failed',
    'subscription_cancelled'
  )),
  status TEXT NOT NULL CHECK (status IN ('sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT stripe_transactional_email_event_template_unique UNIQUE (stripe_event_id, template)
);

ALTER TABLE public.stripe_transactional_email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.stripe_transactional_email_deliveries FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_stripe_transactional_email(
  p_idempotency_key TEXT,
  p_stripe_event_id TEXT,
  p_user_id UUID,
  p_template TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_inserted_key TEXT;
  v_delivery public.stripe_transactional_email_deliveries%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a registrar email transacional' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(pg_catalog.btrim(p_idempotency_key), '') IS NULL
     OR pg_catalog.length(p_idempotency_key) > 256
     OR NULLIF(pg_catalog.btrim(p_stripe_event_id), '') IS NULL
     OR p_user_id IS NULL THEN
    RAISE EXCEPTION 'Identificacao de email transacional invalida';
  END IF;
  IF p_template NOT IN (
    'purchase_confirmed',
    'subscription_welcome',
    'subscription_renewed',
    'subscription_payment_failed',
    'subscription_cancelled'
  ) THEN
    RAISE EXCEPTION 'Template de email transacional invalido';
  END IF;

  INSERT INTO public.stripe_transactional_email_deliveries (
    idempotency_key, stripe_event_id, user_id, template, status
  ) VALUES (
    pg_catalog.btrim(p_idempotency_key), pg_catalog.btrim(p_stripe_event_id), p_user_id, p_template, 'sending'
  )
  ON CONFLICT DO NOTHING
  RETURNING idempotency_key INTO v_inserted_key;

  IF v_inserted_key IS NOT NULL THEN
    RETURN TRUE;
  END IF;

  SELECT * INTO v_delivery
    FROM public.stripe_transactional_email_deliveries
   WHERE idempotency_key = pg_catalog.btrim(p_idempotency_key)
   FOR UPDATE;

  IF NOT FOUND
     OR v_delivery.stripe_event_id IS DISTINCT FROM pg_catalog.btrim(p_stripe_event_id)
     OR v_delivery.user_id IS DISTINCT FROM p_user_id
     OR v_delivery.template IS DISTINCT FROM p_template THEN
    RAISE EXCEPTION 'Conflito de idempotencia de email transacional';
  END IF;

  IF v_delivery.status = 'sent'
     OR (v_delivery.status = 'sending' AND v_delivery.updated_at > pg_catalog.now() - INTERVAL '15 minutes') THEN
    RETURN FALSE;
  END IF;

  UPDATE public.stripe_transactional_email_deliveries
     SET status = 'sending',
         attempts = attempts + 1,
         provider_message_id = NULL,
         updated_at = pg_catalog.now()
   WHERE idempotency_key = v_delivery.idempotency_key;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_stripe_transactional_email(
  p_idempotency_key TEXT,
  p_succeeded BOOLEAN,
  p_provider_message_id TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a concluir email transacional' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(pg_catalog.btrim(p_idempotency_key), '') IS NULL OR p_succeeded IS NULL THEN
    RAISE EXCEPTION 'Conclusao de email transacional invalida';
  END IF;

  UPDATE public.stripe_transactional_email_deliveries
     SET status = CASE WHEN p_succeeded THEN 'sent' ELSE 'failed' END,
         provider_message_id = CASE WHEN p_succeeded THEN NULLIF(pg_catalog.btrim(p_provider_message_id), '') ELSE NULL END,
         updated_at = pg_catalog.now()
   WHERE idempotency_key = pg_catalog.btrim(p_idempotency_key)
     AND status = 'sending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim de email transacional nao encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_stripe_transactional_email(TEXT, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_stripe_transactional_email(TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_transactional_email(TEXT, TEXT, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_stripe_transactional_email(TEXT, BOOLEAN, TEXT) TO service_role;
