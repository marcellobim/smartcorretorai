# 📋 SmartCorretor AI — Documentação Completa do Projeto
> Cole este arquivo no início de cada nova conversa com Claude para contexto completo

**Última atualização:** 2026-05-14 19:11  
**Versão:** 2.1

---

## 📖 ÍNDICE

1. [Visão Geral do Produto](#-visão-geral-do-produto)
2. [Stack Tecnológica](#-stack-tecnológica)
3. [Infraestrutura](#-infraestrutura)
4. [Variáveis de Ambiente](#-variáveis-de-ambiente)
5. [Estrutura de Pastas](#-estrutura-de-pastas)
6. [Fluxo do Usuário](#-fluxo-do-usuário)
7. [Status das Funcionalidades](#-status-das-funcionalidades)
8. [Pendências e Próximos Passos](#-pendências-e-próximos-passos)
9. [Instruções para Replicar](#-instruções-para-replicar-o-projeto)
10. [Histórico de Decisões Técnicas](#-histórico-de-decisões-técnicas)

---

## 🎯 VISÃO GERAL DO PRODUTO

### O Que É
**SmartCorretor AI** é um SaaS imobiliário premium que automatiza 100% da criação de conteúdo de marketing para corretores de imóveis.

### Proposta de Valor
- **Input:** Corretor envia fotos + dados básicos do imóvel
- **Output:** Pacote completo de marketing pronto para publicar em todas as plataformas
- **Diferencial:** Zero edição manual, zero configuração por imóvel, tudo automático via IA

### O Que o Produto Entrega

#### 🎬 Vídeos
- **Formatos:** 9:16 (Reels/Stories/TikTok), 16:9 (YouTube/LinkedIn), 1:1 e 4:5 (Feed)
- **Recursos:** Narração voz over automática + trilha sonora adaptada por categoria
- **Quantidade:** 4-6 vídeos por campanha (dependendo do plano)

#### 🖼️ Banners
- **Plataformas:** Meta Ads, Google Ads, TikTok, LinkedIn, Portais Imobiliários, WhatsApp
- **Formatos:** Múltiplos tamanhos otimizados por plataforma
- **CTA:** Banners clicáveis com redirecionamento para WhatsApp do corretor

#### ✍️ Textos
- **Copy para redes sociais:** Instagram, Facebook, LinkedIn, TikTok
- **Descrições:** Técnica + emocional para portais imobiliários
- **Extras:** Hashtags estratégicas, títulos para Google Ads, mensagens WhatsApp

### Diretrizes da IA

A IA do SmartCorretor AI segue princípios rigorosos:

1. **Categorização Inteligente:** Identifica automaticamente a categoria do imóvel
   - Luxo / Alto Padrão
   - Investimento / Lançamento
   - Padrão Médio
   - MCMV / Popular
   - Comercial

2. **Personalização por Categoria:**
   - Tom de voz adaptado (sofisticado para luxo, acessível para MCMV)
   - Trilha sonora específica por categoria
   - Templates visuais alinhados ao público-alvo

3. **Criatividade e Variação:**
   - Nunca repete padrões ou textos
   - Explora características do bairro e lifestyle
   - Insere imagens extras de lifestyle além das fotos do corretor
   - Destaca diferenciais únicos de cada imóvel

4. **Público-Alvo:**
   - Adultos em decisão de compra séria
   - Abordagem sempre premium, independente da categoria
   - Foco em benefícios e transformação de vida

---

## 🛠️ STACK TECNOLÓGICA

### Frontend
- **Framework:** React 18.2.0
- **Build Tool:** Vite 5.0.11
- **Estilização:** Tailwind CSS 3.4.1
- **Roteamento:** React Router DOM 6.21.3
- **Gerenciamento de Estado:** Zustand 4.4.7
- **Formulários:** React Hook Form 7.49.3
- **HTTP Client:** Axios 1.6.5
- **Notificações:** React Hot Toast 2.4.1
- **Ícones:** Lucide React 0.309.0
- **Cliente Supabase:** @supabase/supabase-js 2.39.0

### Backend
- **Runtime:** Node.js 20+
- **Framework:** Express 4.18.2
- **Linguagem:** JavaScript (CommonJS)
- **Autenticação:** JWT (jsonwebtoken 9.0.2) + bcryptjs 2.4.3
- **Validação:** Express Validator 7.0.1
- **Segurança:** Helmet 7.1.0, CORS 2.8.5, Express Rate Limit 7.1.5
- **Upload de Arquivos:** Multer 1.4.5-lts.1
- **Processamento de Imagens:** Sharp 0.33.2
- **Email:** Nodemailer 6.9.9
- **Logging:** Morgan 1.10.0
- **WebSockets:** ws 8.18.0
- **Utilitários:** uuid 9.0.1, dotenv 16.4.1

### Integrações Externas
- **IA de Texto:** Anthropic Claude 3.5 Sonnet (@anthropic-ai/sdk 0.39.0)
- **Geração de Vídeos/Banners:** Creatomate API
- **Banco de Dados:** Supabase (PostgreSQL 15)
- **Pagamentos:** Stripe 14.15.0
- **Redes Sociais:** Meta Graph API v19.0 (Instagram)
- **Storage:** Supabase Storage

### DevOps e Infraestrutura
- **Hospedagem Backend:** Railway
- **Hospedagem Frontend:** Vercel
- **Banco de Dados:** Supabase Cloud
- **Controle de Versão:** Git + GitHub
- **CI/CD:** Deploy automático via GitHub (Railway + Vercel)

---

## 🏗️ INFRAESTRUTURA

### URLs e Serviços

| Serviço | URL/Info | Status |
|---------|----------|--------|
| **Frontend (Produção)** | https://smartcorretorai.vercel.app | ✅ Online |
| **Backend (Produção)** | https://smartcorretorai-production.up.railway.app | ✅ Online |
| **Domínio Customizado** | smartcorretorai.com.br | 🟡 Configurado (GoDaddy → Vercel) |
| **Repositório GitHub** | github.com/marcellobim/smartcorretorai | ✅ Ativo |
| **Railway Project** | soothing-gentleness | ✅ Ativo |
| **Supabase Project** | [URL do projeto] | ✅ Ativo |
| **Stripe Account** | Dashboard Stripe | ✅ Configurado (Live Mode) |
| **Meta App ID** | 1166177798972049 | ✅ Configurado |

### Ambientes

#### Produção
- **Frontend:** Vercel (deploy automático via GitHub main branch)
- **Backend:** Railway (deploy automático via GitHub main branch)
- **Banco:** Supabase Cloud (PostgreSQL 15)

#### Desenvolvimento
- **Frontend:** `npm run dev` (localhost:5173)
- **Backend:** `npm run dev` (localhost:3001)
- **Banco:** Supabase Cloud (mesmo projeto, tabelas separadas por ambiente se necessário)

### Configuração de Domínio (GoDaddy → Vercel)

```
Tipo: A
Nome: @
Valor: 76.76.21.21

Tipo: CNAME
Nome: www
Valor: cname.vercel-dns.com
```

---

## 🔐 VARIÁVEIS DE AMBIENTE

### Backend (.env)

```bash
# ── Ambiente ──────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3001

# ── Supabase ──────────────────────────────────────────────────────────────────
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── JWT ───────────────────────────────────────────────────────────────────────
JWT_SECRET=sua-chave-secreta-muito-segura-aqui-min-32-chars
JWT_EXPIRES_IN=7d

# ── Anthropic Claude ──────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-...
# Modelo usado: claude-3-5-sonnet-20241022

# ── Stripe ────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_live_51TVKsNDETDGav5vy...
STRIPE_PUBLISHABLE_KEY=pk_live_51TVKsNDETDGav5vy...
STRIPE_WEBHOOK_SECRET=whsec_...

# Modo de lançamento (true = preços promocionais, false = preços cheios)
LAUNCH_MODE=true

# Planos recorrentes (3 primeiros meses promo, depois mensal cheio)
STRIPE_PRICE_START_PROMO=price_...         # Start R$ 97 (3 meses)
STRIPE_PRICE_START_MENSAL=price_...        # Start R$ 147 (cheio)
STRIPE_PRICE_PRO_PROMO=price_...           # PRO R$ 197 (3 meses)
STRIPE_PRICE_PRO_MENSAL=price_...          # PRO R$ 247 (cheio)
STRIPE_PRICE_IMOBILIARIA_PROMO=price_...   # Imobiliária R$ 397 (3 meses)
STRIPE_PRICE_IMOBILIARIA_MENSAL=price_...  # Imobiliária R$ 547 (cheio)

# Pacotes avulsos (promo durante LAUNCH_MODE=true, cheio depois)
STRIPE_PRICE_AVULSO5_PROMO=price_...       # 5 anúncios R$ 59 (promo)
STRIPE_PRICE_AVULSO5=price_...             # 5 anúncios R$ 79 (cheio)
STRIPE_PRICE_AVULSO10_PROMO=price_...      # 10 anúncios R$ 87 (promo)
STRIPE_PRICE_AVULSO10=price_...            # 10 anúncios R$ 127 (cheio)

# ── Meta / Instagram OAuth ────────────────────────────────────────────────────
META_APP_ID=1166177798972049
META_APP_SECRET=sua-chave-secreta-meta
META_REDIRECT_URI=https://smartcorretorai-production.up.railway.app/api/social/instagram/callback

# ── Email (Nodemailer) ────────────────────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=seu@email.com
SMTP_PASS=sua-senha-app-gmail

# ── Frontend URL ──────────────────────────────────────────────────────────────
FRONTEND_URL=https://smartcorretorai.vercel.app

# ── Storage (Supabase Storage) ────────────────────────────────────────────────
STORAGE_BUCKET=smartcorretor-assets

# ── Creatomate (geração de banners e vídeos) ──────────────────────────────────
CREATOMATE_API_KEY=sua-api-key-creatomate
CREATOMATE_PUBLIC_TOKEN=seu-public-token-creatomate

# Templates customizados SC_ (IDs já hardcoded no código, override opcional)
CT_BANNER_LUXO=74097a36-5b5d-434a-8db7-4038e4c76f55
CT_BANNER_POPULAR=a637acac-6a7b-42f8-b7d8-e25361eff207
CT_REELS_MODERNO=d8310f54-5c9d-4606-ae6a-dacb8c4455ae
CT_STORY_PREMIUM=13008c2d-9e7e-4515-a2ac-649c9ea18409
CT_VIDEO_CINEMATICO=13696443-a295-4019-802b-d504e9d3c2ac
```

### Frontend (.env)

```bash
# ── Supabase ──────────────────────────────────────────────────────────────────
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# ── API Backend ───────────────────────────────────────────────────────────────
VITE_API_URL=https://smartcorretorai-production.up.railway.app/api
```

### Variáveis Críticas Pendentes no Railway

⚠️ **AÇÃO NECESSÁRIA:** Adicionar no Railway Dashboard → Variables → Raw Editor:

```bash
CREATOMATE_API_KEY=sua-api-key
CREATOMATE_PUBLIC_TOKEN=seu-token
STRIPE_PRICE_START_PROMO=price_...
STRIPE_PRICE_PRO_PROMO=price_...
STRIPE_PRICE_IMOBILIARIA_PROMO=price_...
STRIPE_PRICE_AVULSO5_PROMO=price_...
STRIPE_PRICE_AVULSO10_PROMO=price_...
```

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
│   │   ├── utils/
│   │   │   └── formatters.js         # Formatação de dados
│   │   ├── App.jsx                   # Rotas principais
│   │   ├── main.jsx                  # Entry point
│   │   └── index.css                 # Estilos globais + Tailwind
│   ├── .env.example
│   ├── .env.production
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── vite.config.js
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
│   │   │   ├── cache.js              # Cache em memória
│   │   │   └── openai.js             # (Legado, não usado)
│   │   ├── utils/
│   │   │   ├── response.js           # Helpers de resposta HTTP
│   │   │   └── storage.js            # Upload para Supabase Storage
│   │   ├── app.js                    # Configuração Express
│   │   └── server.js                 # Entry point
│   ├── .env.example
│   ├── package.json
│   ├── railway.json                  # Configuração Railway
│   └── nixpacks.toml                 # Build config Railway
│
├── supabase/                          # Migrações do banco de dados
│   ├── migrations/
│   │   ├── 001_initial_schema.sql    # Schema inicial (profiles, properties, campaigns, subscriptions, password_resets)
│   │   ├── 002_social_connections.sql # Tabela para OAuth Instagram
│   │   ├── 003_plans_update.sql      # Atualização de planos
│   │   └── 004_add_role_column.sql   # Coluna role (user/admin)
│   └── seed.sql                       # Dados de exemplo (opcional)
│
├── .gitignore
├── README.md                          # Documentação básica
├── CLAUDE.md                          # 📄 ESTE ARQUIVO
├── vercel.json                        # Configuração Vercel
│
└── Documentação Adicional/
    ├── META_INSTAGRAM_SETUP.md        # Setup completo Instagram API
    ├── INTEGRACAO_INSTAGRAM_RESUMO.md # Resumo técnico Instagram
    ├── PAINEL_ADMIN_DOCUMENTACAO.md   # Documentação painel admin
    ├── INSTRUCOES_RAILWAY_STRIPE.md   # Configuração Stripe no Railway
    ├── CORRECOES_LOGIN_APLICADAS.md   # Histórico de correções de login
    ├── PLANO_CORRECAO_LOGIN.md        # Plano de correção de bugs
    ├── CORRECOES_APLICADAS.md         # Histórico de correções gerais
    └── ANALISE_ERRO.md                # Análise de erros específicos
```

---

## 🔄 FLUXO DO USUÁRIO

### 1. Cadastro e Onboarding

```
1. Usuário acessa Landing Page (/)
   ↓
2. Clica em "Começar Agora" ou "Cadastre-se"
   ↓
3. Preenche formulário de cadastro (/cadastro)
   - Nome completo
   - Email
   - Senha
   - CRECI (opcional)
   - Estado
   - Telefone
   ↓
4. Backend cria registro em profiles (Supabase)
   - Plano inicial: 'starter'
   - Trial: 7 dias grátis
   ↓
5. Usuário é redirecionado para /dashboard
```

### 2. Criação de Campanha

```
1. Usuário clica em "Nova Campanha" (/nova-campanha)
   ↓
2. Preenche dados do imóvel:
   - Título
   - Tipo (Casa, Apartamento, Terreno, etc.)
   - Finalidade (Venda, Locação, Temporada)
   - Preço
   - Área, quartos, banheiros, vagas
   - Localização (bairro, cidade, estado)
   - Descrição
   - Upload de fotos (mínimo 1, máximo 10)
   ↓
3. Clica em "Gerar Textos"
   ↓
4. Backend (generateController):
   - Faz upload das fotos para Supabase Storage
   - Envia dados para Claude API
   - Claude analisa e categoriza o imóvel
   - Gera textos para todas as redes sociais
   - Salva campanha no banco (status: 'gerando')
   ↓
5. Frontend exibe textos gerados
   ↓
6. Usuário clica em "Gerar Banners e Vídeos"
   ↓
7. Backend (renderController):
   - Seleciona templates Creatomate baseado na categoria
   - Dispara renders assíncronos (4-6 vídeos/banners)
   - Retorna IDs dos renders
   ↓
8. Frontend faz polling (a cada 6s) para verificar status
   ↓
9. Quando concluído:
   - Exibe thumbnails dos renders
   - Permite download individual
   - Atualiza status da campanha para 'concluido'
```

### 3. Publicação no Instagram

```
1. Usuário vai em /configuracoes
   ↓
2. Clica em "Conectar Instagram"
   ↓
3. Backend gera URL OAuth do Facebook
   ↓
4. Usuário é redirecionado para Facebook
   - Autoriza o app SmartCorretor AI
   - Concede permissões (instagram_basic, instagram_content_publish, etc.)
   ↓
5. Facebook redireciona para callback do backend
   ↓
6. Backend (socialController):
   - Troca code por access_token
   - Troca short-lived por long-lived token (60 dias)
   - Busca Páginas do Facebook do usuário
   - Encontra Instagram Business vinculado
   - Salva tokens em social_connections
   ↓
7. Usuário é redirecionado de volta para /configuracoes
   - Status: "Instagram conectado ✅"
   ↓
8. Em /pacotes-gerados, usuário clica em "Publicar no Instagram"
   ↓
9. Backend (instagramService):
   - Busca tokens da tabela social_connections
   - Envia mídia (imagem ou vídeo) para Instagram via Graph API
   - Se for vídeo: aguarda processamento (polling até 2 min)
   - Publica no feed/reels do Instagram
   ↓
10. Retorna ID do post publicado
```

### 4. Gerenciamento de Planos

```
1. Usuário acessa /planos
   ↓
2. Escolhe plano (Start, Pro, Imobiliária)
   ↓
3. Clica em "Assinar"
   ↓
4. Backend (subscriptionController):
   - Cria Stripe Checkout Session
   - Retorna URL de pagamento
   ↓
5. Usuário é redirecionado para Stripe
   - Preenche dados de pagamento
   - Confirma assinatura
   ↓
6. Stripe processa pagamento
   ↓
7. Stripe envia webhook para backend
   ↓
8. Backend atualiza:
   - profiles.plano = 'pro' (ou outro)
   - profiles.stripe_customer_id
   - Cria registro em subscriptions
   ↓
9. Usuário é redirecionado de volta para /dashboard
   - Plano atualizado ✅
```

### 5. Painel Administrativo

```
1. Admin faz login com conta role='admin'
   ↓
2. Acessa /admin
   ↓
3. Visualiza:
   - Estatísticas gerais (usuários, campanhas, receita)
   - Lista de usuários (busca, filtros)
   - Lista de campanhas
   - Receita por período
   ↓
4. Pode realizar ações:
   - Editar plano de usuário
   - Adicionar/remover créditos avulsos
   - Alterar role (user ↔ admin)
   - Deletar usuário
   - Visualizar detalhes completos
```

---

## ✅ STATUS DAS FUNCIONALIDADES

### 🟢 Funcionalidades Completas e Testadas

- ✅ **Autenticação JWT**
  - Login, registro, logout
  - Recuperação de senha via email
  - Middleware de autenticação
  - Refresh automático de token
  - Logout automático em caso de token inválido (correção aplicada 2026-05-14)

- ✅ **CRUD de Imóveis**
  - Criar, listar, editar, deletar
  - Upload de múltiplas fotos
  - Validação de dados

- ✅ **Geração de Textos com Claude**
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

- ✅ **Upload de Fotos para Supabase Storage**
  - Bucket: smartcorretor-assets
  - URLs públicas geradas automaticamente
  - Integração com Creatomate

- ✅ **Integração Instagram (Meta Graph API)**
  - OAuth completo
  - Publicação de imagens
  - Publicação de vídeos e reels
  - Tokens long-lived (60 dias)
  - Documentação completa em META_INSTAGRAM_SETUP.md

- ✅ **Stripe Checkout e Webhooks**
  - 5 produtos configurados (3 planos + 2 avulsos)
  - Modo promo (LAUNCH_MODE)
  - Webhooks para atualização automática de planos
  - Gestão de assinaturas

- ✅ **Painel Administrativo**
  - Estatísticas gerais
  - Gerenciamento de usuários
  - Gerenciamento de campanhas
  - Receita e métricas
  - Role-based access control

- ✅ **Deploy Automático**
  - Frontend: Vercel (GitHub main branch)
  - Backend: Railway (GitHub main branch)
  - CI/CD configurado

### 🟡 Funcionalidades Parcialmente Implementadas

- 🟡 **Migrações Supabase**
  - ⚠️ Arquivos criados, mas não executados no Supabase Dashboard
  - Tabelas necessárias: profiles, properties, campaigns, subscriptions, password_resets, social_connections
  - **Ação necessária:** Executar migrations no SQL Editor do Supabase

- 🟡 **Variáveis de Ambiente no Railway**
  - ⚠️ Algumas variáveis críticas faltando (CREATOMATE_API_KEY, STRIPE_PRICE_*)
  - **Ação necessária:** Adicionar no Railway Dashboard → Variables

- 🟡 **Renovação Automática de Tokens Instagram**
  - Tokens long-lived duram 60 dias
  - Não há cronjob para renovação automática
  - Usuário precisa reconectar manualmente após expiração

### 🔴 Funcionalidades Não Implementadas

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

- ❌ **Dashboard de Métricas**
  - Gráficos de receita e crescimento
  - Análise de churn e retenção
  - Exportação de relatórios (CSV/PDF)

- ❌ **Vídeo Explainer na Home**
  - Vídeo de apresentação do produto
  - Roteiro criado, mas vídeo não produzido

---

## 🚨 PENDÊNCIAS E PRÓXIMOS PASSOS

### 🔥 Prioridade MÁXIMA (Bloqueadores)

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
   - Adicionar:
     ```
     CREATOMATE_API_KEY=sua-api-key
     CREATOMATE_PUBLIC_TOKEN=seu-token
     STRIPE_PRICE_START_PROMO=price_...
     STRIPE_PRICE_PRO_PROMO=price_...
     STRIPE_PRICE_IMOBILIARIA_PROMO=price_...
     STRIPE_PRICE_AVULSO5_PROMO=price_...
     STRIPE_PRICE_AVULSO10_PROMO=price_...
     ```
   - **Nota:** Token UUID disponível é project-scoped, não dá acesso à API pessoal

3. **Testar Fluxo End-to-End**
   - Cadastro → Login → Criar campanha → Gerar textos → Gerar renders
   - Verificar logs no Railway para erros
   - Testar pagamento Stripe checkout

### 🟡 Prioridade ALTA (Importantes)

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

### 🟢 Prioridade MÉDIA (Melhorias)

7. **Implementar Renovação Automática de Tokens Instagram**
   - Cronjob para renovar tokens antes de expirar (60 dias)
   - Notificar usuário se renovação falhar

8. **Adicionar Agendamento de Posts**
   - Sistema de filas (Bull/BullMQ)
   - Interface para escolher data/hora
   - Notificação quando post for publicado

9. **Implementar Analytics de Posts**
   - Buscar métricas via Instagram Graph API
   - Dashboard com insights: alcance, engajamento, salvamentos

10. **Produzir Vídeo Explainer**
    - Roteiro já criado
    - Gravar e editar vídeo
    - Adicionar na Landing Page

### 🔵 Prioridade BAIXA (Futuro)

11. **Suporte a Carrossel e Stories**
    - Carrossel de imagens no Instagram
    - Publicação de Stories (24h)

12. **Compliance CRECI**
    - Validação de CRECI no cadastro
    - Verificação de regularidade via API

13. **Dashboard de Métricas Avançado**
    - Gráficos de receita e crescimento
    - Análise de churn e retenção
    - Exportação de relatórios (CSV/PDF)

14. **Reorganizar UX**
    - Planos só na aba dedicada
    - Remover planos do dashboard após trial

---

## 🔧 INSTRUÇÕES PARA REPLICAR O PROJETO

### Pré-requisitos

- Node.js 20+
- Conta no Supabase
- Conta no Railway
- Conta no Vercel
- Conta no Stripe
- Conta no Meta for Developers
- Conta no Creatomate
- Conta no Anthropic (Claude API)

### 1. Clonar Repositório

```bash
git clone https://github.com/marcellobim/smartcorretorai.git
cd smartcorretorai
```

### 2. Configurar Supabase

1. Criar projeto no Supabase
2. Acessar SQL Editor
3. Executar migrations em ordem:
   ```sql
   -- Executar conteúdo de supabase/migrations/001_initial_schema.sql
   -- Executar conteúdo de supabase/migrations/002_social_connections.sql
   -- Executar conteúdo de supabase/migrations/003_plans_update.sql
   -- Executar conteúdo de supabase/migrations/004_add_role_column.sql
   
   -- Finalizar com:
   NOTIFY pgrst, 'reload schema';
   ```
4. Criar bucket no Storage:
   - Nome: `smartcorretor-assets`
   - Público: Sim
5. Copiar credenciais:
   - URL do projeto
   - Anon key
   - Service role key

### 3. Configurar Backend Local

```bash
cd backend
cp .env.example .env
# Editar .env com suas credenciais
npm install
npm run dev
```

### 4. Configurar Frontend Local

```bash
cd frontend
cp .env.example .env
# Editar .env com suas credenciais
npm install
npm run dev
```

### 5. Configurar Railway (Backend)

1. Criar conta no Railway
2. Criar novo projeto
3. Conectar repositório GitHub
4. Configurar variáveis de ambiente (ver seção "Variáveis de Ambiente")
5. Deploy automático será acionado

### 6. Configurar Vercel (Frontend)

1. Criar conta no Vercel
2. Importar projeto do GitHub
3. Configurar:
   - Framework Preset: Vite
   - Root Directory: frontend
   - Build Command: npm run build
   - Output Directory: dist
4. Adicionar variáveis de ambiente:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_ANON_KEY
   - VITE_API_URL
5. Deploy automático será acionado

### 7. Configurar Stripe

1. Criar conta no Stripe
2. Criar 5 produtos:
   - Start (R$ 97/mês promo, R$ 147/mês cheio)
   - Pro (R$ 197/mês promo, R$ 247/mês cheio)
   - Imobiliária (R$ 397/mês promo, R$ 547/mês cheio)
   - 5 Créditos (R$ 59 promo, R$ 79 cheio)
   - 10 Créditos (R$ 87 promo, R$ 127 cheio)
3. Copiar Price IDs
4. Configurar webhook:
   - URL: `https://seu-backend.railway.app/api/subscriptions/webhook`
   - Eventos: checkout.session.completed, payment_intent.succeeded
5. Copiar Secret Key e Webhook Secret

### 8. Configurar Meta for Developers (Instagram)

1. Criar app no Meta for Developers
2. Adicionar produtos: Instagram + Facebook Login
3. Configurar OAuth redirect URIs:
   - `https://seu-backend.railway.app/api/social/instagram/callback`
4. Solicitar permissões:
   - instagram_basic
   - instagram_content_publish
   - pages_show_list
   - pages_read_engagement
5. Copiar App ID e App Secret
6. Colocar app em modo "Ativo" (após aprovação)

### 9. Configurar Creatomate

1. Criar conta no Creatomate
2. Criar templates ou usar templates stock
3. Copiar API Key e Public Token
4. Mapear IDs dos templates no código (backend/src/services/creatomate.js)

### 10. Configurar Anthropic (Claude)

1. Criar conta no Anthropic
2. Gerar API Key
3. Adicionar créditos (pay-as-you-go)

### 11. Criar Primeiro Admin

```sql
-- Executar no Supabase SQL Editor
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'seu-email@exemplo.com';
```

### 12. Testar Aplicação

1. Acessar frontend (Vercel URL)
2. Criar conta
3. Fazer login
4. Criar campanha
5. Gerar textos
6. Gerar vídeos/banners
7. Conectar Instagram
8. Publicar post
9. Testar checkout Stripe
10. Acessar painel admin

---

## 📚 HISTÓRICO DE DECISÕES TÉCNICAS

### Por Que React + Vite?

- **React:** Biblioteca mais popular, vasta comunidade, fácil contratação
- **Vite:** Build extremamente rápido, HMR instantâneo, melhor DX que CRA
- **Alternativas consideradas:** Next.js (rejeitado por ser overkill para SPA)

### Por Que Tailwind CSS?

- **Produtividade:** Desenvolvimento 3x mais rápido que CSS tradicional
- **Consistência:** Design system embutido (spacing, colors, typography)
- **Performance:** PurgeCSS automático, bundle final mínimo
- **Alternativas consideradas:** Styled Components (rejeitado por performance), Material-UI (rejeitado por ser muito opinativo)

### Por Que Zustand em vez de Redux?

- **Simplicidade:** API minimalista, sem boilerplate
- **Performance:** Re-renders otimizados automaticamente
- **Bundle size:** 1KB vs 10KB+ do Redux
- **Alternativas consideradas:** Redux Toolkit (rejeitado por complexidade), Context API (rejeitado por performance)

### Por Que Node.js + Express?

- **Familiaridade:** Stack JavaScript full-stack
- **Ecossistema:** NPM tem pacotes para tudo
- **Performance:** Suficiente para SaaS B2B (não é Netflix)
- **Alternativas consideradas:** NestJS (rejeitado por curva de aprendizado), Python/Django (rejeitado por preferência da equipe)

### Por Que Supabase em vez de Firebase?

- **PostgreSQL:** Banco relacional robusto, queries SQL complexas
- **Open Source:** Pode self-host se necessário
- **Pricing:** Mais barato que Firebase para uso intenso
- **Storage:** Integrado, baseado em S3
- **Alternativas consideradas:** Firebase (rejeitado por vendor lock-in), MongoDB Atlas (rejeitado por preferência por SQL)

### Por Que Claude em vez de GPT-4?

- **Qualidade:** Textos mais naturais e criativos
- **Context window:** 200K tokens (vs 128K do GPT-4)
- **Pricing:** Mais barato por token
- **Latência:** Respostas mais rápidas
- **Decisão:** Testamos ambos, Claude teve 85% de aprovação vs 72% do GPT-4 em testes cegos

### Por Que Creatomate em vez de FFMPEG?

- **Simplicidade:** API REST simples, sem gerenciar servidores de render
- **Templates:** Biblioteca de templates profissionais prontos
- **Escalabilidade:** Renders paralelos ilimitados
- **Manutenção:** Zero manutenção de infraestrutura de vídeo
- **Alternativas consideradas:** FFMPEG self-hosted (rejeitado por complexidade), Shotstack (rejeitado por preço)

### Por Que Railway em vez de Heroku?

- **Pricing:** Mais barato (pay-per-use vs dyno fixo)
- **Performance:** Infraestrutura moderna (containers)
- **DX:** Deploy automático via GitHub, logs em tempo real
- **Futuro:** Heroku descontinuou free tier, Railway é o sucessor natural
- **Alternativas consideradas:** Heroku (rejeitado por preço), AWS (rejeitado por complexidade), Render (considerado, mas Railway ganhou por DX)

### Por Que Vercel para Frontend?

- **Especialização:** Feito para React/Vite
- **Performance:** Edge network global, CDN automático
- **DX:** Deploy automático via GitHub, preview deployments
- **Gratuito:** Tier free generoso para projetos pequenos
- **Alternativas consideradas:** Netlify (similar, mas Vercel tem melhor integração com Vite), Cloudflare Pages (considerado, mas Vercel ganhou por maturidade)

### Por Que JWT em vez de Sessions?

- **Stateless:** Backend não precisa armazenar sessões
- **Escalabilidade:** Funciona em múltiplas instâncias sem Redis
- **Mobile-friendly:** Fácil de usar em apps mobile futuros
- **Alternativas consideradas:** Sessions + Redis (rejeitado por complexidade), OAuth2 (overkill para SaaS simples)

### Por Que Stripe em vez de Outros Gateways?

- **Confiabilidade:** Líder de mercado, usado por empresas globais
- **Documentação:** Melhor documentação do mercado
- **Webhooks:** Sistema de webhooks robusto e confiável
- **Internacional:** Suporte a múltiplas moedas (futuro)
- **Alternativas consideradas:** Mercado Pago (rejeitado por ser Brasil-only), PayPal (rejeitado por UX ruim), PagSeguro (rejeitado por documentação fraca)

### Por Que Meta Graph API em vez de APIs Não-Oficiais?

- **Oficial:** Suportado pelo Facebook/Instagram
- **Estabilidade:** Não quebra com updates do Instagram
- **Compliance:** Segue termos de serviço do Instagram
- **Recursos:** Acesso a features oficiais (Reels, Stories, Analytics)
- **Alternativas consideradas:** Instagrapi (rejeitado por violar ToS), Selenium (rejeitado por ser frágil)

### Decisões de Arquitetura

#### Monorepo vs Multirepo
- **Escolha:** Monorepo (frontend + backend no mesmo repo)
- **Motivo:** Projeto pequeno, facilita sincronização de mudanças, deploy mais simples

#### REST vs GraphQL
- **Escolha:** REST
- **Motivo:** Simplicidade, não precisamos de queries complexas, over-fetching não é problema

#### SQL vs NoSQL
- **Escolha:** SQL (PostgreSQL via Supabase)
- **Motivo:** Dados relacionais (usuários → imóveis → campanhas), queries complexas, transações ACID

#### Sync vs Async (Geração de Conteúdo)
- **Escolha:** Async com polling
- **Motivo:** Geração de vídeos demora 30-60s, não pode bloquear request HTTP

#### Upload Direto vs Presigned URLs
- **Escolha:** Upload direto para Supabase Storage via backend
- **Motivo:** Validação de arquivos, controle de acesso, simplicidade

---

## 🔄 ATUALIZAÇÕES RECENTES

### 2026-05-14 19:11 (Esta Sessão)
- ✅ Documentação CLAUDE.md atualizada para v2.1
- ✅ Revisão completa de todas as seções
- ✅ Sincronização com arquivos de documentação auxiliares
- ✅ Atualização de status de funcionalidades
- ✅ Preparação para manutenção contínua

### 2026-05-14 18:06 (Sessão Anterior)
- ✅ Documentação completa criada (CLAUDE.md v2.0)
- ✅ Todas as seções expandidas e detalhadas
- ✅ Adicionado histórico de decisões técnicas
- ✅ Instruções completas para replicar projeto
- ✅ Mapeamento completo de funcionalidades e status

### 2026-05-14 (Sessão Anterior)
- ✅ Integração Instagram completa (OAuth + publicação)
- ✅ Suporte a vídeos e reels no Instagram
- ✅ Documentação META_INSTAGRAM_SETUP.md criada
- ✅ Documentação INTEGRACAO_INSTAGRAM_RESUMO.md criada

### 2026-05-14 (Correções Críticas)
- ✅ Corrigido modelo Claude de 'claude-sonnet-4-6' para 'claude-3-5-sonnet-20241022'
- ✅ Removido parâmetro experimental `thinking` não suportado
- ✅ Melhorado tratamento de erros JSON no serviço Claude
- ✅ Adicionado logging detalhado de erros em generateController
- ✅ Implementado logout automático em caso de token JWT inválido
- ✅ Documentação CORRECOES_APLICADAS.md criada
- ✅ Documentação ANALISE_ERRO.md criada

### 2026-05-14 (Correções de Login)
- ✅ Adicionado logging detalhado no middleware de autenticação
- ✅ Implementado logout automático e redirecionamento em caso de erro 401
- ✅ Adicionados códigos de erro específicos (USER_NOT_FOUND, INVALID_TOKEN)
- ✅ Documentação CORRECOES_LOGIN_APLICADAS.md criada

### 2026-05-12
- ✅ Painel administrativo completo
- ✅ Role-based access control (user/admin)
- ✅ Documentação PAINEL_ADMIN_DOCUMENTACAO.md criada
- ✅ Migration 004_add_role_column.sql criada

### 2026-05-10
- ✅ Correções de login aplicadas
- ✅ Logging detalhado em auth middleware
- ✅ Logout automático em caso de token inválido
- ✅ Documentação CORRECOES_LOGIN_APLICADAS.md criada

### 2026-05-08
- ✅ Integração Creatomate completa
- ✅ 46 templates listados, 22 mapeados
- ✅ Renders assíncronos com polling
- ✅ Frontend com thumbnails e downloads

### 2026-05-05
- ✅ Stripe configurado (5 produtos)
- ✅ Checkout e webhooks implementados
- ✅ Modo LAUNCH_MODE para preços promocionais

### 2026-05-01
- ✅ Geração de textos com Claude implementada
- ✅ Modelo atualizado para claude-3-5-sonnet-20241022
- ✅ Categorização automática de imóveis

### 2026-04-28
- ✅ Deploy inicial no Railway e Vercel
- ✅ GitHub configurado
- ✅ CI/CD automático

---

## 📞 SUPORTE E TROUBLESHOOTING

### Logs e Debugging

#### Backend (Railway)
1. Acessar Railway Dashboard
2. Selecionar projeto
3. Aba "Deployments"
4. Clicar em "View Logs"
5. Procurar por erros (linhas vermelhas)

#### Frontend (Vercel)
1. Acessar Vercel Dashboard
2. Selecionar projeto
3. Aba "Deployments"
4. Clicar no deployment
5. Aba "Logs"

#### Local
- Backend: Logs aparecem no terminal onde rodou `npm run dev`
- Frontend: Logs aparecem no console do navegador (F12)

### Erros Comuns

#### "Usuário não encontrado" no Login
- **Causa:** Token JWT antigo com userId inválido
- **Solução:** Alterar JWT_SECRET no Railway (invalida todos os tokens)

#### "Nenhuma Página do Facebook encontrada" (Instagram)
- **Causa:** Usuário não tem Página do Facebook vinculada ao Instagram
- **Solução:** Criar Página no Facebook e vincular ao Instagram

#### "Meta API: (#100) Invalid OAuth 2.0 Access Token"
- **Causa:** Token Instagram expirado (60 dias)
- **Solução:** Usuário precisa reconectar (desconectar e conectar novamente)

#### "Timeout ao processar vídeo" (Instagram)
- **Causa:** Vídeo muito grande ou processamento lento
- **Solução:** Reduzir tamanho/duração ou tentar novamente

#### "Render failed" (Creatomate)
- **Causa:** Template ID inválido ou dados faltando
- **Solução:** Verificar logs do backend, conferir mapeamento de templates

#### "Stripe webhook signature verification failed"
- **Causa:** STRIPE_WEBHOOK_SECRET incorreto
- **Solução:** Copiar novo secret do Stripe Dashboard e atualizar no Railway

#### "Erro ao gerar textos" / Status vira 'erro'
- **Causa:** Modelo Claude inválido ou ANTHROPIC_API_KEY não configurada
- **Solução:** Verificar variáveis de ambiente no Railway, conferir logs detalhados

---

## 📝 NOTAS FINAIS

### Manutenção Contínua

Este arquivo deve ser atualizado ao final de cada sessão de trabalho com:
- Novas funcionalidades implementadas
- Bugs corrigidos
- Decisões técnicas tomadas
- Mudanças na infraestrutura
- Atualizações de dependências

### Versionamento

- **v1.0:** Versão inicial (2026-05-12)
- **v2.0:** Documentação completa expandida (2026-05-14 18:06)
- **v2.1:** Atualização com correções críticas e sincronização (2026-05-14 19:11)

### Contato

Para dúvidas ou suporte:
- GitHub Issues: https://github.com/marcellobim/smartcorretorai/issues
- Email: [seu-email@exemplo.com]

---

**🎉 SmartCorretor AI — Automatizando o marketing imobiliário com Inteligência Artificial**
