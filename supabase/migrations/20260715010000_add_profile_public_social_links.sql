-- Links públicos opcionais do Cadastro Profissional.
-- Não armazena credenciais, tokens ou conexões OAuth.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS facebook TEXT,
  ADD COLUMN IF NOT EXISTS linkedin TEXT;
