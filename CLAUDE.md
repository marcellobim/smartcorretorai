# SmartCorretor AI — Documentação do Projeto

> Documento de referência. Cole no início de novas conversas para contexto.

**Última atualização:** 2026-05-23
**Versão:** 3.0 (reescrita após remoção do backend Node)

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Stack Tecnológica](#stack-tecnológica)
3. [Arquitetura](#arquitetura)
4. [Infraestrutura](#infraestrutura)
5. [Variáveis de Ambiente](#variáveis-de-ambiente)
6. [Estrutura de Pastas](#estrutura-de-pastas)
7. [Edge Functions](#edge-functions)
8. [Fluxo do Usuário](#fluxo-do-usuário)
9. [Status das Funcionalidades](#status-das-funcionalidades)
10. [Pendências](#pendências)
11. [Como Replicar](#como-replicar)
12. [Decisões Técnicas](#decisões-técnicas)
13. [Histórico Recente](#histórico-recente)

---

## Visão Geral

SmartCorretor AI é um SaaS imobiliário que automatiza a criação de conteúdo de marketing para corretores. O corretor envia fotos e dados básicos do imóvel; o sistema devolve textos, banners e vídeos prontos para publicação.

**Entregáveis por campanha:**
- **Vídeos** (9:16, 16:9, 1:1, 4:5) com narração e trilha por categoria
- **Banners** para portais, Meta Ads, Google Ads, WhatsApp
- **Textos** para Instagram, Facebook, LinkedIn, TikTok e portais

**Diretrizes da IA:**
- Categorização automática (Luxo, Médio Padrão, MCMV, Lançamento, Em Construção, Comercial)
- Tom de voz adaptado por categoria
- Sem dados fictícios em inglês — sanitização força PT-BR e dados reais do imóvel/corretor

---

## Stack Tecnológica

### Frontend (`frontend/`)
- **React 18** + **Vite 5** + **Tailwind 3**
- **react-router-dom 6** — roteamento
- **@supabase/supabase-js 2** — único cliente HTTP (sem axios)
- **zustand** — estado global pontual
- **react-hook-form** — formulários
- **react-hot-toast** — notificações
- **lucide-react** — ícones

### Backend
**Não existe backend Node/Express.** Toda lógica server-side roda em **Supabase Edge Functions** (Deno) e no próprio Supabase (Auth, Storage, Postgres com RLS).

### Edge Functions (`supabase/functions/`)
- **`gerar-campanha`** — gera textos via OpenAI `gpt-4o-mini`
- **`gerar-banners`** — seleciona templates (lista vinda do frontend), valida JWT inbound, monta `modifications` via OpenAI `gpt-4o-mini` e dispara renders no Creatomate

### Serviços Externos
- **OpenAI** (`gpt-4o-mini`) — geração de textos e fill de templates
- **Creatomate** — render de vídeos e banners
- **Supabase Cloud** — Auth, Storage, Postgres
- **Stripe** — pagamento (citado na política de privacidade; checkout ainda não integrado)

### Tooling (raiz do repo)
- **Playwright** — testes E2E (`smartcorretor.spec.js`)
- **Supabase CLI** (`supabase` em devDependencies)

---

## Arquitetura

```
┌──────────────────────┐         ┌───────────────────────────────┐
│  Frontend (Vite SPA) │  HTTPS  │  Supabase Cloud               │
│  React + Tailwind    │ ──────▶ │  - Auth (JWT)                 │
│  @supabase/supabase- │         │  - Postgres + RLS             │
│  js (único cliente)  │         │  - Storage (smartcorretor-    │
│                      │         │    assets)                    │
│  AuthContext mantém  │         │  - Edge Functions (Deno):     │
│  session + JWT em    │         │      ├─ gerar-campanha        │
│  memória             │         │      └─ gerar-banners ────┐   │
└──────────┬───────────┘         └───────────────────────────┼───┘
           │                                                 │
           │ Authorization: Bearer <JWT do AuthContext>     │
           ▼                                                 ▼
  invoke('gerar-campanha')                           ┌───────────────┐
  invoke('gerar-banners')                            │  OpenAI API   │
                                                     │ gpt-4o-mini   │
                                                     └───────┬───────┘
                                                             ▼
                                                     ┌───────────────┐
                                                     │ Creatomate    │
                                                     │ (renders)     │
                                                     └───────────────┘
```

**Princípios chave:**
- Frontend nunca chama serviços externos diretamente — só Supabase.
- JWT é fonte única de identidade. Edge function `gerar-banners` valida o token e ignora `user_id` do body.
- `AuthContext` (`frontend/src/lib/auth-context.jsx`) é o ÚNICO lugar que chama `supabase.auth.getSession()/refreshSession()`. Demais arquivos leem `accessToken` direto do contexto.

---

## Infraestrutura

| Item | Valor |
|------|-------|
| **Supabase project ref** | `sfbowejaevlmhcvsxhbk` |
| **Dashboard** | https://supabase.com/dashboard/project/sfbowejaevlmhcvsxhbk |
| **Frontend** | Build estático via `vite build` (sem config de hospedagem no repo) |
| **GitHub** | github.com/marcellobim/smartcorretorai |
| **Storage bucket** | `smartcorretor-assets` |

**Não usamos:**
- ❌ Railway (removido)
- ❌ Vercel (removido — `vercel.json` apagado em `00b78ea`)
- ❌ Backend Node/Express (deletado em `07c4028`)

---

## Variáveis de Ambiente

### Frontend (`frontend/.env`)

```bash
VITE_SUPABASE_URL=https://sfbowejaevlmhcvsxhbk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

Só essas duas. Tudo o mais é segredo de Edge Function.

### Edge Function Secrets

Configurar via `npx supabase secrets set --project-ref sfbowejaevlmhcvsxhbk`:

```bash
OPENAI_API_KEY=sk-...
CREATOMATE_API_KEY=...
# SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são populados automaticamente
# pelo Supabase nos ambientes de Edge Functions
```

A `gerar-banners` lê `Authorization` do request, valida via `supabase.auth.getUser(token)` e deriva `user_id` do JWT (nunca do body).

---

## Estrutura de Pastas

```
smartcorretorai/
├── frontend/                       # SPA Vite + React
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── lib/
│   │   │   ├── auth-context.jsx    # ÚNICA fonte de getSession/refreshSession
│   │   │   └── supabase.js         # Cliente único
│   │   ├── pages/                  # 12 telas (Landing, Login, Dashboard,
│   │   │                           # NovaCampanha, PacotesGerados, etc.)
│   │   ├── hooks/
│   │   │   ├── useCampaigns.js     # Lê user/accessToken do AuthContext
│   │   │   └── useProperties.js    # Lê user do AuthContext
│   │   ├── components/             # layout/, marketing/, ui/
│   │   └── utils/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── supabase/
│   ├── config.toml                 # project_id + verify_jwt por função
│   ├── seed.sql
│   ├── functions/
│   │   ├── gerar-campanha/index.ts # OpenAI → textos
│   │   └── gerar-banners/index.ts  # OpenAI + Creatomate → renders
│   └── migrations/                 # 7 arquivos .sql
│
├── package.json                    # Playwright + Supabase CLI (devDeps)
├── smartcorretor.spec.js           # Testes E2E
├── CLAUDE.md                       # Este arquivo
├── README.md
└── .gitignore                      # Inclui **/supabase/.temp/
```

---

## Edge Functions

### `gerar-campanha`

- **Função:** Gera textos para redes sociais e portais
- **Modelo:** OpenAI `gpt-4o-mini`
- **JWT:** `verify_jwt = false` em `config.toml` (validação manual interna se necessário)
- **Entrada:** dados do imóvel, fotos, categoria
- **Saída:** `{ campanha: { textos_gerados, ... } }` persistida em `campaigns`

### `gerar-banners`

- **Função:** Recebe lista de templates marcada pelo corretor, valida JWT, busca metadados dos templates no Creatomate, monta `modifications` via OpenAI e dispara renders
- **Modelo:** OpenAI `gpt-4o-mini`
- **JWT inbound:** validado obrigatoriamente (via `supabase.auth.getUser(token)`)
- **Seleção de templates:** **estritamente** a lista enviada pelo frontend em `selectedTemplates`. Backend não escolhe sozinho. Sem cap de quantidade.
- **Sanitizer:** força PT-BR — substitui frases fixas em inglês de templates stock (`NEW ON SALE`, `NEW YORK, NY`, `Open House`, etc.) por equivalentes brasileiros ou pelo dado real do imóvel
- **CTA aprovados (exclusivos):** `Saiba Mais`, `Me Ligue`, `Descrição abaixo`

**Templates oficiais (18, em `TEMPLATES` no `index.ts`):**

| # | Nome | Categoria |
|---|------|-----------|
| 1-5 | SC_Banner_Luxo_01, SC_Banner_Popular_01, SC_Reels_Moderno_01, SC_Story_Premium_01, SC_Video_Cinematic_01 | famílias `SC_` |
| 6-9 | Real Estate Banner, Real Estate Card, Real Estate Detailed, Real Estate Video Montage | stock |
| 10-14 | Triple Slide Carousel, New Listing Story, Photo Montage, Polaroid Photos, Animated Review | stock |
| 15-18 | Searchlight Reveal, Chat w/ Photos, Image Slideshow, Video Compilation | stock |

---

## Fluxo do Usuário

### Cadastro/Login
1. Usuário acessa Landing → cadastro
2. Supabase Auth cria `auth.users` + trigger popula `profiles`
3. `AuthContext` hidrata sessão via `onAuthStateChange` (fonte única)

### Criação de Campanha (Nova Campanha)
1. Usuário preenche formulário (tipo, preço, fotos, diferenciais, templates marcados)
2. `gerarAnuncios()` em `NovaCampanha.jsx`:
   - Lê `accessToken` direto do `useAuth()`. Sem token → redireciona pra `/login`.
   - Faz upload das fotos pro Storage (com timeout de 8s por foto — não trava)
   - Dispara em paralelo: `invoke('gerar-campanha')` + `invoke('gerar-banners')`, ambos com `Authorization: Bearer <token>` explícito no header
3. `gerar-campanha` retorna textos → tela de resultado
4. `gerar-banners` retorna `render_id`s → polling de status no Creatomate até finalizar

### Regerar Banners (depois da campanha criada)
- `gerarBanners()` em `NovaCampanha.jsx` repete o invoke de `gerar-banners` com `campaign_id` já existente

---

## Status das Funcionalidades

### Funcionando
- ✅ Autenticação Supabase (login, cadastro, recuperação)
- ✅ CRUD de imóveis e campanhas via RLS
- ✅ Upload de fotos pro Storage
- ✅ Geração de textos (`gerar-campanha` + OpenAI)
- ✅ Geração de banners/vídeos (`gerar-banners` + Creatomate)
- ✅ Sanitização PT-BR de placeholders americanos
- ✅ Validação JWT inbound em `gerar-banners`
- ✅ Auth via `AuthContext` sem `getSession()` espalhados pelo código

### Em curso / pendente
- 🟡 Stripe checkout — mencionado em copy mas não integrado
- 🟡 Publicação Instagram — não há edge function nem fluxo
- 🟡 Painel admin — telas existem (`AdminDashboard.jsx`), validar fluxos com a nova arquitetura
- 🟡 Hospedagem do frontend — sem config no repo, deploy é manual

---

## Pendências

### Críticas
1. **Definir hospedagem do frontend** — atualmente sem `vercel.json`, sem Dockerfile, sem CI. Build é manual via `vite build`. Decidir entre Supabase Hosting (quando estável), Cloudflare Pages, ou voltar pra Vercel se for o caso.
2. **Integrar Stripe** — produtos e checkout precisam de uma edge function `criar-checkout-stripe` + webhook handler.

### Importantes
3. **Publicação Instagram via Meta Graph API** — exige edge function dedicada que armazena `social_connections` e usa long-lived tokens.
4. **Renovação automática de tokens long-lived** quando Instagram for implementado.
5. **Painel admin** — auditoria de fluxos com edge functions (sem backend, decisões de role passam por RLS).

---

## Como Replicar

### Pré-requisitos
- Node 20+
- Conta Supabase com projeto criado
- Chaves: OpenAI, Creatomate

### Passos
```bash
git clone https://github.com/marcellobim/smartcorretorai
cd smartcorretorai

# 1. Frontend
cd frontend
cp .env.example .env   # editar com VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY
npm install
npm run dev            # localhost:5173

# 2. Supabase — migrations
cd ..
npx supabase login
npx supabase link --project-ref <seu-project-ref>
# Aplicar migrations via Dashboard ou:
npx supabase db push

# 3. Edge function secrets
npx supabase secrets set \
  OPENAI_API_KEY=sk-... \
  CREATOMATE_API_KEY=... \
  --project-ref <seu-project-ref>

# 4. Deploy edge functions
npx supabase functions deploy gerar-campanha --project-ref <seu-project-ref>
npx supabase functions deploy gerar-banners --project-ref <seu-project-ref>

# 5. Storage bucket
# Criar bucket público "smartcorretor-assets" via Dashboard
```

---

## Decisões Técnicas

### Por que removemos o backend Node/Express?
Em 2026-05 o backend Express + Railway foi deletado (commit `07c4028 etapa1 concluida - backend deletado`). Motivo: a totalidade da lógica server-side cabia em 2 edge functions Deno + RLS no Postgres. Manter backend separado significava:
- Duas runtimes pra manter (Node + Deno)
- Duas redes de auth (JWT próprio + Supabase Auth)
- Custo Railway sem ganho funcional
- Latência adicional (frontend → Railway → Supabase)

A nova arquitetura: frontend talks direto ao Supabase, edge functions encapsulam o que precisa de chaves secretas (OpenAI/Creatomate).

### Por que Vite + React e não Next.js?
Não há SSR necessário. SPA com Supabase no client é mais simples, e Vite oferece HMR e build mais rápidos.

### Por que `supabase-js` em vez de fetch direto?
Cliente único gerencia retry, refresh de JWT em background e tipagem de chamadas a `from()`/`functions.invoke()`. Para edge functions, passamos `headers: { Authorization }` explícito para evitar o `getSession()` interno do cliente (que estava dando timeout — fix em `3475c0f`).

### Por que `AuthContext` é a única fonte de getSession?
Hooks/pages chamando `supabase.auth.getSession()` em paralelo causavam timeouts e race conditions. Centralizamos no `AuthProvider`, que mantém `session` e `accessToken` em React state e expõe via `useAuth()`. Os consumidores leem, não chamam.

### Por que `gerar-banners` valida JWT manualmente?
Edge functions Supabase podem confiar no JWT do gateway, mas o body trazia `user_id` cliente-controlado. Risco de cliente passar `user_id` de outro corretor. A validação em `supabase.auth.getUser(token)` força `authenticatedUserId` derivado do token — body `user_id` foi removido do contrato.

### Por que sem cap em `selectedTemplates`?
Decisão do produto: o corretor deve poder gerar todos os 18 templates de uma vez se quiser. O backend só dedup IDs repetidos. Veja commit `6ccc98a`.

---

## Histórico Recente

| Data | Mudança | Commit |
|------|---------|--------|
| 2026-05-23 | Limpeza: removido `services/api.js` (dead code), `frontend/supabase/` (CLI órfão), `.temp/` ignorado | (atual) |
| 2026-05-23 | `auth-context` vira única fonte de getSession; hooks e NovaCampanha leem `accessToken` do context | `3475c0f` |
| 2026-05-22 | `gerar-banners` agora exige `selectedTemplates` do frontend; sem fallback de IA; sem cap; sanitizer força PT-BR (`NEW ON SALE`, `NEW YORK, NY`, `Open House`) | `6ccc98a` |
| 2026-05-22 | CRECI/Imobiliária vazios → REMOVER_ELEMENTO no prompt | `7003524` |
| 2026-05-20 | Validação JWT inbound em `gerar-banners`; `user_id` do body ignorado | `282b3d8` |
| 2026-05-18 | Campo Site adicionado em Configurações | `153d8b3` |
| 2026-05-17 | Upload de fotos com retry automático | `06d0068` |
| 2026-05-15 | `REMOVER_ELEMENTO` no prompt — elementos sem dado viram string vazia + track:false | `8151586` |
| 2026-05-15 | `vercel.json` removido — projeto não usa Vercel | `00b78ea` |
| 2026-05-14 | Sessão restaurada em F5 sem derrubar usuário | `df0c789` |
| 2026-05 (etapa 1) | Backend Node/Express deletado | `07c4028` |

---

## Notas Operacionais

- **Comando de deploy de edge function:**
  ```bash
  npx supabase functions deploy gerar-banners --project-ref sfbowejaevlmhcvsxhbk
  ```
- **Logs em produção:** Dashboard → Edge Functions → função → Logs
- **Tudo que não está no Supabase é o frontend.** Não procure por `backend/`, ele não existe mais.
