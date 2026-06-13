-- =============================================
-- Hero IA: persistencia de geracoes
-- =============================================
-- Camada de persistencia apenas. A geracao real deve ocorrer em Edge Function
-- server-side, com ownership, storage privado e Smart Tokens controlados no backend.

CREATE TABLE IF NOT EXISTS public.hero_generations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'expired')),
  prompt_briefing JSONB NOT NULL DEFAULT '{}'::jsonb,
  deliverables JSONB NOT NULL DEFAULT '{}'::jsonb,
  texts JSONB NOT NULL DEFAULT '{}'::jsonb,
  image_storage_path TEXT,
  thumbnail_storage_path TEXT,
  credit_amount INTEGER NOT NULL DEFAULT 0 CHECK (credit_amount >= 0),
  credit_idempotency_key TEXT,
  credit_status TEXT,
  expires_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hero_generations_user_id
  ON public.hero_generations(user_id);

CREATE INDEX IF NOT EXISTS idx_hero_generations_property_id
  ON public.hero_generations(property_id);

CREATE INDEX IF NOT EXISTS idx_hero_generations_status
  ON public.hero_generations(status);

CREATE INDEX IF NOT EXISTS idx_hero_generations_expires_at
  ON public.hero_generations(expires_at)
  WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_hero_generations_created_at
  ON public.hero_generations(created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hero_generations_credit_idempotency_key
  ON public.hero_generations(user_id, credit_idempotency_key)
  WHERE credit_idempotency_key IS NOT NULL;

DROP TRIGGER IF EXISTS update_hero_generations_updated_at ON public.hero_generations;
CREATE TRIGGER update_hero_generations_updated_at
  BEFORE UPDATE ON public.hero_generations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.hero_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios veem suas geracoes hero ia" ON public.hero_generations;
CREATE POLICY "Usuarios veem suas geracoes hero ia"
  ON public.hero_generations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.hero_generations FROM PUBLIC;
GRANT SELECT ON public.hero_generations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hero_generations TO service_role;
