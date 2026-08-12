-- Central temporaria de retirada de resultados finais.
-- Registros tecnicos de geracao continuam em suas tabelas de origem.

CREATE TABLE public.creations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_key TEXT NOT NULL
    CHECK (product_key IN (
      'video_imobiliario',
      'short_videos',
      'banner_imobiliario',
      'studio_comercial',
      'studio_video_criativo',
      'studio_carrossel',
      'virtual_staging',
      'vida_no_imovel',
      'apresentacao_corretor',
      'banners_rapidos',
      'campanha_textos'
    )),
  source_ref TEXT NOT NULL CHECK (btrim(source_ref) <> ''),
  title TEXT,
  delivery_kind TEXT NOT NULL
    CHECK (delivery_kind IN ('file', 'bundle', 'text')),
  result_manifest JSONB NOT NULL
    CHECK (jsonb_typeof(result_manifest) = 'object'),
  completed_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  downloaded_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT creations_user_product_source_key
    UNIQUE (user_id, product_key, source_ref)
);

CREATE INDEX idx_creations_user_completed_at
  ON public.creations(user_id, completed_at DESC);

CREATE INDEX idx_creations_expires_at
  ON public.creations(expires_at);

CREATE OR REPLACE FUNCTION public.set_creation_expires_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.expires_at := NEW.completed_at + INTERVAL '24 hours';
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_creation_expires_at
  BEFORE INSERT OR UPDATE OF completed_at, expires_at
  ON public.creations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_creation_expires_at();

ALTER TABLE public.creations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem suas criacoes disponiveis"
  ON public.creations
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    AND downloaded_at IS NULL
    AND deleted_at IS NULL
    AND expires_at > now()
  );

REVOKE ALL ON public.creations FROM PUBLIC;
REVOKE ALL ON public.creations FROM anon;
REVOKE ALL ON public.creations FROM authenticated;
GRANT SELECT ON public.creations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creations TO service_role;

