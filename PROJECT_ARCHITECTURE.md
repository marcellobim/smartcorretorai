# SmartCorretorAI - Arquitetura do Projeto

Auditoria feita em 2026-05-27, somente com leitura do projeto e criacao destes documentos. Nenhum arquivo de codigo, autenticacao, template ou configuracao de deploy foi alterado.

## Visao Geral

O SmartCorretorAI esta organizado como uma aplicacao SaaS com frontend React/Vite, Supabase para autenticacao/banco/storage/Edge Functions, OpenAI para geracao de textos e preenchimento inteligente, e Creatomate para renderizacao de banners e videos.

Fluxo principal atual:

1. O usuario acessa o frontend em React.
2. O AuthProvider restaura a sessao do Supabase e carrega o perfil.
3. Em `NovaCampanha.jsx`, o usuario preenche dados do imovel, envia fotos e seleciona formatos.
4. As fotos sao enviadas ao bucket `smartcorretor-assets`.
5. O frontend chama `gerar-campanha` para textos e, se houver templates selecionados, chama `gerar-banners`.
6. `gerar-campanha` usa OpenAI e salva a campanha na tabela `campaigns`.
7. `gerar-banners` busca dados do perfil, consulta elementos reais do Creatomate, gera `modifications`, dispara renders e salva os render IDs em `campaigns.banners`.
8. O frontend faz polling dos renders e exibe cards com imagens/videos gerados.

## Frontend

Local principal: `frontend/`

Stack identificada:

- React 19
- Vite
- React Router
- Supabase JS
- Zustand
- React Hook Form
- Lucide React
- React Hot Toast

Arquivos centrais:

- `frontend/src/App.jsx`: rotas, protecao de paginas privadas e admin.
- `frontend/src/main.jsx`: entrada do app.
- `frontend/src/lib/supabase.js`: cliente Supabase.
- `frontend/src/lib/auth-context.jsx`: contexto de autenticacao, sessao e perfil.
- `frontend/src/pages/NovaCampanha.jsx`: criacao de campanha, upload de fotos, chamada das Edge Functions e exibicao dos resultados.
- `frontend/src/pages/PacotesGerados.jsx`: listagem e download dos pacotes gerados.
- `frontend/src/pages/Configuracoes.jsx`: perfil do corretor.
- `frontend/src/hooks/useCampaigns.js`: acesso a campanhas.
- `frontend/src/hooks/useProperties.js`: acesso a imoveis.

Rotas protegidas identificadas:

- `/dashboard`
- `/nova-campanha`
- `/meus-imoveis`
- `/pacotes-gerados`
- `/configuracoes`
- `/admin` com verificacao de `role === 'admin'`

## Backend Supabase

Local principal: `supabase/`

Edge Functions identificadas:

- `supabase/functions/gerar-campanha/index.ts`
- `supabase/functions/gerar-banners/index.ts`

Configuracao:

- `supabase/config.toml`
- `project_id = "sfbowejaevlmhcvsxhbk"`
- `gerar-campanha` esta configurada com `verify_jwt = false`.
- `gerar-banners` nao aparece explicitamente em `config.toml` no estado auditado.

Migrations relevantes:

- `supabase/migrations/001_initial_schema.sql`
- `supabase/migrations/002_social_connections.sql`
- `supabase/migrations/003_plans_update.sql`
- `supabase/migrations/004_add_role_column.sql`
- `supabase/migrations/20260517_rls_policies.sql`
- `supabase/migrations/20260518_campaigns_fix_and_bucket.sql`
- `supabase/migrations/20260520_profile_brand_fields.sql`

Tabelas/areas relevantes:

- `profiles`: dados do corretor.
- `campaigns`: campanhas, dados do imovel, textos gerados e banners.
- Storage bucket `smartcorretor-assets`: fotos de campanha, avatar/logo do perfil.

## Integracoes Externas

OpenAI:

- Usada em `gerar-campanha` para gerar os 6 textos da campanha.
- Usada em `gerar-banners` para escolher/preencher modifications com base nos elementos reais do Creatomate.
- Modelo identificado: `gpt-4o-mini`.
- Secret esperado: `OPENAI_API_KEY`.

Creatomate:

- Usada em `gerar-banners`.
- API de templates: `GET https://api.creatomate.com/v1/templates/{template_id}`.
- API de renders: `POST https://api.creatomate.com/v1/renders`.
- Polling atual no frontend: `GET https://api.creatomate.com/v1/renders/{render_id}`.
- Secret backend: `CREATOMATE_API_KEY` via `Deno.env.get`.

IBGE:

- Usada no frontend para carregar cidades conforme estado selecionado.
- Endpoint: `https://servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios`.

## Ponto de Atencao Arquitetural

A integracao Creatomate esta em uma fase hibrida:

- O frontend ainda lista templates antigos em `FORMAT_GROUPS`.
- O backend ainda valida contra uma lista antiga em `TEMPLATES`.
- A funcao `gerar-banners` ja consulta os elementos reais de cada template antes de montar modifications.
- Os novos campos padronizados ainda nao sao usados como contrato direto no codigo salvo.

