-- Publicacoes reais no Instagram: idempotencia e estado exclusivamente server-side.
CREATE TABLE IF NOT EXISTS public.instagram_publications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  idempotency_key UUID NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type = 'hero_generation'),
  source_id UUID NOT NULL REFERENCES public.hero_generations(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'publishing', 'published', 'failed')),
  instagram_container_id TEXT,
  instagram_post_id TEXT,
  error_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_instagram_publications_user_created
  ON public.instagram_publications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_instagram_publications_source
  ON public.instagram_publications(source_type, source_id);

DROP TRIGGER IF EXISTS update_instagram_publications_updated_at ON public.instagram_publications;
CREATE TRIGGER update_instagram_publications_updated_at
  BEFORE UPDATE ON public.instagram_publications
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.instagram_publications ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.instagram_publications FROM PUBLIC;
REVOKE ALL ON public.instagram_publications FROM anon;
REVOKE ALL ON public.instagram_publications FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_publications TO service_role;
