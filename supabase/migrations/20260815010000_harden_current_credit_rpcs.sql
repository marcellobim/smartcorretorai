-- SmartCorretorAI - P0 authorization hardening for the current credit backend.
--
-- This migration intentionally does not introduce or reference the credit-lot
-- architecture. Existing credit balances, transactions, reservations and RPC
-- business semantics are preserved.

-- get_credit_balance is not called by the browser application. Keep it internal
-- and fail closed even if its EXECUTE privilege is accidentally broadened later.
CREATE OR REPLACE FUNCTION public.get_credit_balance(p_user_id UUID)
RETURNS TABLE (
  saldo_creditos BIGINT,
  creditos_expiram_em TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_saldo BIGINT;
  v_expira_em TIMESTAMPTZ;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Nao autorizado a consultar saldo de creditos'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public.expire_user_credits(p_user_id);

  SELECT p.saldo_creditos, p.creditos_expiram_em
    INTO v_saldo, v_expira_em
    FROM public.profiles AS p
   WHERE p.id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil nao encontrado para o usuario %', p_user_id
      USING ERRCODE = 'P0002';
  END IF;

  IF v_expira_em IS NOT NULL AND v_expira_em < pg_catalog.now() THEN
    RETURN QUERY SELECT 0::BIGINT, v_expira_em;
  ELSE
    RETURN QUERY SELECT v_saldo, v_expira_em;
  END IF;
END;
$$;

-- The remaining functions retain their current bodies. An empty fixed
-- search_path prevents SECURITY DEFINER object-resolution attacks; their SQL
-- already schema-qualifies application objects.
ALTER FUNCTION public.add_credits(UUID, BIGINT, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  SET search_path = '';
ALTER FUNCTION public.consume_credits(UUID, BIGINT, TEXT, JSONB)
  SET search_path = '';
ALTER FUNCTION public.reserve_credits(UUID, BIGINT, TEXT, UUID, TEXT, JSONB)
  SET search_path = '';
ALTER FUNCTION public.consume_reserved_credits(UUID, TEXT, TEXT, JSONB)
  SET search_path = '';
ALTER FUNCTION public.cancel_credit_reservation(UUID, TEXT, TEXT)
  SET search_path = '';
ALTER FUNCTION public.expire_user_credits(UUID)
  SET search_path = '';

-- PostgreSQL grants EXECUTE to PUBLIC for new functions by default. Revoke the
-- inherited and explicit client roles, then grant only the backend role used by
-- the audited Edge Functions.
REVOKE EXECUTE ON FUNCTION public.add_credits(UUID, BIGINT, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_credits(UUID, BIGINT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.reserve_credits(UUID, BIGINT, TEXT, UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_reserved_credits(UUID, TEXT, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_credit_reservation(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_credit_balance(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_user_credits(UUID)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.add_credits(UUID, BIGINT, TEXT, TEXT, JSONB, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_credits(UUID, BIGINT, TEXT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_credits(UUID, BIGINT, TEXT, UUID, TEXT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_reserved_credits(UUID, TEXT, TEXT, JSONB)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.cancel_credit_reservation(UUID, TEXT, TEXT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_credit_balance(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_user_credits(UUID)
  TO service_role;

-- Production currently combines table grants for anon/authenticated with an
-- ALL/true policy assigned to PUBLIC. That combination bypasses row ownership.
-- Keep authenticated self-read, remove all browser writes and leave backend
-- management to service_role (which bypasses RLS by design).
DROP POLICY IF EXISTS "Service role gerencia assinaturas" ON public.subscriptions;
DROP POLICY IF EXISTS "subscriptions_self" ON public.subscriptions;
DROP POLICY IF EXISTS "Users can view own subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Usuário vê própria assinatura" ON public.subscriptions;
DROP POLICY IF EXISTS "Usuário vê apenas sua assinatura" ON public.subscriptions;

CREATE POLICY "authenticated_read_own_subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL PRIVILEGES ON TABLE public.subscriptions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.subscriptions TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.subscriptions TO service_role;
