-- Submission idempotency and private transactional-email delivery state.

ALTER TABLE public.testimonials
  ADD COLUMN submission_idempotency_key UUID NULL;

CREATE UNIQUE INDEX testimonials_user_submission_idempotency_idx
  ON public.testimonials(user_id, submission_idempotency_key)
  WHERE submission_idempotency_key IS NOT NULL;

CREATE TABLE public.testimonial_email_deliveries (
  testimonial_id UUID NOT NULL
    REFERENCES public.testimonials(id) ON DELETE CASCADE,
  template TEXT NOT NULL,
  status TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT NULL,
  last_error_code TEXT NULL,
  claimed_at TIMESTAMPTZ NULL,
  sent_at TIMESTAMPTZ NULL,
  failed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT testimonial_email_deliveries_pkey
    PRIMARY KEY (testimonial_id, template),
  CONSTRAINT testimonial_email_deliveries_template_check
    CHECK (template IN ('received', 'bonus_granted')),
  CONSTRAINT testimonial_email_deliveries_status_check
    CHECK (status IN ('sending', 'sent', 'failed')),
  CONSTRAINT testimonial_email_deliveries_attempts_check
    CHECK (attempts >= 0),
  CONSTRAINT testimonial_email_deliveries_error_code_check
    CHECK (last_error_code IS NULL OR pg_catalog.length(last_error_code) <= 100)
);

ALTER TABLE public.testimonial_email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.testimonial_email_deliveries
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_testimonial_email(
  p_testimonial_id UUID,
  p_template TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_delivery public.testimonial_email_deliveries%ROWTYPE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a enviar email de depoimento' USING ERRCODE = '42501';
  END IF;
  IF p_testimonial_id IS NULL THEN RAISE EXCEPTION 'testimonial_id obrigatorio'; END IF;
  IF p_template NOT IN ('received', 'bonus_granted') THEN
    RAISE EXCEPTION 'template de email invalido';
  END IF;

  INSERT INTO public.testimonial_email_deliveries (
    testimonial_id, template, status, attempts, claimed_at
  ) VALUES (
    p_testimonial_id, p_template, 'sending', 1, pg_catalog.now()
  )
  ON CONFLICT (testimonial_id, template) DO NOTHING
  RETURNING * INTO v_delivery;
  IF FOUND THEN RETURN TRUE; END IF;

  SELECT * INTO v_delivery
    FROM public.testimonial_email_deliveries d
   WHERE d.testimonial_id = p_testimonial_id
     AND d.template = p_template
   FOR UPDATE;

  IF v_delivery.status = 'sent'
     OR (v_delivery.status = 'sending'
         AND v_delivery.claimed_at > pg_catalog.now() - INTERVAL '15 minutes') THEN
    RETURN FALSE;
  END IF;

  UPDATE public.testimonial_email_deliveries d
     SET status = 'sending',
         attempts = d.attempts + 1,
         provider_message_id = NULL,
         last_error_code = NULL,
         claimed_at = pg_catalog.now(),
         sent_at = NULL,
         failed_at = NULL
   WHERE d.testimonial_id = p_testimonial_id
     AND d.template = p_template;
  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_testimonial_email(
  p_testimonial_id UUID,
  p_template TEXT,
  p_succeeded BOOLEAN,
  p_provider_message_id TEXT DEFAULT NULL,
  p_error_code TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a concluir email de depoimento' USING ERRCODE = '42501';
  END IF;
  IF p_template NOT IN ('received', 'bonus_granted') THEN
    RAISE EXCEPTION 'template de email invalido';
  END IF;

  UPDATE public.testimonial_email_deliveries d
     SET status = CASE WHEN p_succeeded THEN 'sent' ELSE 'failed' END,
         provider_message_id = CASE WHEN p_succeeded THEN pg_catalog.left(p_provider_message_id, 500) ELSE NULL END,
         last_error_code = CASE WHEN p_succeeded THEN NULL ELSE pg_catalog.left(p_error_code, 100) END,
         sent_at = CASE WHEN p_succeeded THEN pg_catalog.now() ELSE NULL END,
         failed_at = CASE WHEN p_succeeded THEN NULL ELSE pg_catalog.now() END
   WHERE d.testimonial_id = p_testimonial_id
     AND d.template = p_template
     AND d.status = 'sending';
  IF NOT FOUND THEN RAISE EXCEPTION 'claim de email nao encontrado'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_testimonial_email(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_testimonial_email(UUID, TEXT, BOOLEAN, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_testimonial_email(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_testimonial_email(UUID, TEXT, BOOLEAN, TEXT, TEXT) TO service_role;
