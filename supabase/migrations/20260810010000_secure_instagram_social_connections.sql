-- Prepare the existing table for the legacy Facebook Login -> Instagram Graph API flow.
-- Tokens remain backend-only: authenticated/anonymous clients receive no table privileges.
ALTER TABLE public.social_connections
  ADD COLUMN IF NOT EXISTS page_id TEXT;

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuário vê suas conexões" ON public.social_connections;
DROP POLICY IF EXISTS "Usuario ve suas conexoes" ON public.social_connections;

REVOKE ALL ON TABLE public.social_connections FROM anon, authenticated;
GRANT ALL ON TABLE public.social_connections TO service_role;
