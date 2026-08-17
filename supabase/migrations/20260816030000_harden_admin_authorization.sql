-- SmartCorretorAI - P0 server-side administrative authorization.
--
-- public.admin_users is the only administrative authority. profiles.role and
-- Auth user_metadata are intentionally not consulted by any object below.

CREATE TABLE public.admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.admin_users IS
  'Fonte unica server-side de autorizacao administrativa do SmartCorretorAI.';

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.admin_users
  FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.admin_users TO service_role;

-- Presentation-only status for the currently authenticated user. The caller
-- cannot choose a user id and cannot enumerate administrators.
CREATE OR REPLACE FUNCTION public.is_authorized_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.admin_users AS admins
     WHERE admins.user_id = auth.uid()
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_authorized_admin()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_authorized_admin()
  TO authenticated, service_role;

-- profiles contains commercial and authorization-sensitive state. Browser
-- users retain only the columns used by account creation and Configuracoes.
-- RLS continues to enforce auth.uid() = id for row ownership.
REVOKE INSERT, UPDATE ON TABLE public.profiles
  FROM PUBLIC, anon, authenticated;

GRANT INSERT (
  id,
  nome,
  email,
  creci,
  estado,
  telefone,
  whatsapp,
  imobiliaria,
  avatar_url,
  logo_url
) ON public.profiles TO authenticated;

GRANT UPDATE (
  nome,
  email,
  creci,
  estado,
  telefone,
  whatsapp,
  imobiliaria,
  avatar_url,
  logo_url
) ON public.profiles TO authenticated;

GRANT ALL PRIVILEGES ON TABLE public.profiles TO service_role;

NOTIFY pgrst, 'reload schema';
