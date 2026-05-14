-- Adicionar coluna role para controle de acesso administrativo
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Criar índice para melhorar performance de queries por role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Comentário explicativo
COMMENT ON COLUMN profiles.role IS 'Papel do usuário no sistema: user (padrão) ou admin (acesso administrativo completo)';
