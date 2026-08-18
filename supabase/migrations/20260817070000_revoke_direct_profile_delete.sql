-- P0 forward-fix: browser roles must not delete profiles directly.
-- Existing SELECT, column-scoped INSERT/UPDATE, RLS, and service_role access stay unchanged.

REVOKE DELETE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF pg_catalog.has_table_privilege('anon', 'public.profiles', 'DELETE') THEN
    RAISE EXCEPTION 'anon ainda possui DELETE em public.profiles';
  END IF;

  IF pg_catalog.has_table_privilege('authenticated', 'public.profiles', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated ainda possui DELETE em public.profiles';
  END IF;

  IF NOT pg_catalog.has_table_privilege('service_role', 'public.profiles', 'DELETE') THEN
    RAISE EXCEPTION 'service_role perdeu DELETE em public.profiles';
  END IF;
END;
$$;
