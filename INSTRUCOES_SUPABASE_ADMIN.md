# 🔧 INSTRUÇÕES PARA CONFIGURAR ADMIN NO SUPABASE

## ✅ PROBLEMA 1: RECUPERAR ACESSO ADMIN

### Passo 1: Executar Migrations no Supabase Dashboard

Acesse o **Supabase Dashboard** → Seu Projeto → **SQL Editor** e execute os seguintes scripts **NA ORDEM**:

---

### **Migration 001: Schema Inicial**

```sql
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
```

---

### **Migration 002: Social Connections**

```sql
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
```

---

### **Migration 003: Plans Update**

```sql
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
```

---

### **Migration 004: Add Role Column**

```sql
-- Adicionar coluna role para controle de acesso administrativo
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));

-- Criar índice para melhorar performance de queries por role
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- Comentário explicativo
COMMENT ON COLUMN profiles.role IS 'Papel do usuário no sistema: user (padrão) ou admin (acesso administrativo completo)';
```

---

### Passo 2: Tornar seu usuário ADMIN

Execute este SQL no **SQL Editor** do Supabase:

```sql
-- Atualizar role do usuário para admin
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'riccieri68@gmail.com';

-- Verificar se funcionou
SELECT id, nome, email, role, created_at 
FROM profiles 
WHERE email = 'riccieri68@gmail.com';
```

**Resultado esperado:** Deve retornar seus dados com `role = 'admin'`

---

## ✅ PROBLEMA 2: VERIFICAÇÃO DE EMAIL OBRIGATÓRIA

### Configuração no Supabase Dashboard

1. Acesse **Supabase Dashboard** → Seu Projeto
2. Vá em **Authentication** → **Email Auth**
3. Ative as seguintes opções:
   - ✅ **Enable email confirmations** (Confirmar email antes de permitir login)
   - ✅ **Secure email change** (Requer confirmação para trocar email)
4. Clique em **Save**

### Verificar no Código

O código já está preparado para lidar com confirmação de email. Verifique se o backend está usando o Supabase Auth corretamente.

---

## ✅ PROBLEMA 3: CONFIRMAR GERAÇÃO DE CONTEÚDO

### Passo 1: Verificar ANTHROPIC_API_KEY no Railway

1. Acesse **Railway Dashboard** → https://railway.app/
2. Selecione seu projeto **SmartCorretorAI Backend**
3. Clique na aba **Variables**
4. Verifique se existe a variável:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
5. Se não existir, clique em **+ New Variable** e adicione:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** Sua chave da Anthropic (começa com `sk-ant-`)
6. Clique em **Add** e aguarde o redeploy automático

**Onde obter a chave:** https://console.anthropic.com/settings/keys

---

### Passo 2: Testar Localmente com Script Node.js

Criamos um script de teste que você pode executar localmente:

```bash
# No diretório do projeto
node test-claude-api.js
```

**O que o script faz:**
- Testa conexão com Claude 3.5 Sonnet
- Mostra tempo de resposta e uso de tokens
- Exibe mensagens de erro detalhadas se algo falhar

**Resultado esperado:**
```
✅ SUCESSO! API do Claude está funcionando!
📊 Detalhes da resposta:
   Modelo: claude-3-5-sonnet-20241022
   Tempo de resposta: 1.23s
   ...
💬 Resposta do Claude: "OK"
```

---

### Passo 3: Testar via CURL (Alternativa)

Se preferir testar via linha de comando:

```bash
curl -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: SUA_CHAVE_AQUI" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet-20241022",
    "max_tokens": 1024,
    "messages": [
      {"role": "user", "content": "Teste de conexão. Responda apenas: OK"}
    ]
  }'
```

**Substitua `SUA_CHAVE_AQUI`** pela sua ANTHROPIC_API_KEY real.

**Resposta esperada:**
```json
{
  "id": "msg_...",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "OK"
    }
  ],
  "model": "claude-3-5-sonnet-20241022",
  "usage": {
    "input_tokens": 15,
    "output_tokens": 5
  }
}
```

Se retornar este JSON, a API está funcionando perfeitamente! ✅

---

## 📋 CHECKLIST DE VERIFICAÇÃO

- [ ] Executei Migration 001 no SQL Editor
- [ ] Executei Migration 002 no SQL Editor
- [ ] Executei Migration 003 no SQL Editor
- [ ] Executei Migration 004 no SQL Editor
- [ ] Executei UPDATE para tornar meu usuário admin
- [ ] Verifiquei que meu usuário tem role='admin'
- [ ] Ativei "Enable email confirmations" no Supabase
- [ ] Verifiquei ANTHROPIC_API_KEY no Railway
- [ ] Testei chamada para Claude API

---

## 🆘 PROBLEMAS COMUNS

### "Tabela já existe"
Se aparecer erro dizendo que a tabela já existe, está tudo certo! O `IF NOT EXISTS` garante que não haverá duplicação.

### "Usuário não encontrado no UPDATE"
Certifique-se de que você já criou uma conta no sistema. Se não, crie primeiro e depois execute o UPDATE.

### "ANTHROPIC_API_KEY inválida"
Verifique se a chave começa com `sk-ant-` e está completa. Gere uma nova em: https://console.anthropic.com/

---

**Criado em:** 14/05/2026
**Versão:** 1.0
