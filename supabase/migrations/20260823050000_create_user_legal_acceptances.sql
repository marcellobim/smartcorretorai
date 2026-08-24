-- Immutable client-facing evidence of legal document acceptance at signup.
-- The published versions are validated here and accepted_at is always server-side.

CREATE TABLE public.user_legal_acceptances (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version TEXT NOT NULL CHECK (char_length(terms_version) BETWEEN 1 AND 64),
  privacy_version TEXT NOT NULL CHECK (char_length(privacy_version) BETWEEN 1 AND 64),
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  acceptance_context TEXT NOT NULL CHECK (acceptance_context IN ('signup')),
  CONSTRAINT user_legal_acceptances_version_unique
    UNIQUE (user_id, terms_version, privacy_version)
);

CREATE INDEX user_legal_acceptances_user_history_idx
  ON public.user_legal_acceptances (user_id, accepted_at DESC);

ALTER TABLE public.user_legal_acceptances ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.user_legal_acceptances FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_legal_acceptances TO authenticated;

CREATE POLICY user_legal_acceptances_select_own
  ON public.user_legal_acceptances
  FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- Close the frontend/database rollout window without asserting acceptance for
-- legacy users: only an exact declaration already stored by Auth is eligible.
-- auth.users.created_at is a server-side timestamp for that signup transaction.
INSERT INTO public.user_legal_acceptances (
  user_id,
  terms_version,
  privacy_version,
  accepted_at,
  acceptance_context
)
SELECT
  u.id,
  '2026-08',
  '2026-08',
  u.created_at,
  'signup'
FROM auth.users u
WHERE pg_catalog.jsonb_typeof(COALESCE(u.raw_user_meta_data, '{}'::JSONB) -> 'legal_acceptance') = 'object'
  AND u.raw_user_meta_data -> 'legal_acceptance' ->> 'accepted' = 'true'
  AND u.raw_user_meta_data -> 'legal_acceptance' ->> 'terms_version' = '2026-08'
  AND u.raw_user_meta_data -> 'legal_acceptance' ->> 'privacy_version' = '2026-08'
  AND u.raw_user_meta_data -> 'legal_acceptance' ->> 'context' = 'signup'
ON CONFLICT (user_id, terms_version, privacy_version) DO NOTHING;

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

  -- Accounts created outside the public signup flow are not assigned fabricated evidence.
  IF v_acceptance IS NULL THEN
    RETURN NEW;
  END IF;

  IF pg_catalog.jsonb_typeof(v_acceptance) <> 'object'
     OR v_acceptance ->> 'accepted' IS DISTINCT FROM 'true'
     OR v_acceptance ->> 'terms_version' IS DISTINCT FROM '2026-08'
     OR v_acceptance ->> 'privacy_version' IS DISTINCT FROM '2026-08'
     OR v_acceptance ->> 'context' IS DISTINCT FROM 'signup'
  THEN
    RAISE EXCEPTION 'Invalid legal acceptance declaration.' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_legal_acceptances (
    user_id,
    terms_version,
    privacy_version,
    accepted_at,
    acceptance_context
  ) VALUES (
    NEW.id,
    '2026-08',
    '2026-08',
    pg_catalog.now(),
    'signup'
  )
  ON CONFLICT (user_id, terms_version, privacy_version) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_signup_legal_acceptance_on_insert ON auth.users;
CREATE TRIGGER record_signup_legal_acceptance_on_insert
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.record_signup_legal_acceptance();

REVOKE ALL ON FUNCTION public.record_signup_legal_acceptance() FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.user_legal_acceptances IS
  'Append-only history of Terms and Privacy acceptances recorded by trusted backend flows.';
COMMENT ON COLUMN public.user_legal_acceptances.accepted_at IS
  'Database server time; never accepted from client metadata.';
