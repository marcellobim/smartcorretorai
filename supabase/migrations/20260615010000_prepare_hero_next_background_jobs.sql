-- =============================================
-- Hero IA Next: suporte a jobs assíncronos
-- =============================================
-- Permite campanhas experimentais sem imóvel salvo e guarda metadados
-- do job externo sem expor fornecedor no frontend.

ALTER TABLE public.hero_generations
  ALTER COLUMN property_id DROP NOT NULL;

ALTER TABLE public.hero_generations
  ADD COLUMN IF NOT EXISTS openai_response_id TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_model TEXT,
  ADD COLUMN IF NOT EXISTS destination JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_hero_generations_openai_response_id
  ON public.hero_generations(openai_response_id)
  WHERE openai_response_id IS NOT NULL;
