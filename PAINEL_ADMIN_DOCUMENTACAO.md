# Painel Administrativo - SmartCorretorAI

## 📋 Visão Geral

Painel administrativo completo para o fundador gerenciar a plataforma SmartCorretorAI. Acesso restrito apenas para usuários com `role = 'admin'`.

## 🔐 Acesso

**URL:** `/admin`

**Requisitos:**
- Usuário autenticado
- Role = 'admin' no banco de dados

## 🗄️ Estrutura do Banco de Dados

### Migration Aplicada

Arquivo: `supabase/migrations/004_add_role_column.sql`

```sql
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin'));
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
```

### Como Tornar um Usuário Admin

Execute no Supabase SQL Editor:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'seu-email@exemplo.com';
```

## 🎯 Funcionalidades

### 1. Visão Geral (Overview)

**Cards de Estatísticas:**
- Total de usuários cadastrados
- Usuários online (últimos 5 minutos)
- Novos usuários hoje/mês
- Total de campanhas geradas
- Campanhas geradas hoje/mês/ano
- MRR (Monthly Recurring Revenue)

**Receita:**
- Receita do dia
- Receita do mês
- Receita do ano
- Receita por plano (Start, Pro, Imobiliária)
- Vendas avulsas (5 e 10 créditos)

**Distribuição:**
- Usuários por plano
- Receita por plano

### 2. Gerenciamento de Usuários

**Listagem:**
- Busca por nome ou email
- Filtros por plano e role
- Visualização de:
  - Nome e email
  - Plano atual
  - Créditos avulsos
  - Total de campanhas geradas
  - Data de cadastro

**Ações por Usuário:**
- Visualizar detalhes completos
- Editar plano
- Alterar role (user/admin)
- Adicionar/remover créditos manualmente
- Deletar usuário

### 3. Campanhas

**Listagem:**
- Todas as campanhas da plataforma
- Filtros por status e usuário
- Informações:
  - Título da campanha
  - Usuário proprietário
  - Status (gerando/concluído/erro)
  - Data de criação

## 🔌 API Endpoints

### Backend Routes

Todas as rotas requerem autenticação + role admin.

**Base URL:** `/api/admin`

#### Estatísticas
```
GET /api/admin/stats
```
Retorna estatísticas gerais da plataforma.

#### Usuários
```
GET /api/admin/users
Query params: ?page=1&limit=50&search=termo&plano=starter&role=user
```
Lista todos os usuários com filtros.

```
GET /api/admin/users/:id
```
Detalhes completos de um usuário específico.

```
PUT /api/admin/users/:id
Body: { role: 'admin', creditos_avulsos: 10, plano: 'pro' }
```
Atualiza informações do usuário.

```
DELETE /api/admin/users/:id
```
Remove um usuário do sistema.

```
POST /api/admin/users/:id/credits
Body: { amount: 5, operation: 'add' | 'remove' }
```
Adiciona ou remove créditos manualmente.

#### Campanhas
```
GET /api/admin/campaigns
Query params: ?page=1&limit=50&status=concluido&user_id=uuid
```
Lista todas as campanhas com filtros.

#### Receita
```
GET /api/admin/revenue
Query params: ?period=day|month|year
```
Histórico de receita por período.

#### Custos
```
GET /api/admin/costs
```
Custos operacionais (placeholder para expansão futura).

## 📁 Arquivos Criados/Modificados

### Backend

**Novos Arquivos:**
- `backend/src/middleware/adminMiddleware.js` - Middleware de verificação de admin
- `backend/src/controllers/adminController.js` - Controladores das rotas admin
- `backend/src/routes/admin.js` - Definição das rotas admin

**Modificados:**
- `backend/src/app.js` - Adicionada rota `/api/admin`

### Frontend

**Novos Arquivos:**
- `frontend/src/pages/AdminDashboard.jsx` - Página do painel administrativo

**Modificados:**
- `frontend/src/App.jsx` - Adicionada rota `/admin` com proteção AdminRoute

### Database

**Novos Arquivos:**
- `supabase/migrations/004_add_role_column.sql` - Migration para adicionar coluna role

## 🚀 Como Usar

### 1. Aplicar Migration

Execute a migration no Supabase:

```bash
# Via Supabase CLI
supabase db push

# Ou execute manualmente no SQL Editor
```

### 2. Criar Primeiro Admin

No Supabase SQL Editor:

```sql
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'seu-email@exemplo.com';
```

### 3. Acessar o Painel

1. Faça login com a conta admin
2. Acesse: `http://localhost:5173/admin` (dev) ou `https://seudominio.com/admin` (prod)

## 🔒 Segurança

### Backend
- Middleware `adminMiddleware` verifica role antes de cada requisição
- Todas as rotas admin requerem autenticação prévia via `authMiddleware`
- Validação de permissões em cada endpoint

### Frontend
- Componente `AdminRoute` redireciona não-admins para `/dashboard`
- Verificação de role no useEffect da página
- Proteção contra acesso direto via URL

## 📊 Integração com Stripe

O painel busca dados de receita diretamente da API do Stripe:

- **Charges:** Para receita por período
- **Subscriptions:** Para calcular MRR
- **Invoices:** Para categorizar receita por plano

**Nota:** Certifique-se de que `STRIPE_SECRET_KEY` está configurada no `.env`.

## 🎨 Interface

### Tecnologias
- React + Tailwind CSS
- Lucide React (ícones)
- Modais para edição de usuários
- Tabs para navegação entre seções

### Responsividade
- Mobile-first design
- Grid adaptativo
- Tabelas com scroll horizontal em telas pequenas

## 🔄 Próximas Melhorias

- [ ] Gráficos de receita e crescimento
- [ ] Exportação de relatórios (CSV/PDF)
- [ ] Logs de atividades administrativas
- [ ] Gestão de custos operacionais detalhada
- [ ] Notificações em tempo real
- [ ] Análise de churn e retenção
- [ ] Dashboard de métricas de produto

## 🐛 Troubleshooting

### Erro: "Acesso negado"
- Verifique se o usuário tem `role = 'admin'` no banco
- Confirme que o token JWT está válido
- Verifique logs do backend para detalhes

### Dados do Stripe não aparecem
- Confirme que `STRIPE_SECRET_KEY` está configurada
- Verifique se há transações no Stripe
- Veja logs do console para erros da API Stripe

### Página redireciona para /dashboard
- Usuário não tem role admin
- Token expirado (faça login novamente)

## 📝 Notas Importantes

1. **Primeiro Admin:** Deve ser criado manualmente via SQL
2. **Segurança:** Nunca exponha endpoints admin sem autenticação
3. **Performance:** Queries de estatísticas podem ser lentas com muitos dados - considere cache
4. **Stripe:** Limites de API (100 itens por request) - implementar paginação se necessário

## 📞 Suporte

Para dúvidas ou problemas:
1. Verifique os logs do backend (`console.error`)
2. Inspecione Network tab no DevTools
3. Confirme configurações do `.env`
4. Revise permissões no Supabase

---

**Desenvolvido para SmartCorretorAI**
Versão: 1.0.0
Data: Maio 2026
