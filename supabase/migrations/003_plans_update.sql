-- Créditos avulsos que não expiram
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS creditos_avulsos INTEGER NOT NULL DEFAULT 0;

-- Hash do conteúdo do imóvel para cache de geração
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS content_hash TEXT;
CREATE INDEX IF NOT EXISTS campaigns_content_hash_idx ON campaigns(user_id, content_hash)
  WHERE status = 'concluido';

-- Enterprise: sub-usuários referenciam o dono da conta
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS enterprise_owner_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS profiles_enterprise_owner_idx ON profiles(enterprise_owner_id)
  WHERE enterprise_owner_id IS NOT NULL;
