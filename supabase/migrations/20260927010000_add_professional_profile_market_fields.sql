-- Additive professional-profile fields for BR and US markets.
-- Existing profile columns remain the canonical storage for shared identity data.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS market TEXT NOT NULL DEFAULT 'BR',
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS creci_type TEXT,
  ADD COLUMN IF NOT EXISTS professional_role TEXT,
  ADD COLUMN IF NOT EXISTS license_number TEXT,
  ADD COLUMN IF NOT EXISTS sms TEXT,
  ADD COLUMN IF NOT EXISTS facebook TEXT,
  ADD COLUMN IF NOT EXISTS linkedin TEXT;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_professional_market_allowed_check CHECK (market IN ('BR', 'US')),
  ADD CONSTRAINT profiles_professional_creci_type_allowed_check CHECK (creci_type IS NULL OR creci_type IN ('F', 'J')),
  ADD CONSTRAINT profiles_professional_role_allowed_check CHECK (professional_role IS NULL OR professional_role IN ('Agent', 'Realtor', 'Broker'));

-- Keep RLS ownership unchanged. Extend only the existing browser column grants.
GRANT INSERT (market, display_name, creci_type, professional_role, license_number, sms, facebook, linkedin)
  ON TABLE public.profiles TO authenticated;
GRANT UPDATE (market, display_name, creci_type, professional_role, license_number, sms, facebook, linkedin, instagram)
  ON TABLE public.profiles TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.profiles TO service_role;

-- Populate a new profile from metadata once, without overwriting any profile
-- data on later identity activity. Google metadata normally supplies only name
-- and avatar; absent professional fields stay null/default.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name TEXT;
  v_avatar_url TEXT;
  v_display_name TEXT;
  v_phone TEXT;
  v_creci TEXT;
  v_creci_type TEXT;
  v_state TEXT;
  v_imobiliaria TEXT;
  v_whatsapp TEXT;
  v_market TEXT;
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
  v_display_name := NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'display_name'), '');
  v_phone := NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'telefone'), '');
  v_creci := NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'creci'), '');
  v_creci_type := CASE pg_catalog.upper(pg_catalog.btrim(COALESCE(NEW.raw_user_meta_data ->> 'creci_type', '')))
    WHEN 'F' THEN 'F'
    WHEN 'J' THEN 'J'
    ELSE NULL
  END;
  v_state := NULLIF(pg_catalog.upper(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'estado')), '');
  v_imobiliaria := NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'imobiliaria'), '');
  v_whatsapp := NULLIF(pg_catalog.btrim(NEW.raw_user_meta_data ->> 'whatsapp'), '');
  v_market := CASE pg_catalog.upper(pg_catalog.btrim(COALESCE(NEW.raw_user_meta_data ->> 'market', '')))
    WHEN 'US' THEN 'US'
    WHEN 'BR' THEN 'BR'
    ELSE 'BR'
  END;

  INSERT INTO public.profiles (
    id, email, full_name, nome, display_name, telefone, creci, creci_type, estado, imobiliaria, whatsapp,
    market, role, plano, avatar_url
  ) VALUES (
    NEW.id, NEW.email, v_name, v_name, v_display_name, v_phone, v_creci, v_creci_type, v_state, v_imobiliaria, v_whatsapp,
    v_market, 'user', 'starter', v_avatar_url
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';
