-- Publish the October 2026 legal documents without rewriting acceptance history.
-- Existing 2026-08 rows remain immutable evidence of the documents accepted then.

ALTER TABLE public.user_legal_acceptances
  DROP CONSTRAINT IF EXISTS user_legal_acceptances_acceptance_context_check;
ALTER TABLE public.user_legal_acceptances
  ADD CONSTRAINT user_legal_acceptances_acceptance_context_check
  CHECK (acceptance_context IN ('signup', 'oauth_onboarding', 'reauthentication'));

CREATE OR REPLACE FUNCTION public.record_signup_legal_acceptance()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_acceptance JSONB;
BEGIN
  v_acceptance := COALESCE(NEW.raw_user_meta_data, '{}'::JSONB) -> 'legal_acceptance';

  IF v_acceptance IS NULL THEN
    RETURN NEW;
  END IF;

  IF pg_catalog.jsonb_typeof(v_acceptance) <> 'object'
     OR v_acceptance ->> 'accepted' IS DISTINCT FROM 'true'
     OR v_acceptance ->> 'terms_version' IS DISTINCT FROM '2026-10'
     OR v_acceptance ->> 'privacy_version' IS DISTINCT FROM '2026-10'
     OR v_acceptance ->> 'context' IS DISTINCT FROM 'signup'
  THEN
    RAISE EXCEPTION 'Invalid legal acceptance declaration.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_legal_acceptances (
    user_id, terms_version, privacy_version, accepted_at, acceptance_context
  ) VALUES (
    NEW.id, '2026-10', '2026-10', pg_catalog.now(), 'signup'
  )
  ON CONFLICT (user_id, terms_version, privacy_version) DO NOTHING;

  RETURN NEW;
END;
$$;

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
       AND ula.terms_version = '2026-10'
       AND ula.privacy_version = '2026-10'
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
  v_acceptance_context TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.admin_users au WHERE au.user_id = v_user_id) THEN
    RAISE EXCEPTION 'Legal acceptance is unavailable for administrative accounts.' USING ERRCODE = '42501';
  END IF;
  v_acceptance_context := CASE
    WHEN public.current_session_uses_google_oauth() THEN 'oauth_onboarding'
    ELSE 'reauthentication'
  END;

  INSERT INTO public.user_legal_acceptances (
    user_id, terms_version, privacy_version, accepted_at, acceptance_context
  ) VALUES (
    v_user_id, '2026-10', '2026-10', pg_catalog.now(), v_acceptance_context
  )
  ON CONFLICT ON CONSTRAINT user_legal_acceptances_version_unique DO NOTHING;

  RETURN public.has_current_legal_acceptance(v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_user_may_consume_smart_tokens(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT public.has_current_legal_acceptance(p_user_id) THEN
    RAISE EXCEPTION 'CURRENT_LEGAL_ACCEPTANCE_REQUIRED' USING ERRCODE = '42501';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.record_signup_legal_acceptance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_current_legal_acceptance(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_auth_onboarding_state() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_current_legal_documents() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.assert_user_may_consume_smart_tokens(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_onboarding_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_current_legal_documents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_current_legal_acceptance(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_user_may_consume_smart_tokens(UUID) TO service_role;

COMMENT ON FUNCTION public.accept_current_legal_documents() IS
  'Records the current server-owned Terms and Privacy versions for a non-admin authenticated session.';
COMMENT ON FUNCTION public.assert_user_may_consume_smart_tokens(UUID) IS
  'Central fail-closed gate: users must accept current legal documents before creating a credit reservation.';
