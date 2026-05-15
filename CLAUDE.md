# 📋 SmartCorretor AI — Contexto Completo para Claude.ai

> **Cole este arquivo no início de cada nova conversa com Claude para contexto completo**

**Última atualização:** 2026-05-14 19:26  
**Versão:** 3.0

---

## 📖 O PRODUTO

### O Que É
**SmartCorretor AI** é um SaaS imobiliário premium que automatiza 100% da criação de conteúdo de marketing para corretores de imóveis.

### Proposta de Valor
- **Input:** Corretor envia fotos + dados básicos do imóvel
- **Output:** Pacote completo de marketing pronto para publicar em todas as plataformas
- **Diferencial:** Zero edição manual, zero configuração por imóvel, tudo automático via IA

---

## 🏗️ INFRAESTRUTURA

### Stack Tecnológica

**Frontend:**
- React 18.2.0 + Vite 5.0.11
- Tailwind CSS 3.4.1
- React Router DOM 6.21.3
- Zustand 4.4.7 (state management)
- Axios 1.6.5 + React Hot Toast 2.4.1

**Backend:**
- Node.js 20+ + Express 4.18.2
- JWT (jsonwebtoken 9.0.2) + bcryptjs 2.4.3
- Multer 1.4.5 (upload) + Sharp 0.33.2 (imagens)
- WebSockets (ws 8.18.0)

**Integrações:**
- **IA de Texto:** Anthropic Claude 3.5 Sonnet (@anthropic-ai/sdk 0.39.0)
- **Vídeos/Banners:** Creatomate API
- **Banco de Dados:** Supabase (PostgreSQL 15)
- **Pagamentos:** Stripe 14.15.0
- **Redes Sociais:** Meta Graph API v19.0 (Instagram)

**Hospedagem:**
- Frontend: Vercel (https://smartcorretorai.vercel.app)
- Backend: Railway (https://smartcorretorai-production.up.railway.app)
- Domínio: smartcorretorai.com.br (GoDaddy → Vercel)
- Repositório: github.com/marcellobim/smartcorretorai

### Variáveis de Ambiente Críticas

**Backend (.env no Railway):**
```bash
# Supabase
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# JWT
JWT_SECRET=sua-chave-secreta-muito-segura-aqui-min-32-chars
JWT_EXPIRES_IN=7d

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-api03-...
# Modelo usado: claude-3-5-sonnet-20241022

# Stripe
STRIPE_SECRET_KEY=sk_live_51TVKsNDETDGav5vy...
STRIPE_PUBLISHABLE_KEY=pk_live_51TVKsNDETDGav5vy...
STRIPE_WEBHOOK_SECRET=whsec_...
LAUNCH_MODE=true  # Preços promocionais

# Planos (3 meses promo + mensal cheio)
STRIPE_PRICE_START_PROMO=price_...
STRIPE_PRICE_START_MENSAL=price_...
STRIPE_PRICE_PRO_PROMO=price_...
STRIPE_PRICE_PRO_MENSAL=price_...
STRIPE_PRICE_IMOBILIARIA_PROMO=price_...
STRIPE_PRICE_IMOBILIARIA_MENSAL=price_...

# Pacotes avulsos
STRIPE_PRICE_AVULSO5_PROMO=price_...
STRIPE_PRICE_AVULSO5=price_...
STRIPE_PRICE_AVULSO10_PROMO=price_...
STRIPE_PRICE_AVULSO10=price_...

# Meta / Instagram
META_APP_ID=1166177798972049
META_APP_SECRET=sua-chave-secreta-meta
META_REDIRECT_URI=https://smartcorretorai-production.up.railway.app/api/social/instagram/callback

# Creatomate
CREATOMATE_API_KEY=sua-api-key-creatomate
CREATOMATE_PUBLIC_TOKEN=seu-public-token-creatomate

# Outros
FRONTEND_URL=https://smartcorretorai.vercel.app
STORAGE_BUCKET=smartcorretor-assets
```

**Frontend (.env):**
```bash
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=https://smartcorretorai-production.up.railway.app/api
```

---

## 🎯 O QUE ENTREGA

### 🎬 Vídeos
- **Formatos:** 9:16 (Reels/Stories/TikTok), 16:9 (YouTube/LinkedIn), 1:1 e 4:5 (Feed)
- **Recursos:** Narração voz over automática + trilha sonora adaptada por categoria
- **Quantidade:** 4-6 vídeos por campanha (dependendo do plano)

### 🖼️ Banners
- **Plataformas:** Meta Ads, Google Ads, TikTok, LinkedIn, Portais Imobiliários, WhatsApp
- **Formatos:** Múltiplos tamanhos otimizados por plataforma
- **CTA:** Banners clicáveis com redirecionamento para WhatsApp do corretor

### ✍️ Textos
- **Copy para redes sociais:** Instagram, Facebook, LinkedIn, TikTok
- **Descrições:** Técnica + emocional para portais imobiliários
- **Extras:** Hashtags estratégicas, títulos para Google Ads, mensagens WhatsApp

---

## 🤖 DIRETRIZES DA IA

### Categorização Inteligente
Identifica automaticamente a categoria do imóvel:
- Luxo / Alto Padrão
- Investimento / Lançamento
- Padrão Médio
- MCMV / Popular
- Comercial

### Personalização por Categoria
- Tom de voz adaptado (sofisticado para luxo, acessível para MCMV)
- Trilha sonora específica por categoria
- Templates visuais alinhados ao público-alvo

### Criatividade e Variação
- Nunca repete padrões ou textos
- Explora características do bairro e lifestyle
- Insere imagens extras de lifestyle além das fotos do corretor
- Destaca diferenciais únicos de cada imóvel

### Público-Alvo
- Adultos em decisão de compra séria
- Abordagem sempre premium, independente da categoria
- Foco em benefícios e transformação de vida

---

## ✅ JÁ FEITO

### Autenticação e Usuários
- ✅ Sistema completo de autenticação JWT
- ✅ Login, registro, logout
- ✅ Recuperação de senha via email
- ✅ Middleware de autenticação com logging detalhado
- ✅ Logout automático em caso de token inválido (correção 2026-05-14)
- ✅ Refresh automático de token
- ✅ Role-based access control (user/admin)

### Geração de Conteúdo
- ✅ **Geração de Textos com Claude 3.5 Sonnet**
  - Modelo: claude-3-5-sonnet-20241022 (corrigido 2026-05-14)
  - Categorização automática de imóveis
  - Textos para todas as redes sociais
  - Descrições técnicas e emocionais
  - Hashtags e CTAs
  - Tratamento robusto de erros JSON (melhorado 2026-05-14)

- ✅ **Geração de Vídeos/Banners com Creatomate**
  - 46 templates mapeados
  - 22 templates ativos (5 famílias SC_ + 17 stock)
  - Seleção automática por categoria
  - Renders assíncronos com polling
  - Download de arquivos finais

### Integração Instagram
- ✅ **OAuth completo com Meta Graph API v19.0**
  - Autenticação via Facebook Login
  - Tokens long-lived (60 dias)
  - Publicação de imagens
  - Publicação de vídeos e reels
  - Suporte a 9:16 (Reels), 1:1 (Feed)
  - Documentação completa em META_INSTAGRAM_SETUP.md

### Pagamentos
- ✅ **Stripe Checkout e Webhooks**
  - 5 produtos configurados (3 planos + 2 avulsos)
  - Modo promo (LAUNCH_MODE)
  - Webhooks para atualização automática de planos
  - Gestão de assinaturas
  - Chaves Live configuradas (sk_live_ e pk_live_)

### Painel Administrativo
- ✅ **Dashboard completo para fundador**
  - Estatísticas gerais (usuários, campanhas, receita)
  - Gerenciamento de usuários (busca, filtros, edição)
  - Gerenciamento de campanhas
  - Receita e métricas (MRR, receita por plano)
  - Adicionar/remover créditos manualmente
  - Alterar role (user ↔ admin)
  - Deletar usuários
  - Documentação em PAINEL_ADMIN_DOCUMENTACAO.md

### Infraestrutura
- ✅ **Deploy Automático**
  - Frontend: Vercel (GitHub main branch)
  - Backend: Railway (GitHub main branch)
  - CI/CD configurado

- ✅ **Banco de Dados Supabase**
  - Tabelas: profiles, properties, campaigns, subscriptions, password_resets, social_connections
  - Migrations criadas (001 a 004)
  - Storage bucket: smartcorretor-assets

### CRUD Completo
- ✅ CRUD de Imóveis (criar, listar, editar, deletar)
- ✅ CRUD de Campanhas
- ✅ Upload de múltiplas fotos para Supabase Storage
- ✅ URLs públicas geradas automaticamente

---

## 🚀 PRÓXIMO (Prioridade Máxima)

### 🔥 Bloqueadores Críticos

1. **Executar Migrações no Supabase**
   - Acessar Supabase Dashboard → SQL Editor
   - Executar arquivos em ordem:
     - 001_initial_schema.sql
     - 002_social_connections.sql
     - 003_plans_update.sql
     - 004_add_role_column.sql
   - Finalizar com: `NOTIFY pgrst, 'reload schema'`
   - **Nota:** Usar `DROP TRIGGER/POLICY IF EXISTS` (Postgres 15 não suporta `CREATE ... IF NOT EXISTS` para triggers/policies)

2. **Adicionar Variáveis de Ambiente no Railway**
   - Acessar Railway Dashboard → Variables → Raw Editor
   - Adicionar variáveis faltantes:
     ```
     CREATOMATE_API_KEY=sua-api-key
     CREATOMATE_PUBLIC_TOKEN=seu-token
     STRIPE_PRICE_START_PROMO=price_...
     STRIPE_PRICE_PRO_PROMO=price_...
     STRIPE_PRICE_IMOBILIARIA_PROMO=price_...
     STRIPE_PRICE_AVULSO5_PROMO=price_...
     STRIPE_PRICE_AVULSO10_PROMO=price_...
     ```

3. **Testar Fluxo End-to-End**
   - Cadastro → Login → Criar campanha → Gerar textos → Gerar renders
   - Verificar logs no Railway para erros
   - Testar pagamento Stripe checkout

### 🟡 Alta Prioridade

4. **Solicitar Permissões no Meta for Developers**
   - Acessar Meta for Developers → App → Permissões
   - Solicitar acesso avançado para:
     - instagram_basic
     - instagram_content_publish
     - pages_show_list
     - pages_read_engagement
   - Aguardar aprovação (1-3 dias úteis)
   - Colocar app em modo "Ativo" (produção)

5. **Criar Primeiro Usuário Admin**
   - Executar no Supabase SQL Editor:
     ```sql
     UPDATE profiles 
     SET role = 'admin' 
     WHERE email = 'seu-email@exemplo.com';
     ```

6. **Configurar Webhook do Stripe (Modo Live)**
   - Acessar Stripe Dashboard → Webhooks
   - Criar endpoint: `https://smartcorretorai-production.up.railway.app/api/subscriptions/webhook`
   - Selecionar eventos: checkout.session.completed, payment_intent.succeeded, etc.
   - Copiar Signing Secret
   - Adicionar no Railway: `STRIPE_WEBHOOK_SECRET=whsec_...`

---

## 📅 DEPOIS (Melhorias Futuras)

### Funcionalidades Não Implementadas

- ❌ **Renovação Automática de Tokens Instagram**
  - Cronjob para renovar tokens antes de expirar (60 dias)
  - Notificar usuário se renovação falhar

- ❌ **Agendamento de Posts**
  - Permitir agendar publicações para data/hora específica
  - Sistema de filas (Bull/BullMQ)

- ❌ **Carrossel de Imagens no Instagram**
  - Suporte para posts com múltiplas imagens
  - Endpoint: media_type=CAROUSEL

- ❌ **Stories no Instagram**
  - Publicação de Stories (24h)
  - Endpoint: media_type=STORIES

- ❌ **Analytics de Posts**
  - Buscar métricas de posts publicados
  - Dashboard com insights: alcance, engajamento, salvamentos

- ❌ **Compliance CRECI**
  - Validação de CRECI no cadastro
  - Verificação de regularidade

- ❌ **Dashboard de Métricas Avançado**
  - Gráficos de receita e crescimento
  - Análise de churn e retenção
  - Exportação de relatórios (CSV/PDF)

- ❌ **Vídeo Explainer na Home**
  - Vídeo de apresentação do produto
  - Roteiro criado, mas vídeo não produzido

---

## 🎯 DECISÕES TOMADAS

### Arquitetura
- **Monorepo** (frontend + backend no mesmo repo) - Facilita sincronização
- **REST** em vez de GraphQL - Simplicidade, não precisamos de queries complexas
- **SQL** (PostgreSQL) em vez de NoSQL - Dados relacionais, queries complexas, transações ACID
- **Async com polling** para geração de conteúdo - Vídeos demoram 30-60s, não pode bloquear HTTP

### Stack
- **React + Vite** - Build rápido, HMR instantâneo, melhor DX que CRA
- **Tailwind CSS** - Produtividade 3x, design system embutido, bundle mínimo
- **Zustand** em vez de Redux - API minimalista, 1KB vs 10KB+, sem boilerplate
- **Node.js + Express** - Stack JavaScript full-stack, ecossistema NPM
- **Supabase** em vez de Firebase - PostgreSQL robusto, open source, pricing melhor
- **Claude** em vez de GPT-4 - Textos mais naturais, 200K tokens, mais barato, 85% aprovação vs 72%
- **Creatomate** em vez de FFMPEG - API REST simples, templates prontos, zero manutenção
- **Railway** em vez de Heroku - Pay-per-use, infraestrutura moderna, Heroku descontinuou free tier
- **Vercel** para frontend - Especializado em React/Vite, edge network, deploy automático
- **JWT** em vez de Sessions - Stateless, escalável, mobile-friendly
- **Stripe** - Líder de mercado, melhor documentação, webhooks robustos, suporte internacional

### Segurança
- JWT com expiração de 7 dias
- Middleware de autenticação em todas as rotas protegidas
- Role-based access control (user/admin)
- Logout automático em caso de token inválido
- Validação de dados com Express Validator
- Rate limiting com Express Rate Limit
- CORS configurado
- Helmet para headers de segurança

---

## 📁 ESTRUTURA DE PASTAS

```
smartcorretorai/
│
├── frontend/                          # React + Vite + Tailwind
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/               # Sidebar, Header, AppLayout
│   │   │   ├── marketing/            # PropertyCard, CampaignCard
│   │   │   └── ui/                   # Button, Input, Modal, Card, Badge
│   │   ├── hooks/                    # useAuth, useProperties, useCampaigns
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx       # Home pública
│   │   │   ├── LoginPage.jsx         # Login
│   │   │   ├── RegisterPage.jsx      # Cadastro
│   │   │   ├── Dashboard.jsx         # Dashboard principal
│   │   │   ├── NovaCampanha.jsx      # Criar campanha
│   │   │   ├── MeusImoveis.jsx       # Gerenciar imóveis
│   │   │   ├── PacotesGerados.jsx    # Histórico de campanhas
│   │   │   ├── Configuracoes.jsx     # Configurações + Instagram OAuth
│   │   │   ├── Planos.jsx            # Página de planos
│   │   │   ├── AdminDashboard.jsx    # Painel administrativo
│   │   │   ├── TermosDeUso.jsx       # Termos de uso
│   │   │   └── Privacidade.jsx       # Política de privacidade
│   │   ├── services/
│   │   │   ├── api.js                # Axios instance + interceptors
│   │   │   ├── auth.js               # Funções de autenticação
│   │   │   └── supabase.js           # Cliente Supabase
│   │   ├── store/
│   │   │   └── authStore.js          # Zustand store (autenticação)
│   │   ├── App.jsx                   # Rotas principais
│   │   └── main.jsx                  # Entry point
│   └── package.json
│
├── backend/                           # Node.js + Express
│   ├── src/
│   │   ├── controllers/
│   │   │   ├── authController.js     # Login, registro, recuperação senha
│   │   │   ├── userController.js     # Perfil do usuário
│   │   │   ├── propertyController.js # CRUD de imóveis
│   │   │   ├── campaignController.js # CRUD de campanhas
│   │   │   ├── generateController.js # Geração de textos (Claude)
│   │   │   ├── renderController.js   # Geração de vídeos/banners (Creatomate)
│   │   │   ├── socialController.js   # Instagram OAuth + publicação
│   │   │   ├── subscriptionController.js # Stripe checkout + webhooks
│   │   │   └── adminController.js    # Painel administrativo
│   │   ├── middleware/
│   │   │   ├── auth.js               # Verificação JWT
│   │   │   ├── adminMiddleware.js    # Verificação role admin
│   │   │   └── errorHandler.js       # Tratamento global de erros
│   │   ├── routes/
│   │   │   ├── auth.js               # /api/auth/*
│   │   │   ├── users.js              # /api/users/*
│   │   │   ├── properties.js         # /api/properties/*
│   │   │   ├── campaigns.js          # /api/campaigns/*
│   │   │   ├── generate.js           # /api/generate/*
│   │   │   ├── render.js             # /api/render/*
│   │   │   ├── social.js             # /api/social/*
│   │   │   ├── subscriptions.js      # /api/subscriptions/*
│   │   │   └── admin.js              # /api/admin/*
│   │   ├── services/
│   │   │   ├── supabase.js           # Cliente Supabase
│   │   │   ├── claude.js             # Cliente Anthropic Claude
│   │   │   ├── creatomate.js         # Cliente Creatomate + mapeamento templates
│   │   │   ├── instagramService.js   # Meta Graph API (Instagram)
│   │   │   ├── emailService.js       # Nodemailer
│   │   │   └── cache.js              # Cache em memória
│   │   ├── app.js                    # Configuração Express
│   │   └── server.js                 # Entry point
│   └── package.json
│
├── supabase/                          # Migrações do banco de dados
│   ├── migrations/
│   │   ├── 001_initial_schema.sql    # Schema inicial
│   │   ├── 002_social_connections.sql # Tabela OAuth Instagram
│   │   ├── 003_plans_update.sql      # Atualização de planos
│   │   └── 004_add_role_column.sql   # Coluna role (user/admin)
│   └── seed.sql
│
├── CLAUDE.md                          # 📄 ESTE ARQUIVO
├── README.md
├── vercel.json
│
└── Documentação Adicional/
    ├── META_INSTAGRAM_SETUP.md        # Setup completo Instagram API
    ├── INTEGRACAO_INSTAGRAM_RESUMO.md # Resumo técnico Instagram
    ├── PAINEL_ADMIN_DOCUMENTACAO.md   # Documentação painel admin
    ├── INSTRUCOES_RAILWAY_STRIPE.md   # Configuração Stripe no Railway
    ├── CORRECOES_LOGIN_APLICADAS.md   # Histórico de correções de login
    ├── CORRECOES_APLICADAS.md         # Histórico de correções gerais
    └── ANALISE_ERRO.md                # Análise de erros específicos
```

---

## 🔄 FLUXO DO USUÁRIO

### 1. Cadastro e Login
```
Usuário acessa Landing Page → Cadastro → Backend cria profile (plano: starter, trial: 7 dias) → Redirecionado para /dashboard
```

### 2. Criação de Campanha
```
Nova Campanha → Preenche dados do imóvel + upload fotos → Gerar Textos → Claude analisa e categoriza → Gera textos para todas as redes → Gerar Banners e Vídeos → Creatomate dispara renders assíncronos → Frontend faz polling (6s) → Exibe thumbnails e permite download
```

### 3. Publicação no Instagram
```
Configurações → Conectar Instagram → OAuth Facebook → Backend troca code por token → Busca Páginas e Instagram Business → Salva tokens → Em Pacotes Gerados → Publicar no Instagram → Backend envia mídia via Graph API → Retorna ID do post
```

### 4. Gerenciamento de Planos
```
Planos → Escolhe plano → Backend cria Stripe Checkout Session → Usuário paga no Stripe → Stripe envia webhook → Backend atualiza plano e cria subscription → Usuário redirecionado para /dashboard
```

### 5. Painel Administrativo
```
Admin faz login → Acessa /admin → Visualiza estatísticas, usuários, campanhas, receita → Pode editar plano, adicionar créditos, alterar role, deletar usuário
```

---

## 🐛 ERROS COMUNS E SOLUÇÕES

### "Usuário não encontrado" no Login
- **Causa:** Token JWT antigo com userId inválido
- **Solução:** Alterar JWT_SECRET no Railway (invalida todos os tokens)

### "Nenhuma Página do Facebook encontrada" (Instagram)
- **Causa:** Usuário não tem Página do Facebook vinculada ao Instagram
- **Solução:** Criar Página no Facebook e vincular ao Instagram

### "Meta API: (#100) Invalid OAuth 2.0 Access Token"
- **Causa:** Token Instagram expirado (60 dias)
- **Solução:** Usuário precisa reconectar (desconectar e conectar novamente)

### "Timeout ao processar vídeo" (Instagram)
- **Causa:** Vídeo muito grande ou processamento lento
- **Solução:** Reduzir tamanho/duração ou tentar novamente

### "Render failed" (Creatomate)
- **Causa:** Template ID inválido ou dados faltando
- **Solução:** Verificar logs do backend, conferir mapeamento de templates

### "Stripe webhook signature verification failed"
- **Causa:** STRIPE_WEBHOOK_SECRET incorreto
- **Solução:** Copiar novo secret do Stripe Dashboard e atualizar no Railway

### "Erro ao gerar textos" / Status vira 'erro'
- **Causa:** Modelo Claude inválido ou ANTHROPIC_API_KEY não configurada
- **Solução:** Verificar variáveis de ambiente no Railway, conferir logs detalhados

---

## 📝 HISTÓRICO DE ATUALIZAÇÕES

### 2026-05-14 19:26 (v3.0 - Esta Versão)
- ✅ Reestruturação completa do CLAUDE.md para formato mais limpo e objetivo
- ✅ Seções reorganizadas: O Produto, Infraestrutura, O Que Entrega, Diretrizes da IA, Já Feito, Próximo, Depois, Decisões Tomadas
- ✅ Consolidação de todas as funcionalidades implementadas
- ✅ Integração de informações dos arquivos de documentação auxiliares
- ✅ Remoção de redundâncias e informações obsoletas
- ✅ Foco em contexto prático e acionável

### 2026-05-14 (Sessões Anteriores)
- ✅ Integração Instagram completa (OAuth + publicação de vídeos/reels)
- ✅ Painel administrativo completo com role-based access control
- ✅ Correções críticas no modelo Claude (claude-3-5-sonnet-20241022)
- ✅ Melhorias no tratamento de erros e logging
- ✅ Logout automático em caso de token inválido
- ✅ Configuração Stripe Live (sk_live_ e pk_live_)

### 2026-05-12
- ✅ Painel administrativo implementado
- ✅ Migration 004_add_role_column.sql criada

### 2026-05-08
- ✅ Integração Creatomate completa (46 templates, 22 ativos)

### 2026-05-05
- ✅ Stripe configurado (5 produtos, checkout, webhooks)

### 2026-05-01
- ✅ Geração de textos com Claude implementada

### 2026-04-28
- ✅ Deploy inicial no Railway e Vercel

---

## 📞 SUPORTE

### Logs e Debugging

**Backend (Railway):**
Railway Dashboard → Deployments → View Logs → Procurar por erros (linhas vermelhas)

**Frontend (Vercel):**
Vercel Dashboard → Deployments → Clicar no deployment → Aba "Logs"

**Local:**
- Backend: Terminal onde rodou `npm run dev`
- Frontend: Console do navegador (F12)

---

**🎉 SmartCorretor AI — Automatizando o marketing imobiliário com Inteligência Artificial**
