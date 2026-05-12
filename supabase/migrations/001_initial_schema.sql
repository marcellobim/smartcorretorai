-- =============================================
-- SmartCorretorAI - Schema inicial
-- =============================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================
-- TABELA: profiles (dados dos corretores)
-- =============================================
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  senha_hash  TEXT NOT NULL,
  creci       TEXT,
  estado      CHAR(2),
  telefone    TEXT,
  plano       TEXT NOT NULL DEFAULT 'starter' CHECK (plano IN ('starter', 'pro', 'enterprise')),
  stripe_customer_id TEXT,
  trial_ends_at TIMESTAMPTZ,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_profiles_email ON profiles(email);

-- =============================================
-- TABELA: properties (imóveis)
-- =============================================
CREATE TABLE IF NOT EXISTS properties (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  tipo        TEXT NOT NULL,
  finalidade  TEXT NOT NULL CHECK (finalidade IN ('Venda', 'Locação', 'Temporada')),
  preco       DECIMAL(15, 2) NOT NULL,
  area        DECIMAL(10, 2),
  quartos     INT DEFAULT 0,
  banheiros   INT DEFAULT 0,
  vagas       INT DEFAULT 0,
  bairro      TEXT NOT NULL,
  cidade      TEXT NOT NULL,
  estado      CHAR(2) NOT NULL,
  cep         TEXT,
  endereco    TEXT,
  descricao   TEXT,
  fotos       TEXT[] DEFAULT '{}',
  destaque    BOOLEAN DEFAULT FALSE,
  ativo       BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_properties_user_id ON properties(user_id);
CREATE INDEX idx_properties_finalidade ON properties(finalidade);
CREATE INDEX idx_properties_cidade ON properties(cidade);

-- =============================================
-- TABELA: campaigns (campanhas de marketing)
-- =============================================
CREATE TABLE IF NOT EXISTS campaigns (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titulo          TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'gerando' CHECK (status IN ('gerando', 'concluido', 'erro')),
  dados_imovel    JSONB NOT NULL DEFAULT '{}',
  redes_sociais   TEXT[] NOT NULL DEFAULT '{}',
  textos_gerados  JSONB DEFAULT '{}',
  preview_url     TEXT,
  download_url    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_campaigns_user_id ON campaigns(user_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_created_at ON campaigns(created_at DESC);

-- =============================================
-- TABELA: subscriptions (assinaturas)
-- =============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id                 TEXT NOT NULL,
  stripe_subscription_id  TEXT UNIQUE,
  status                  TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'cancelado', 'pausado')),
  current_period_start    TIMESTAMPTZ,
  current_period_end      TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

-- =============================================
-- TABELA: password_resets
-- =============================================
CREATE TABLE IF NOT EXISTS password_resets (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- FUNÇÃO: atualizar updated_at automaticamente
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_profiles_updated_at    BEFORE UPDATE ON profiles    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_properties_updated_at  BEFORE UPDATE ON properties  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at   BEFORE UPDATE ON campaigns   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties  ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns   ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Políticas (service_role ignora RLS, usado pelo backend)
CREATE POLICY "Usuários veem apenas seu perfil"
  ON profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "Usuários gerenciam seus imóveis"
  ON properties FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Usuários veem suas campanhas"
  ON campaigns FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Usuários veem suas assinaturas"
  ON subscriptions FOR ALL USING (auth.uid() = user_id);
