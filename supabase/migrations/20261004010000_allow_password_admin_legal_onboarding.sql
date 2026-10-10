-- Keep administrative authorization and MFA unchanged while allowing an
-- authenticated password session to complete the current legal onboarding.
-- Google-admin blocking belongs to the Google PKCE callback, where the
-- provider is known; this RPC is intentionally provider-agnostic.

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

REVOKE ALL ON FUNCTION public.get_auth_onboarding_state() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_current_legal_documents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_onboarding_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_current_legal_documents() TO authenticated;
