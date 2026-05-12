-- Tabela para armazenar tokens OAuth das redes sociais
CREATE TABLE IF NOT EXISTS social_connections (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform          TEXT NOT NULL CHECK (platform IN ('instagram', 'facebook', 'linkedin', 'tiktok')),
  access_token      TEXT NOT NULL,
  page_access_token TEXT,
  page_id           TEXT,
  ig_user_id        TEXT,
  ig_username       TEXT,
  token_expires_at  TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, platform)
);

-- Índice para lookup rápido por usuário
CREATE INDEX IF NOT EXISTS social_connections_user_id_idx ON social_connections(user_id);

-- Coluna para registrar o ID do post publicado no Instagram
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS instagram_post_id TEXT;

-- RLS: cada usuário só vê suas próprias conexões
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuário vê suas conexões" ON social_connections
  FOR ALL USING (auth.uid() = user_id);

-- Trigger de updated_at
CREATE OR REPLACE FUNCTION update_social_connections_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_social_connections_updated_at
  BEFORE UPDATE ON social_connections
  FOR EACH ROW EXECUTE FUNCTION update_social_connections_updated_at();
