-- Prepare Google OAuth without enabling the remote provider.
-- Keeps password Auth, the existing trial and paid-account economy unchanged.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles
  ALTER COLUMN nome DROP NOT NULL,
  ALTER COLUMN email DROP NOT NULL,
  ALTER COLUMN senha_hash DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name TEXT;
  v_avatar_url TEXT;
BEGIN
  v_name := NULLIF(pg_catalog.btrim(COALESCE(
    NEW.raw_user_meta_data ->> 'full_name',
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'nome'
  )), '');
  v_avatar_url := NULLIF(pg_catalog.btrim(COALESCE(
    NEW.raw_user_meta_data ->> 'avatar_url',
    NEW.raw_user_meta_data ->> 'picture'
  )), '');

  INSERT INTO public.profiles (
    id, email, full_name, nome, role, plano, avatar_url
  ) VALUES (
    NEW.id, NEW.email, v_name, v_name, 'user', 'starter', v_avatar_url
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.user_legal_acceptances
  DROP CONSTRAINT IF EXISTS user_legal_acceptances_acceptance_context_check;
ALTER TABLE public.user_legal_acceptances
  ADD CONSTRAINT user_legal_acceptances_acceptance_context_check
  CHECK (acceptance_context IN ('signup', 'oauth_onboarding'));

CREATE OR REPLACE FUNCTION public.has_current_legal_acceptance(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_legal_acceptances ula
     WHERE ula.user_id = p_user_id
       AND ula.terms_version = '2026-08'
       AND ula.privacy_version = '2026-08'
  )
$$;

CREATE OR REPLACE FUNCTION public.current_session_uses_google_oauth()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      COALESCE(auth.jwt() -> 'app_metadata' ->> 'provider', '') = 'google'
      OR COALESCE(auth.jwt() -> 'app_metadata' -> 'providers', '[]'::JSONB) @> '["google"]'::JSONB
    )
    AND EXISTS (
      SELECT 1
        FROM pg_catalog.jsonb_array_elements(COALESCE(auth.jwt() -> 'amr', '[]'::JSONB)) AS method
       WHERE method ->> 'method' = 'oauth'
    )
$$;

CREATE OR REPLACE FUNCTION public.get_auth_onboarding_state()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;

  IF NOT public.current_session_uses_google_oauth() THEN
    RETURN 'not_google';
  END IF;

  IF EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_user_id) THEN
    RETURN 'admin_blocked';
  END IF;

  IF public.has_current_legal_acceptance(v_user_id) THEN
    RETURN 'accepted';
  END IF;

  RETURN 'needs_acceptance';
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_current_legal_documents()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.current_session_uses_google_oauth() THEN
    RAISE EXCEPTION 'Google OAuth onboarding required.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_user_id) THEN
    RAISE EXCEPTION 'Google OAuth is unavailable for administrative accounts.' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.user_legal_acceptances (
    user_id, terms_version, privacy_version, accepted_at, acceptance_context
  ) VALUES (
    v_user_id, '2026-08', '2026-08', pg_catalog.now(), 'oauth_onboarding'
  )
  ON CONFLICT ON CONSTRAINT user_legal_acceptances_version_unique DO NOTHING;

  RETURN public.has_current_legal_acceptance(v_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.has_current_legal_acceptance(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.current_session_uses_google_oauth() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_auth_onboarding_state() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_current_legal_documents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_onboarding_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_current_legal_documents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_current_legal_acceptance(UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.block_admin_google_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.provider = 'google'
     AND EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = NEW.user_id)
  THEN
    RAISE EXCEPTION 'Google OAuth is unavailable for administrative accounts.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM auth.identities ai
      JOIN public.admin_users au ON au.user_id = ai.user_id
     WHERE ai.provider = 'google'
  ) THEN
    RAISE EXCEPTION 'Existing administrative Google identity requires manual review.';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS block_admin_google_identity_on_write ON auth.identities;
CREATE TRIGGER block_admin_google_identity_on_write
BEFORE INSERT OR UPDATE OF provider, user_id ON auth.identities
FOR EACH ROW
EXECUTE FUNCTION public.block_admin_google_identity();

REVOKE ALL ON FUNCTION public.block_admin_google_identity() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.assert_user_may_consume_smart_tokens(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM auth.identities ai
     WHERE ai.user_id = p_user_id AND ai.provider = 'google'
  ) AND NOT public.has_current_legal_acceptance(p_user_id) THEN
    RAISE EXCEPTION 'OAUTH_LEGAL_ACCEPTANCE_REQUIRED' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_oauth_legal_acceptance_on_credit_reservation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_user_may_consume_smart_tokens(NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_oauth_legal_acceptance_on_credit_reservation
  ON public.credit_reservations;
CREATE TRIGGER enforce_oauth_legal_acceptance_on_credit_reservation
BEFORE INSERT ON public.credit_reservations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_oauth_legal_acceptance_on_credit_reservation();

REVOKE ALL ON FUNCTION public.assert_user_may_consume_smart_tokens(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_oauth_legal_acceptance_on_credit_reservation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assert_user_may_consume_smart_tokens(UUID) TO service_role;

COMMENT ON FUNCTION public.accept_current_legal_documents() IS
  'Records the current server-owned Terms and Privacy versions for a non-admin Google OAuth onboarding session.';
COMMENT ON FUNCTION public.assert_user_may_consume_smart_tokens(UUID) IS
  'Central fail-closed gate: Google identities must accept current legal documents before creating a credit reservation.';
