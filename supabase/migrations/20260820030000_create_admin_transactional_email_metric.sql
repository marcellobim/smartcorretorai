-- Expose only the aggregate needed by Admin while keeping delivery rows private.

CREATE OR REPLACE FUNCTION public.admin_transactional_email_failure_count(
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a agregar emails transacionais' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT COUNT(*)::BIGINT
      FROM public.stripe_transactional_email_deliveries d
     WHERE d.status = 'failed'
       AND (p_since IS NULL OR d.created_at >= p_since)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_transactional_email_failure_count(TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_transactional_email_failure_count(TIMESTAMPTZ)
  TO service_role;
