# SmartCorretorAI

Plataforma SaaS para corretores de imóveis gerarem automaticamente pacotes completos de marketing com banners, vídeos e textos para todas as redes sociais usando Inteligência Artificial.

## Stack

**Frontend:** React 18 + Vite + Tailwind CSS + Zustand + React Router v6  
**Backend:** Node.js + Express + JWT  
**Banco de dados:** Supabase (PostgreSQL)  
**IA:** OpenAI GPT-4o (textos) + DALL-E 3 (imagens)  
**Pagamentos:** Stripe  

## Estrutura do projeto

```
smartcorretorai/
├── frontend/          # React + Vite + Tailwind
│   └── src/
│       ├── components/
│       │   ├── layout/    # Sidebar, Header, AppLayout
│       │   ├── marketing/ # PropertyCard, CampaignCard
│       │   └── ui/        # Button, Input, Modal, Card, Badge
│       ├── hooks/         # useAuth, useProperties, useCampaigns
│       ├── pages/         # Dashboard, NovaCampanha, MeusImoveis, ...
│       ├── services/      # api.js, supabase.js, auth.js
│       ├── store/         # authStore (Zustand)
│       └── utils/         # formatters.js
├── backend/           # Node.js + Express
│   └── src/
│       ├── controllers/   # auth, users, properties, campaigns, generate, subscriptions
│       ├── middleware/    # auth, errorHandler
│       ├── routes/        # Todas as rotas da API
│       ├── services/      # supabase, openai, emailService
│       └── utils/         # response helpers
└── supabase/
    └── migrations/    # Schema SQL do banco de dados
```

## Instalação e execução

### Pré-requisitos
- Node.js 18+
- Conta no [Supabase](https://supabase.com)
- Chave da API [OpenAI](https://platform.openai.com)
- Conta no [Stripe](https://stripe.com) (para pagamentos)

### 1. Configure o banco de dados (Supabase)

1. Crie um projeto no Supabase
2. Acesse o **SQL Editor** e execute o arquivo `supabase/migrations/001_initial_schema.sql`
3. Opcionalmente execute `supabase/seed.sql` para dados de exemplo

### 2. Configure o Backend

```bash
cd backend
cp .env.example .env
# Edite o .env com suas credenciais
npm install
npm run dev
```

### 3. Configure o Frontend

```bash
cd frontend
cp .env.example .env
# Edite o .env com sua URL e chave do Supabase
npm install
npm run dev
```

O frontend estará disponível em `http://localhost:5173`  
O backend estará disponível em `http://localhost:3001`

## Variáveis de ambiente

### Backend (.env)
| Variável | Descrição |
|----------|-----------|
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role do Supabase |
| `JWT_SECRET` | Secret para assinar tokens JWT |
| `OPENAI_API_KEY` | Chave da API OpenAI |
| `STRIPE_SECRET_KEY` | Chave secreta do Stripe |
| `STRIPE_WEBHOOK_SECRET` | Secret do webhook do Stripe |
| `SMTP_*` | Configurações de e-mail |
| `FRONTEND_URL` | URL do frontend (para CORS e e-mails) |

### Frontend (.env)
| Variável | Descrição |
|----------|-----------|
| `VITE_SUPABASE_URL` | URL do projeto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Chave anon do Supabase |
| `VITE_API_URL` | URL da API backend |

## Planos e limites

| Recurso | Starter | Pro | Enterprise |
|---------|---------|-----|------------|
| Campanhas/mês | 5 | 30 | Ilimitado |
| Imóveis | 3 | Ilimitado | Ilimitado |
| Banners | Básico | HD | HD |
| Vídeos | Não | Sim | Sim |
| Usuários | 1 | 1 | Até 10 |
| Preço | R$97/mês | R$197/mês | R$497/mês |

## Endpoints da API

### Auth
- `POST /api/auth/register` — Cadastro
- `POST /api/auth/login` — Login
- `GET  /api/auth/me` — Dados do usuário logado
- `POST /api/auth/logout` — Logout
- `POST /api/auth/forgot-password` — Recuperação de senha

### Imóveis
- `GET    /api/properties` — Listar imóveis
- `POST   /api/properties` — Criar imóvel
- `PUT    /api/properties/:id` — Editar imóvel
- `DELETE /api/properties/:id` — Excluir imóvel

### Campanhas
- `GET    /api/campaigns` — Listar campanhas
- `GET    /api/campaigns/:id` — Detalhes da campanha
- `DELETE /api/campaigns/:id` — Excluir campanha

### Geração com IA
- `POST /api/generate/campaign` — Gerar pacote de marketing
- `GET  /api/generate/campaign/:id/status` — Status da geração

### Assinaturas
- `POST /api/subscriptions/checkout` — Iniciar checkout no Stripe
- `POST /api/subscriptions/webhook` — Webhook do Stripe
- `GET  /api/subscriptions/current` — Plano atual
