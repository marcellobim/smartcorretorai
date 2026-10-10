-- A US licence state is independent from profiles.estado, which remains the
-- Brazilian CRECI UF.  This migration is intentionally additive: the earlier
-- profile migration may already be applied in production.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS license_state TEXT;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_license_state_us_postal_check') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_license_state_us_postal_check CHECK (
        license_state IS NULL OR license_state IN (
          'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
        )
      );
  END IF;
END $$;

GRANT INSERT (license_state) ON TABLE public.profiles TO authenticated;
GRANT UPDATE (license_state) ON TABLE public.profiles TO authenticated;
NOTIFY pgrst, 'reload schema';
